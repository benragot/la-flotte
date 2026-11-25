import { expect, test } from "@playwright/test";
import { expectInsideViewport, expectNoOverlap } from "./helpers";

/**
 * UI-04 — les cartes de classe ne sont plus interchangeables.
 *
 * En 1.29, **aucune statistique de départ ne distingue les classes** : les
 * 55 PV / 6 PA / 3 PM / 100 PP sont le socle commun (sauf deux écarts réels
 * portés par les données : 120 PP chez Enutrof, +2 PV par point de vitalité
 * chez Sacrieur). Ce qui distingue réellement une classe, ce sont **ses trois
 * sorts** et **ses paliers de soft cap**. Ces tests lisent le texte rendu :
 * aucun snapshot, aucune valeur recopiée en dur hors des données citées.
 */

const SHEET = 'section[aria-label="Création de personnage"]';
const CARD = `${SHEET} button[aria-pressed]`;
const SPELL = "[data-class-spell]";
const CAP = "[data-class-cap]";
const SOCLE = "[data-class-socle]";
const CREATE_BUTTON = `${SHEET} button:has-text("Créer")`;

const IOP = `${CARD}[data-class-card="iop"]`;
const FECA = `${CARD}[data-class-card="feca"]`;
const ENUTROF = `${CARD}[data-class-card="enutrof"]`;
const SACRIEUR = `${CARD}[data-class-card="sacrieur"]`;

/** Encres de la planche de bois (§1.8) : le texte de lecture reste `wood-ink`. */
const WOOD_FACE = "rgb(74, 55, 40)";
const WOOD_INK = "rgb(240, 227, 200)";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test.describe("cartes de classe — sorts emblématiques", () => {
  test("les douze classes montrent trois sorts et quatre paliers chacune", async ({ page }) => {
    const cards = page.locator(CARD);
    await expect(cards).toHaveCount(12);
    for (const card of await cards.all()) {
      await expect(card.locator(SPELL), "trois sorts par classe").toHaveCount(3);
      await expect(card.locator(CAP), "quatre stats élémentaires").toHaveCount(4);
    }
  });

  test("deux classes n'affichent pas les mêmes sorts", async ({ page }) => {
    const iop = page.locator(IOP);
    const feca = page.locator(FECA);
    for (const name of ["Pression", "Bond", "Épée du Destin"]) {
      await expect(iop, `sort de Iop : ${name}`).toContainText(name);
    }
    for (const name of ["Attaque Naturelle", "Glyphe Agressif", "Armure Terrestre"]) {
      await expect(feca, `sort de Féca : ${name}`).toContainText(name);
    }
    await expect(iop, "Iop n'emprunte pas les sorts du Féca").not.toContainText("Attaque Naturelle");
    await expect(feca, "Féca n'emprunte pas les sorts du Iop").not.toContainText("Pression");
  });

  test("le coût PA et l'effet sont écrits, pas seulement le nom du sort", async ({ page }) => {
    await expect(page.locator(`${IOP} [data-class-spell="pression"]`)).toContainText("3 PA");
    await expect(page.locator(`${IOP} [data-class-spell="pression"]`)).toContainText("8–12");
    await expect(page.locator(`${IOP} [data-class-spell="pression"]`)).toContainText("Terre");
    await expect(page.locator(`${IOP} [data-class-spell="bond"]`)).toContainText("5 PA");
    await expect(page.locator(`${IOP} [data-class-spell="bond"]`)).toContainText("Téléportation");
  });
});

test.describe("cartes de classe — paliers de soft cap", () => {
  test("le palier de Force du Iop est le sien, pas celui du Féca", async ({ page }) => {
    await expect(page.locator(`${IOP} ${CAP}[data-class-cap="strength"]`)).toHaveText(
      "For ×1→100 ×2→200 ×3→300 ×4→400 ×5+",
    );
    await expect(page.locator(`${FECA} ${CAP}[data-class-cap="strength"]`)).toHaveText(
      "For ×2→50 ×3→150 ×4→250 ×5+",
    );
  });

  test("les quatre voies élémentaires sont nommées en clair", async ({ page }) => {
    await expect(page.locator(`${IOP} ${CAP}`)).toHaveCount(4);
    const labels = [["strength", "For"], ["intelligence", "Int"], ["chance", "Cha"], ["agility", "Agi"]] as const;
    for (const [stat, label] of labels) {
      await expect(page.locator(`${IOP} ${CAP}[data-class-cap="${stat}"]`), `palier ${label} affiché`).toContainText(label);
    }
  });
});

test.describe("cartes de classe — socle commun annoncé une fois", () => {
  test("le socle 1.29 est écrit une seule fois, hors des cartes", async ({ page }) => {
    const socle = page.locator(SOCLE);
    await expect(socle, "une seule annonce du socle commun").toHaveCount(1);
    await expect(socle).toHaveText("Socle commun 1.29 : 55 PV · 6 PA · 3 PM");
    await expect(page.locator(CARD).first(), "les chiffres communs ne sont plus répétés 12 fois").not.toContainText("55 PV");
  });

  test("les deux écarts réels des données restent visibles par classe", async ({ page }) => {
    await expect(page.locator(ENUTROF), "Enutrof : 120 PP dans classes.yaml").toContainText("PP 120");
    await expect(page.locator(SACRIEUR), "Sacrieur : 2 PV par point de vitalité").toContainText("Vitalité +2 PV/pt");
    await expect(page.locator(`${IOP} [data-class-extra]`), "Iop : aucun écart, aucune plaque").toHaveCount(0);
  });
});

test.describe("cartes de classe — lisibilité et layout", () => {
  test("le texte des cartes garde l'encre de bois et une taille lisible", async ({ page }) => {
    const spell = page.locator(`${IOP} ${SPELL}`).first();
    const style = await spell.locator("span").last().evaluate((element) => {
      const computed = getComputedStyle(element);
      return { color: computed.color, fontSize: Number.parseFloat(computed.fontSize) };
    });
    expect(style.color, "encre de bois, 8,85:1 sur la planche").toBe(WOOD_INK);
    expect(style.fontSize, "plancher de lisibilité du thème (9 px)").toBeGreaterThanOrEqual(9);
    await expect(page.locator(IOP)).toHaveCSS("background-color", WOOD_FACE);
  });

  test("la feuille et le bouton Créer tiennent dans le viewport", async ({ page }) => {
    await expect(page.locator(SHEET)).toBeVisible();
    await expectInsideViewport(page, SHEET);
    await expectInsideViewport(page, CREATE_BUTTON);
    await expectNoOverlap(page, [[CREATE_BUTTON, `${CARD}:last-of-type`]]);
  });
});
