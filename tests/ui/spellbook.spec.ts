import { expect, test } from "@playwright/test";
import { createHero } from "./helpers";

/**
 * Grimoire : le HUD ne montre que la grille de lancers (coût en PA). Ce panneau
 * superposé dit au joueur ce que chaque sort fait vraiment — élément, dégâts,
 * portée, recharge — sans remplacer la grille qui sert à lancer.
 */
const SPELLBOOK_BUTTON = 'button:text-is("Sorts")';
const GRIMOIRE = 'section[aria-label="Grimoire"]';
const SPELL_DETAIL = 'section[aria-label="Détail du sort"]';
const HUD_SPELL_SLOTS = 'section[aria-label="Sorts disponibles"]';
const IOP_SPELL_COUNT = 3;

test.describe("grimoire en exploration", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
  });

  test("le bouton Sorts ouvre le panneau et liste les sorts du héros", async ({ page }) => {
    await expect(page.locator(GRIMOIRE)).toHaveCount(0);
    await page.locator(SPELLBOOK_BUTTON).click();
    await expect(page.locator(GRIMOIRE)).toBeVisible();
    await expect(page.locator(`${GRIMOIRE} li`)).toHaveCount(IOP_SPELL_COUNT);
    await expect(page.locator(GRIMOIRE)).toContainText("Pression");
    await expect(page.locator(GRIMOIRE)).toContainText("3 PA");
  });

  test("cliquer un sort affiche son détail chiffré", async ({ page }) => {
    await page.locator(SPELLBOOK_BUTTON).click();
    await page.locator(`${GRIMOIRE} button:has-text("Pression")`).click();
    await expect(page.locator(SPELL_DETAIL)).toBeVisible();
    for (const expected of ["3 PA", "Terre", "8–12", "1–2 PO"]) {
      await expect(page.locator(SPELL_DETAIL)).toContainText(expected);
    }
  });

  test("le bouton Fermer referme le panneau", async ({ page }) => {
    await page.locator(SPELLBOOK_BUTTON).click();
    await expect(page.locator(GRIMOIRE)).toBeVisible();
    await page.getByRole("button", { name: "Fermer", exact: true }).click();
    await expect(page.locator(GRIMOIRE)).toHaveCount(0);
  });
});

test.describe("grimoire pendant un combat", () => {
  test("s'ouvre sans interrompre le combat en cours", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(HUD_SPELL_SLOTS)).toBeVisible();
    await page.locator(SPELLBOOK_BUTTON).click();
    await expect(page.locator(GRIMOIRE)).toBeVisible();
    await expect(page.locator(GRIMOIRE)).toContainText("Épée du Destin");
    await expect(page.locator(HUD_SPELL_SLOTS)).toBeVisible();
    await expect(page.getByRole("button", { name: "Passer" })).toBeVisible();
  });
});
