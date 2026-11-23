import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHero } from "./helpers";

/**
 * Overlays du lot 5 — trois contrats, mesurés dans le moteur de rendu :
 *
 * 1. **matière unifiée** : la fiche du héros, le grimoire, l'inventaire et la
 *    fiche de donjon sont la **même** surface (fond + fibres de parchemin). Le
 *    défaut d'origine : fiche en parchemin, grimoire en bois, pour deux fenêtres
 *    du même niveau (`docs/design/specs/ui-visual-direction.md` §9) ;
 * 2. **zéro hex en dur** dans les fichiers d'overlay, hors l'unique exception
 *    gelée par `tests/unit/dungeonEntry.spec.ts` (bandeau de refus) ;
 * 3. **danger** : encre sur `danger-face` ≥ 4,5:1, ratio **recalculé** ici par la
 *    formule WCAG — pas recopié de la spec.
 */
const HERO_BUTTON = 'button:text-is("Fiche perso")';
const SPELLS_BUTTON = 'button:text-is("Sorts")';
const INVENTORY_BUTTON = 'button:text-is("Inventaire")';
const DUNGEONS_BUTTON = 'button:text-is("Donjons")';
const NEW_GAME_BUTTON = 'button:text-is("Nouvelle partie")';

const HERO_SHEET = 'section[aria-label="Fiche du héros"]';
const GRIMOIRE = 'section[aria-label="Grimoire"]';
const INVENTORY = 'section[aria-label="Inventaire"]';
const DUNGEON_SHEET = 'section[aria-label="Donjons disponibles"]';
const NEW_GAME_DIALOG = 'div[role="alertdialog"][aria-label="Nouvelle partie"]';
const DIALOG_SHEET = `${NEW_GAME_DIALOG} > section`;

/** Corps de fenêtre `surface-2` : `#3D342A`, la seule matière des overlays. */
const PARCHMENT_BG = "rgb(61, 52, 42)";
/** Bouton danger §2.2 : `danger-face` `#9C2F2F`. */
const DANGER_FACE = "rgb(156, 47, 47)";
const MIN_CONTRAST = 4.5;

const OVERLAY_SOURCES = [
  "src/ui/components/overlayTheme.ts",
  "src/ui/components/hero/heroTheme.ts",
  "src/ui/components/inventory/inventoryTheme.ts",
  "src/ui/components/inventory/InventoryPanel.tsx",
  "src/ui/components/inventory/BackpackList.tsx",
  "src/ui/components/inventory/ConsumableBar.tsx",
  "src/ui/components/inventory/EquipmentSlots.tsx",
  "src/ui/components/inventory/ItemDetailPanel.tsx",
  "src/ui/components/inventory/SaveControls.tsx",
  "src/ui/components/inventory/SetBonusPanel.tsx",
  "src/ui/components/inventory/StatBadge.tsx",
  "src/ui/components/inventory/StatSummary.tsx",
  "src/ui/components/spellbook/SpellbookPanel.tsx",
  "src/ui/components/dungeon/DungeonEntryPanel.tsx",
  "src/ui/components/NewGameButton.tsx",
  "src/ui/components/EndOverlay.tsx",
  "src/ui/components/RewardsSummary.tsx",
  "src/ui/components/DropList.tsx",
  "src/ui/components/LevelUpLine.tsx",
  "src/ui/components/OverlayPanels.tsx",
  "src/ui/components/elementInk.ts",
];

/**
 * Exception **unique et chiffrée** : le bandeau du refus d'entrée garde
 * `bg-[#b83b3b]` (= `--color-danger-line`) parce que le test unitaire
 * `tests/unit/dungeonEntry.spec.ts` l'exige dans le rendu, et que ce fichier de
 * test n'est pas dans mon périmètre d'écriture. Le ratchet interdit tout autre
 * hex : en ajouter un fait rougir ce test.
 */
const ALLOWED_HEX: Readonly<Record<string, readonly string[]>> = {
  "src/ui/components/dungeon/DungeonEntryPanel.tsx": ["#b83b3b"],
};

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/** Un commentaire n'est pas une couleur : le contrat porte sur les classes. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function hexesOf(file: string): string[] {
  const source = withoutComments(readFileSync(join(process.cwd(), file), "utf8"));
  return [...source.matchAll(HEX)].map((match) => (match[0] ?? "").toLowerCase());
}

type Rgb = [number, number, number];

function parseRgb(value: string): Rgb {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  const parts = (match?.[1] ?? "").split(",").map((part) => Number(part.trim()));
  if (match === null || parts.some((part) => Number.isNaN(part))) throw new Error(`couleur illisible : ${value}`);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function linear(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** Ratio WCAG entre deux couleurs opaques, recalculé — jamais recopié. */
