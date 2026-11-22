import { expect, test } from "@playwright/test";
import { CLASS_CARDS, createHero } from "./helpers";

/**
 * Parcours réel du retour joueur : « je suis directement dans mon perso iop et
 * je ne peux pas en sortir ». Les sélecteurs sont des rôles et libellés
 * accessibles, jamais des `data-testid`.
 */
const CREATION_SHEET = 'section[aria-label="Création de personnage"]';
const NEW_GAME_BUTTON = { name: "Nouvelle partie" };
const DIALOG = '[role="alertdialog"][aria-label="Nouvelle partie"]';
const HERO_DOCK = '[role="group"][aria-label="Dock du héros"]';

test.describe("nouvelle partie", () => {
  test("annuler ne change rien, confirmer ramène à la création puis recrée", async ({ page }) => {
    await createHero(page);
    await page.getByRole("button", NEW_GAME_BUTTON).click();
    await expect(page.locator(DIALOG)).toBeVisible();
    await page.getByRole("button", { name: "Annuler" }).click();
    await expect(page.locator(DIALOG)).toHaveCount(0);
    await expect(page.locator(HERO_DOCK)).toBeVisible();
    await page.getByRole("button", NEW_GAME_BUTTON).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.locator(CREATION_SHEET)).toBeVisible();
    await page.getByRole("textbox").fill("Gaspard");
    await page.locator(CLASS_CARDS).first().click();
    await page.getByRole("button", { name: "Créer" }).click();
    await expect(page.locator(HERO_DOCK)).toBeVisible();
  });

  test("un rechargement après confirmation ne ressuscite pas l'ancien héros", async ({ page }) => {
    await createHero(page);
    await page.getByRole("button", NEW_GAME_BUTTON).click();
    await page.getByRole("button", { name: "Continuer" }).click();
    await expect(page.locator(CREATION_SHEET)).toBeVisible();
    await page.reload();
    await expect(page.locator(CREATION_SHEET)).toBeVisible();
  });
});
