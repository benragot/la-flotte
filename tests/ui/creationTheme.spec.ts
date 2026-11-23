import { expect, test } from "@playwright/test";
import { expectInsideViewport } from "./helpers";

/**
 * Écran de création — matière mesurée par le moteur de rendu.
 *
 * Le défaut d'origine : le **titre** de l'écran que le joueur voit en premier
 * était rendu par `SECTION_HEADING`, soit **10 px en majuscules** — une légende
 * à la place d'un titre. Ces mesures fixent la correction : Georgia 30 px, or du
 * thème (`docs/design/specs/ui-visual-direction.md` §2.5 `display`), contraste
 * de lecture ≥ 4,5:1, planches de classe en bois à rayon 2 px, champ creux 1 px
 * qui s'éclaire en or, et bouton `Créer` atteignable au plus petit viewport.
 */

const SHEET = 'section[aria-label="Création de personnage"]';
const TITLE = `${SHEET} h1`;
const CLASS_CARD = `${SHEET} button[aria-pressed]`;
const CREATE_BUTTON = `${SHEET} button:has-text("Créer")`;
const NAME_INPUT = `${SHEET} input`;

/** Encres de la palette §1 : or `line-gold`, corps de panneau `surface-2`. */
const GOLD = "rgb(212, 165, 55)";
const FOCUS = "rgb(242, 214, 75)";
/** Planche de bois (§1.8 `wood-face`) et creux de champ (§2.1 `field`). */
const WOOD_FACE = "rgb(74, 55, 40)";
const FIELD_INSET = "rgb(26, 21, 18)";
/** Encre tertiaire `ink-3` : plancher de lisibilité du texte d'aide (§1.4). */
const INK_3 = "rgb(176, 154, 127)";
/** Seuil de lecture du texte courant. */
const MIN_CONTRAST = 4.5;

type Rgb = [number, number, number];

function parseRgb(value: string): Rgb {
  const match = /rgba?\(([^)]+)\)/.exec(value);
  const parts = (match?.[1] ?? "").split(",").map((part) => Number(part.trim()));
  if (match === null || parts.some((part) => Number.isNaN(part))) throw new Error(`couleur illisible : ${value}`);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Canal sRGB linéarisé (WCAG 2.1, définition du contraste). */
function linear(channel: number): number {
  const ratio = channel / 255;
  return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
}

function luminance([red, green, blue]: Rgb): number {
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

/** Ratio de contraste WCAG entre deux couleurs opaques. */
function contrastRatio(first: Rgb, second: Rgb): number {
  const [high, low] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

interface TitleStyle {
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  color: string;
}

function titleStyle(element: Element): TitleStyle {
  const style = getComputedStyle(element);
  return { fontSize: style.fontSize, fontFamily: style.fontFamily, fontWeight: style.fontWeight, color: style.color };
}

interface CardStyle {
  backgroundColor: string;
  borderTopWidth: string;
  borderTopLeftRadius: string;
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("écran de création — le titre", () => {
  test("le titre est un vrai titre : 30 px Georgia or, pas une légende", async ({ page }) => {
    const title = await page.locator(TITLE).evaluate(titleStyle);
    expect(Number.parseFloat(title.fontSize), `taille du titre : ${title.fontSize}`).toBeGreaterThanOrEqual(24);
    expect(title.fontSize, "taille retenue par la direction visuelle").toBe("30px");
    expect(title.fontFamily, "empilement Georgia du thème (§2.5)").toContain("Georgia");
    expect(title.fontWeight, "graisse de titre").toBe("700");
    expect(parseRgb(title.color), "or `line-gold` du thème").toEqual(parseRgb(GOLD));
  });

  test("le titre garde un contraste de lecture de 4,5:1 sur son panneau", async ({ page }) => {
    const title = await page.locator(TITLE).evaluate(titleStyle);
    const panel = await page.locator(SHEET).evaluate((element) => getComputedStyle(element).backgroundColor);
    const ratio = contrastRatio(parseRgb(title.color), parseRgb(panel));
    expect(ratio, `contraste ${ratio.toFixed(2)}:1 du titre sur ${panel}`).toBeGreaterThanOrEqual(MIN_CONTRAST);
  });
});

test.describe("écran de création — planches de classe", () => {
  test("les douze classes sont des planches de bois à filet 2 px et rayon 2 px", async ({ page }) => {
    const cards = await page.locator(CLASS_CARD).evaluateAll((elements) =>
      elements.map((element): CardStyle => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          borderTopLeftRadius: style.borderTopLeftRadius,
        };
      }),
    );
    expect(cards, "une planche par classe").toHaveLength(12);
    for (const card of cards) {
      expect(card.backgroundColor, "planche `wood-face`").toBe(WOOD_FACE);
      expect(card.borderTopWidth, "filet de planche 2 px").toBe("2px");
      expect(card.borderTopLeftRadius, "rayon 2 px, jamais 4").toBe("2px");
    }
  });

  test("la classe choisie est cerclée d'or, franchement", async ({ page }) => {
    const card = page.locator(CLASS_CARD).first();
    await card.click();
    await expect(card, "`button[aria-pressed]` conservé (sélecteur de contrat)").toHaveAttribute("aria-pressed", "true");
    await expect(card, "filet or de la carte choisie").toHaveCSS("border-top-color", GOLD);
    await expect(card, "cerclage or intérieur").toHaveCSS("box-shadow", /rgb\(212, 165, 55\)/);
  });
});

test.describe("écran de création — champ et action", () => {
  test("le champ du nom est un creux de 1 px qui s'éclaire en or", async ({ page }) => {
    const input = page.locator(NAME_INPUT);
    const idle = await input.evaluate((element) => {
      const style = getComputedStyle(element);
      return { width: style.borderTopWidth, radius: style.borderTopLeftRadius, background: style.backgroundColor };
    });
    expect(idle.width, "creux de champ : 1 px").toBe("1px");
    expect(idle.radius, "rayon de champ : 1 px").toBe("1px");
    expect(idle.background, "fond creusé `surface-inset`").toBe(FIELD_INSET);
    const placeholder = await input.evaluate((element) => getComputedStyle(element, "::placeholder").color);
    expect(parseRgb(placeholder), "placeholder lisible : encre tertiaire, pas du gris système").toEqual(parseRgb(INK_3));
    await input.focus();
    const focused = await input.evaluate((element) => {
      const style = getComputedStyle(element);
      return { border: style.borderTopColor, outline: style.outlineColor, style: style.outlineStyle };
    });
    expect(focused.border, "focus visible : filet or").toBe(GOLD);
    expect(focused.outline, "anneau clavier au focus du thème").toBe(FOCUS);
    expect(focused.style, "anneau réellement tracé").toBe("solid");
  });

  test("le bouton Créer reste dans le viewport, au plus petit comme au plus grand", async ({ page }) => {
    await page.getByRole("textbox").fill("Balthazar");
    await page.locator(CLASS_CARD).first().click();
    await expectInsideViewport(page, CREATE_BUTTON);
    await expect(page.getByRole("button", { name: "Créer" })).toBeEnabled();
  });
});
