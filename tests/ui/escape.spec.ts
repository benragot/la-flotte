import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Échap referme l'interface ouverte, et **seulement** elle : sans panneau, la
 * touche reste au raccourci global qui annule le sort sélectionné, et un
 * panneau imbriqué se ferme avant son parent.
 *
 * Sélecteurs réécrits ici volontairement : `helpers.ts` est modifié par une
 * autre PR en cours, ce spec ne doit pas en dépendre.
 */
const ARENA = 'main[aria-label="Terrain de combat"]';
const CLASS_CARDS = 'section[aria-label="Création de personnage"] button[aria-pressed]';
const INVENTORY = 'section[aria-label="Inventaire"]';
const HERO_SHEET = 'section[aria-label="Fiche du héros"]';
const GRIMOIRE = 'section[aria-label="Grimoire"]';
const SPELL_DETAIL = 'section[aria-label="Détail du sort"]';
const SELECTED_SPELL = 'section[aria-label="Sorts disponibles"] button[aria-pressed="true"]';
const NEW_GAME_DIALOG = 'div[role="alertdialog"][aria-label="Nouvelle partie"]';
const ROOM_PANEL = 'section[aria-label="Combat de salle"]';
const INVENTORY_BUTTON = 'button:text-is("Inventaire")';
const HERO_BUTTON = 'button:text-is("Fiche perso")';
const SPELLS_BUTTON = 'button:text-is("Sorts")';
const SPELL_DETAIL_HINT = "Sélectionne un sort pour voir ce qu’il fait";

async function createHero(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("textbox").fill("Balthazar");
  await page.locator(CLASS_CARDS).first().click();
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.locator(ARENA)).toBeVisible();
}

test.describe("Échap referme l'interface ouverte", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
  });

  test("l'inventaire ouvert disparaît sur Échap", async ({ page }) => {
    await page.locator(INVENTORY_BUTTON).click();
    await expect(page.locator(INVENTORY)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(INVENTORY)).toHaveCount(0);
  });

  test("la fiche perso disparaît sur Échap", async ({ page }) => {
    await page.locator(HERO_BUTTON).click();
    await expect(page.locator(HERO_SHEET)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(HERO_SHEET)).toHaveCount(0);
  });

  test("Échap ferme le panneau le plus interne avant le grimoire", async ({ page }) => {
    await page.locator(SPELLS_BUTTON).click();
    await page.locator(`${GRIMOIRE} button:has-text("Pression")`).click();
    await expect(page.locator(SPELL_DETAIL)).toContainText("3 PA");
    await page.keyboard.press("Escape");
    await expect(page.locator(SPELL_DETAIL)).toContainText(SPELL_DETAIL_HINT);
    await expect(page.locator(GRIMOIRE)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(GRIMOIRE)).toHaveCount(0);
  });
});

test.describe("priorité d'Échap : le panneau passe avant l'annulation du sort", () => {
  test("le sort reste sélectionné quand Échap ferme un panneau", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(ARENA)).toBeVisible();
    await page.keyboard.press("1");
    await expect(page.locator(SELECTED_SPELL)).toHaveCount(1);
    await page.locator(INVENTORY_BUTTON).click();
    await expect(page.locator(INVENTORY)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(INVENTORY)).toHaveCount(0);
    await expect(page.locator(SELECTED_SPELL)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(SELECTED_SPELL)).toHaveCount(0);
  });
});

test.describe("Échap sur les autres surfaces", () => {
  test("la confirmation « Nouvelle partie » s'annule sur Échap", async ({ page }) => {
    await createHero(page);
    await page.locator('button:text-is("Nouvelle partie")').click();
    await expect(page.locator(NEW_GAME_DIALOG)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(NEW_GAME_DIALOG)).toHaveCount(0);
  });

  test("la salle de combat ne reste pas ouverte sans combat", async ({ page }) => {
    await page.goto("/?demo=dungeon");
    const room = page.locator(ROOM_PANEL);
    await expect(room).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(room).toHaveCount(0);
  });
});
