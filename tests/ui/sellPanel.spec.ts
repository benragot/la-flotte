import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createHero } from "./helpers";

/**
 * Écran de vente (DATA-02, seconde moitié) — le sac devient la bourse.
 *
 * Contrats mesurés dans le vrai moteur de rendu, aux trois viewports du
 * `playwright.config.ts` :
 * 1. vendre **une** unité crédite exactement son `sellPrice` et décrémente la
 *    pile d'une unité (valeurs chiffrées, jamais « ça a changé ») ;
 * 2. « Tout vendre » retire la ligne et crédite le reste de la pile ;
 * 3. la vente est **persistée** : après rechargement, bourse et quantité sont
 *    relues depuis la sauvegarde ;
 * 4. en combat, la vente est **désactivée** (arbitrage de la spec §10) : un clic
 *    forcé ne crédite rien et la grille n'est pas redimensionnée par le sac.
 *
 * Les prix attendus (12 et 8) viennent de `data/items.yaml` ; ils sont écrits
 * ici en clair parce qu'un test de valeur exacte doit citer sa donnée. Le sac
 * de départ contient le chapeau (12) et le gourdin (8), bourse à 0.
 */
const ARENA = 'main[aria-label="Terrain de combat"]';
const INVENTORY = 'section[aria-label="Inventaire"]';
const SAC = 'section[aria-label="Sac"]';
const PURSE = `${SAC} p[aria-label="Bourse"]`;
const BAG = 'ul[aria-label="Objets du sac"]';

const SAVE_KEY = "la-flotte-save-slot-1";
const CHAPEAU = "Chapeau du Piou Mazouté";
const CHAPEAU_ID = "chapeau_piou_mazoute";
const CHAPEAU_PRICE = 12;

/** Sauvegarde minimale relue pour gonfler une pile : seule la quantité change. */
interface SaveSnapshot {
  characters: { inventory: { stacks: { itemId: string; quantity: number }[] } }[];
}

interface StackSeed {
  key: string;
  itemId: string;
  quantity: number;
}

/** Augmente la pile sauvegardée puis recharge : le store restaure la vraie donnée. */
async function setStack(page: Page, itemId: string, quantity: number): Promise<void> {
  await page.evaluate((seed: StackSeed) => {
    const raw = window.localStorage.getItem(seed.key);
    if (raw === null) throw new Error("aucune sauvegarde à modifier");
    const save = JSON.parse(raw) as SaveSnapshot;
    const stacks = save.characters[0]?.inventory.stacks ?? [];
    const stack = stacks.find((entry) => entry.itemId === seed.itemId);
    if (stack === undefined) throw new Error(`pile absente du sac : ${seed.itemId}`);
    stack.quantity = seed.quantity;
    window.localStorage.setItem(seed.key, JSON.stringify(save));
  }, { key: SAVE_KEY, itemId, quantity });
  await page.reload();
  await expect(page.locator(ARENA)).toBeVisible();
}

/** Ligne du sac d'un objet donné : le prix et les actions y sont ancrés. */
function bagRow(page: Page, name: string) {
  return page.locator(`${BAG} li`).filter({ hasText: name });
}

/** `I` ouvre le sac ; l'assertion de visibilité est le seul verrou d'attente. */
async function openBag(page: Page): Promise<void> {
  await page.keyboard.press("i");
  await expect(page.locator(INVENTORY)).toBeVisible();
}

test.describe("écran de vente", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
    await setStack(page, CHAPEAU_ID, 3);
  });

  test("vendre 1 crédite le prix unitaire et décrémente la pile", async ({ page }) => {
    await expect(page.locator(INVENTORY)).toHaveCount(0);
    await openBag(page);
    await expect(page.locator(PURSE)).toHaveText("Bourse : 0 kamas");
    const row = bagRow(page, CHAPEAU);
    await expect(row).toContainText("×3");
    await expect(row).toContainText(`${CHAPEAU_PRICE} kamas`);
    await row.getByRole("button", { name: "Vendre 1" }).click();
    await expect(page.locator(PURSE)).toHaveText(`Bourse : ${CHAPEAU_PRICE} kamas`);
    await expect(row).toContainText("×2");
    await expect(page.locator(`${SAC} [role="status"]`)).toHaveText(`Vendu : ${CHAPEAU} ×1`);
  });

  test("tout vendre retire la ligne et crédite le reste de la pile", async ({ page }) => {
    await openBag(page);
    await bagRow(page, CHAPEAU).getByRole("button", { name: "Tout vendre" }).click();
    await expect(bagRow(page, CHAPEAU)).toHaveCount(0);
    await expect(page.locator(PURSE)).toHaveText(`Bourse : ${CHAPEAU_PRICE * 3} kamas`);
  });
});

test.describe("bourse persistante et clavier", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
    await setStack(page, CHAPEAU_ID, 3);
  });

  test("la bourse et la quantité survivent au rechargement", async ({ page }) => {
    await openBag(page);
    await bagRow(page, CHAPEAU).getByRole("button", { name: "Vendre 1" }).click();
    await expect(page.locator(PURSE)).toHaveText(`Bourse : ${CHAPEAU_PRICE} kamas`);
    await page.reload();
    await expect(page.locator(ARENA)).toBeVisible();
    await openBag(page);
    await expect(page.locator(PURSE)).toHaveText(`Bourse : ${CHAPEAU_PRICE} kamas`);
    await expect(bagRow(page, CHAPEAU)).toContainText("×2");
  });

  test("la touche I ouvre et referme le sac", async ({ page }) => {
    await openBag(page);
    await page.keyboard.press("i");
    await expect(page.locator(INVENTORY)).toHaveCount(0);
  });
});

test.describe("vente et combat", () => {
  test("en combat, la vente est désactivée et un clic forcé ne crédite rien", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(ARENA)).toBeVisible();
    const canvas = page.locator(`${ARENA} canvas`);
    const closed = await canvas.boundingBox();
    await openBag(page);
    const opened = await canvas.boundingBox();
    await expect(page.locator(SAC)).toContainText("Vente impossible en combat");
    const sell = bagRow(page, CHAPEAU).getByRole("button", { name: "Vendre 1" });
    await expect(sell).toBeDisabled();
    await sell.click({ force: true });
    await expect(page.locator(PURSE)).toHaveText("Bourse : 0 kamas");
    await expect(bagRow(page, CHAPEAU)).toContainText("×1");
    expect(opened, "sac ouvert : la grille garde exactement sa boîte").toEqual(closed);
    await page.keyboard.press("Escape");
    await expect(page.locator(INVENTORY)).toHaveCount(0);
    expect(await canvas.boundingBox()).toEqual(closed);
  });
});
