import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Matière du dock, mesurée par le moteur de rendu (`getComputedStyle`) et non
 * lue dans une classe : une classe Tailwind peut être écrite sans être générée
 * (typiquement un jeton `@theme` absent de la feuille qui porte Tailwind), et
 * le dock retomberait alors sur le fond transparent. Ces valeurs sont celles de
 * `docs/design/specs/ui-visual-direction.md` §1.2, §1.3 et §2.1.
 */
const COMBAT_DOCK = 'div:has(> [data-zone="journal"])';
const JOURNAL_PANEL = '[data-zone="journal"] > section[aria-label="Journal de combat"]';
const VITALS_PANEL = '[data-zone="vitals"] > section[aria-label="Ressources du héros"]';
const SPELLS_PANEL = '[data-zone="spells"] > section[aria-label="Sorts disponibles"]';
const TURN_ZONE = '[data-zone="turn"]';

/** Fond pierre (`surface-1`) du dock : `#2B241D`. */
const DOCK_BG = "rgb(43, 36, 29)";
/** Filet or (`line`) sur pierre : `#8C6D46`. */
const DOCK_LINE = "rgb(140, 109, 70)";
/** Corps de panneau (`surface-2`) : `#3D342A`. */
const PANEL_BG = "rgb(61, 52, 42)";
/** Filet fort (`line-strong`) sur `surface-2` : `#967A57`. */
const PANEL_LINE = "rgb(150, 122, 87)";
/** Rayon de plaque : 2 px, jamais l'arrondi de 4 px de Tailwind v4. */
const PLATE_RADIUS = "2px";

interface Material {
  backgroundColor: string;
  borderTopWidth: string;
  borderTopColor: string;
  borderLeftWidth: string;
  borderTopLeftRadius: string;
  height: string;
}

function styleOf(element: Element): Material {
  const style = getComputedStyle(element);
  return {
    backgroundColor: style.backgroundColor,
    borderTopWidth: style.borderTopWidth,
    borderTopColor: style.borderTopColor,
    borderLeftWidth: style.borderLeftWidth,
    borderTopLeftRadius: style.borderTopLeftRadius,
    height: style.height,
  };
}

async function materialOf(page: Page, selector: string): Promise<Material> {
  const material = await page.locator(selector).first().evaluate(styleOf);
  return material;
}

test.describe("dock de combat — matière du pont", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(SPELLS_PANEL)).toBeVisible();
    await expect(page.locator(TURN_ZONE)).toBeVisible();
  });

  test("le dock est une plaque pierre à filet or 2 px, rayon 2 px, 150 px de haut", async ({ page }) => {
    const dock = await materialOf(page, COMBAT_DOCK);
    expect(dock.backgroundColor, "fond pierre #2B241D").toBe(DOCK_BG);
    expect(dock.borderTopWidth, "filet or de 2 px").toBe("2px");
    expect(dock.borderTopColor, "filet or #8C6D46").toBe(DOCK_LINE);
    expect(dock.borderLeftWidth, "filet latéral de 2 px").toBe("2px");
    expect(dock.borderTopLeftRadius, "rayon de plaque 2 px").toBe(PLATE_RADIUS);
    expect(dock.height, "le dock garde ses 150 px").toBe("150px");
  });

  test("les panneaux du dock portent le filet fort 2 px sur corps de panneau", async ({ page }) => {
    for (const selector of [JOURNAL_PANEL, VITALS_PANEL, SPELLS_PANEL]) {
      const panel = await materialOf(page, selector);
      expect(panel.backgroundColor, `corps de panneau #3D342A (${selector})`).toBe(PANEL_BG);
      expect(panel.borderTopWidth, `filet 2 px (${selector})`).toBe("2px");
      expect(panel.borderTopColor, `filet fort #967A57 (${selector})`).toBe(PANEL_LINE);
      expect(panel.borderTopLeftRadius, `rayon 2 px (${selector})`).toBe(PLATE_RADIUS);
    }
  });
});
