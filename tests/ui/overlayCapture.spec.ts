import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import { createHero } from "./helpers";

/**
 * Captures des **six** overlays du lot 5, pour la recette visuelle du
 * propriétaire (`docs/design/specs/ui-visual-direction.md` §8, PR 7).
 *
 * Ce spec ne remplace pas les contrats de `overlayMaterial.spec.ts` : il
 * **photographie** ce que le joueur voit, aux trois viewports du projet. Les
 * fichiers atterrissent dans `test-results/overlays/`, jamais dans le dépôt.
 *
 * La fin de combat est atteinte en **jouant** : « Passer » rend la main à l'IA
 * qui frappe le héros. La boucle est bornée (`MAX_TURNS`) ; si la démo ne se
 * termine pas dans le budget, la capture est simplement absente — aucune
 * assertion ne dépend d'un aléa de combat.
 */
const HERO_BUTTON = 'button:text-is("Fiche perso")';
const SPELLS_BUTTON = 'button:text-is("Sorts")';
const INVENTORY_BUTTON = 'button:text-is("Inventaire")';
const DUNGEONS_BUTTON = 'button:text-is("Donjons")';
const NEW_GAME_BUTTON = 'button:text-is("Nouvelle partie")';

const INVENTORY = 'section[aria-label="Inventaire"]';
const HERO_SHEET = 'section[aria-label="Fiche du héros"]';
const GRIMOIRE = 'section[aria-label="Grimoire"]';
const DUNGEON_SHEET = 'section[aria-label="Donjons disponibles"]';
const NEW_GAME_DIALOG = 'div[role="alertdialog"][aria-label="Nouvelle partie"]';
const END_OVERLAY = 'section[aria-label="Fin du combat"]';
const SPELL_DETAIL = 'section[aria-label="Détail du sort"]';

const MAX_TURNS = 30;
const TURN_WAIT_MS = 120;

/** Capture nommée par viewport : trois largeurs, un seul jeu de noms. */
async function shot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/overlays/${testInfo.project.name}-${name}.png` });
}

interface Opening {
  button: string;
  sheet: string;
  name: string;
}

/** Ouvre une fenêtre, la photographie, puis la referme sur Échap. */
async function captureSheet(page: Page, testInfo: TestInfo, opening: Opening): Promise<void> {
  await page.locator(opening.button).first().click();
  await expect(page.locator(opening.sheet)).toBeVisible();
  await shot(page, testInfo, opening.name);
  await page.keyboard.press("Escape");
  await expect(page.locator(opening.sheet)).toHaveCount(0);
}

test.describe("overlays — captures", () => {
  /**
   * Budget de temps seulement : six ouvertures et trois captures par viewport
   * sur SwiftShader dépassent les 30 s par défaut. Aucune assertion n'est
   * élargie (même précédent que `newGame.spec.ts`).
   */
  test.setTimeout(90_000);

  test("les cinq fenêtres d'exploration", async ({ page }, testInfo) => {
    await createHero(page);
    await captureSheet(page, testInfo, { button: INVENTORY_BUTTON, sheet: INVENTORY, name: "overlay-inventaire" });
    await captureSheet(page, testInfo, { button: HERO_BUTTON, sheet: HERO_SHEET, name: "overlay-fiche" });
    await captureSheet(page, testInfo, { button: DUNGEONS_BUTTON, sheet: DUNGEON_SHEET, name: "overlay-donjons" });
    await page.locator(SPELLS_BUTTON).first().click();
    await page.locator(`${GRIMOIRE} button:has-text("Pression")`).click();
    await expect(page.locator(SPELL_DETAIL)).toBeVisible();
    await shot(page, testInfo, "overlay-grimoire");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.locator(GRIMOIRE)).toHaveCount(0);
    await page.locator(NEW_GAME_BUTTON).click();
    await expect(page.locator(NEW_GAME_DIALOG)).toBeVisible();
    await shot(page, testInfo, "overlay-nouvelle-partie");
  });

  test("la fin de combat, atteinte en jouant", async ({ page }, testInfo) => {
    await page.goto("/?demo=combat");
    await expect(page.locator('section[aria-label="Sorts disponibles"]')).toBeVisible();
    if (!(await passUntilOver(page))) return;
    await expect(page.locator(END_OVERLAY)).toBeVisible();
    await shot(page, testInfo, "overlay-fin-de-combat");
    const title = await page.locator(`${END_OVERLAY} h2`).evaluate((element) => getComputedStyle(element).fontSize);
    expect(title, "verdict sobre : titre de fenêtre 18 px, pas une fanfare de 30 px").toBe("18px");
  });
});

/** « Passer » jusqu'à la fin du combat, dans un budget de tours explicite. */
async function passUntilOver(page: Page): Promise<boolean> {
  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    if ((await page.locator(END_OVERLAY).count()) > 0) return true;
    const pass = page.getByRole("button", { name: "Passer" }).first();
    const enabled = await pass.isEnabled().catch(() => false);
    if (!enabled) return false;
    await pass.click();
    await page.waitForTimeout(TURN_WAIT_MS);
  }
  return (await page.locator(END_OVERLAY).count()) > 0;
}