function contrastRatio(first: Rgb, second: Rgb): number {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

interface Material {
  backgroundColor: string;
  backgroundImage: string;
  borderTopWidth: string;
  borderTopLeftRadius: string;
}

function materialOf(element: Element): Material {
  const style = getComputedStyle(element);
  return {
    backgroundColor: style.backgroundColor,
    backgroundImage: style.backgroundImage,
    borderTopWidth: style.borderTopWidth,
    borderTopLeftRadius: style.borderTopLeftRadius,
  };
}

async function readMaterial(page: Page, selector: string): Promise<Material> {
  return page.locator(selector).first().evaluate(materialOf);
}

/** Relevé du voile : position, boîte et appartenance des trois coins du viewport. */
interface Veil {
  viewport: { width: number; height: number };
  box: { width: number; height: number } | null;
  onLayer: (boolean | undefined)[];
  position: string;
}

/** Exécuté DANS la page : `window` et `document` seulement, aucune portée du module. */
function readVeil(element: Element): Veil {
  const layer = element.parentElement;
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const box = layer?.getBoundingClientRect();
  const corners = [[2, 2], [viewport.width - 2, 2], [2, viewport.height - 2]];
  const onLayer = corners.map(([x, y]) => layer?.contains(document.elementFromPoint(x ?? 0, y ?? 0)));
  const position = layer === null ? "" : getComputedStyle(layer).position;
  return { viewport, box: box === undefined ? null : { width: box.width, height: box.height }, onLayer, position };
}

/** Ouvre un panneau, relève sa matière, puis le referme sur Échap. */
async function materialThrough(page: Page, button: string, sheet: string): Promise<Material> {
  await page.locator(button).first().click();
  await expect(page.locator(sheet)).toBeVisible();
  const material = await readMaterial(page, sheet);
  await page.keyboard.press("Escape");
  await expect(page.locator(sheet)).toHaveCount(0);
  return material;
}

/** Cinq assertions de matière, une fois pour chaque fenêtre : même surface, même texture. */
function expectSameMaterial(sheets: readonly Material[]): void {
  const reference = sheets[0];
  for (const sheet of sheets) {
    expect(sheet.backgroundColor, "corps de fenêtre `surface-2`").toBe(PARCHMENT_BG);
    expect(sheet.backgroundImage, "fibres de parchemin communes").toBe(reference?.backgroundImage);
    expect(sheet.backgroundImage, "une texture est réellement peinte").not.toBe("none");
    expect(sheet.borderTopWidth, "filet de fenêtre 2 px").toBe("2px");
    expect(sheet.borderTopLeftRadius, "rayon 2 px, jamais 4").toBe("2px");
  }
}

test.describe("overlays — une seule matière", () => {
  test("fiche, grimoire, inventaire et donjons partagent la même surface", async ({ page }) => {
    await createHero(page);
    const sheets = [
      await materialThrough(page, HERO_BUTTON, HERO_SHEET),
      await materialThrough(page, SPELLS_BUTTON, GRIMOIRE),
      await materialThrough(page, INVENTORY_BUTTON, INVENTORY),
      await materialThrough(page, DUNGEONS_BUTTON, DUNGEON_SHEET),
    ];
    expectSameMaterial(sheets);
  });

  test("la confirmation « Nouvelle partie » est la même fenêtre", async ({ page }) => {
    await createHero(page);
    await page.locator(NEW_GAME_BUTTON).click();
    await expect(page.locator(NEW_GAME_DIALOG)).toBeVisible();
    expectSameMaterial([await readMaterial(page, DIALOG_SHEET)]);
  });
});

test.describe("overlays — le voile", () => {
  /**
   * Le voile doit couvrir **tout** le viewport, y compris la colonne du journal
   * et le dock : mesuré en capture, un voile `absolute` laissait ces deux
   * surfaces en pleine lumière derrière une fenêtre ouverte.
   */
  test("le voile couvre le viewport entier, journal et dock compris", async ({ page }) => {
    await createHero(page);
    await page.locator(INVENTORY_BUTTON).click();
    await expect(page.locator(INVENTORY)).toBeVisible();
    const veil = await page.locator(INVENTORY).evaluate(readVeil);
    expect(veil.position, "voile `fixed` : il ne dépend pas d'un ancêtre positionné").toBe("fixed");
    expect(veil.box, "le voile épouse le viewport").toEqual(veil.viewport);
    expect(veil.onLayer, "les coins du viewport appartiennent au voile").toEqual([true, true, true]);
  });
});

test.describe("overlays — aucun hex en dur", () => {
  test("les fichiers d'overlay ne portent que l'exception gelée par un test unitaire", () => {
    for (const file of OVERLAY_SOURCES) {
      const allowed = ALLOWED_HEX[file] ?? [];
      const found = [...new Set(hexesOf(file))].sort();
      expect(found, `hex hors thème dans ${file}`).toEqual([...allowed].sort());
    }
  });
});

test.describe("overlays — danger mesuré", () => {
  test("le bouton « Continuer » est en danger-face, texte ≥ 4,5:1", async ({ page }) => {
    await createHero(page);
    await page.locator(NEW_GAME_BUTTON).click();
    const button = page.getByRole("button", { name: "Continuer" });
    const style = await button.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { color: computed.color, backgroundColor: computed.backgroundColor, border: computed.borderTopColor };
    });
    expect(parseRgb(style.backgroundColor), "fond `danger-face`").toEqual(parseRgb(DANGER_FACE));
    const ratio = contrastRatio(parseRgb(style.color), parseRgb(style.backgroundColor));
    expect(ratio, `encre sur danger-face : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });

  test("la clé manquante est une plaque danger franche, sans opacité", async ({ page }) => {
    await createHero(page);
    await page.locator(DUNGEONS_BUTTON).click();
    const plaque = page.locator(`${DUNGEON_SHEET} p`).filter({ hasText: "manquante" }).first();
    await expect(plaque).toBeVisible();
    const style = await plaque.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { color: computed.color, backgroundColor: computed.backgroundColor, opacity: computed.opacity };
    });
    expect(style.opacity, "état franc : pas d'opacité").toBe("1");
    expect(parseRgb(style.backgroundColor), "plaque `danger-face`").toEqual(parseRgb(DANGER_FACE));
    const ratio = contrastRatio(parseRgb(style.color), parseRgb(style.backgroundColor));
    expect(ratio, `clé manquante : ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});
