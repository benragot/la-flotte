import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  ARENA,
  TOLERANCE_PX,
  boxOf,
  createHero,
  expectCenteredIn,
  expectCoverage,
  expectFlushWithViewportBottom,
  expectInsideViewport,
  expectNoOverlap,
  expectVerticallyAdjacent,
} from "./helpers";

/**
 * Garde-fous de mise en page : `jsdom` renvoie des rectangles à zéro, donc ces
 * superpositions n'étaient visibles que dans un vrai navigateur. Les sélecteurs
 * reposent sur les rôles et les libellés accessibles, jamais sur `data-testid`.
 */
const CREATION_SHEET = 'section[aria-label="Création de personnage"]';
const CREATION_TITLE = `${CREATION_SHEET} h1`;
const CLASS_CARD = `${CREATION_SHEET} button[aria-pressed]`;
const CREATE_BUTTON = `${CREATION_SHEET} button:has-text("Créer")`;

const EXPLORATION_BANNER = 'header:has-text("Mode Exploration")';
/** Colonne gauche de l'exploration (#51) : le journal n'est plus dans le dock. */
const EXPLORATION_JOURNAL = 'aside[aria-label="Journal d’exploration"]';
const COMBAT_JOURNAL = 'section[aria-label="Journal de combat"]';
/** Fiche d'entrée de donjon (5D-a), atteinte sans `?demo=`. */
const DUNGEON_ENTRY_BUTTON = 'button:has-text("Donjons")';
const DUNGEON_ENTRY_SHEET = 'section[aria-label="Donjons disponibles"]';

const VITALS = 'section[aria-label="Ressources du héros"]';
/** Le HUD 1.29 n'écrit pas « PA » : la rangée PV/PA/PM est le premier bloc de la section. */
const PA_PM_ROW = `${VITALS} > div`;
const TURN_BUTTON = 'button:has-text("Passer")';
const SPELLS = 'section[aria-label="Sorts disponibles"]';
const TIMELINE = 'aside[aria-label="Ordre de jeu"]';
const TIMELINE_FIRST = `${TIMELINE} article:first-child`;
const TIMELINE_LAST = `${TIMELINE} article:last-child`;
const BATTLE_PANEL = 'section[aria-label="Combat de salle"]';
/** Bande d'initiative (COMBAT-05) : mêmes jetons que le panneau, aucune palette neuve. */
const INITIATIVE_BAND = `${BATTLE_PANEL} [aria-label="Ordre d’initiative"]`;
/** Liste des combattants : `ul` seule, la bande est un `ol`. */
const COMBATANT_LIST = `${BATTLE_PANEL} ul`;
const END_TURN = `${BATTLE_PANEL} button:has-text("Terminer le tour")`;
/** Journal du combat rendu dans le panneau, distinct du journal d'exploration. */
const COMBAT_LOG = `${BATTLE_PANEL} ul[aria-label="Journal du combat"]`;
/** UI-05 : colonne de 320 px, tolérance de 40 px pour un futur élargissement mesuré. */
const PANEL_COLUMN_MAX = 360;

/** Zone jouable mesurée seule : c'est elle qui doit être centrée, pas la page. */
const ARENA_SECTION = 'section[aria-label="Zone jouable"]';
const ARENA_CANVAS = `${ARENA} canvas`;
/** Dock d'exploration : seul contenu du conteneur de HUD, donc sa hauteur. */
const HERO_DOCK = '[role="group"][aria-label="Dock du héros"]';

/**
 * Seuil couverture du canvas : il doit remplir sa section. 95 % laisse passer
 * un liseré d'arrondi de 1-2 px sans autoriser un cadre vide.
 */
const CANVAS_COVERAGE = 0.95;

test.describe("création de personnage", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("le titre du jeu ne recouvre pas les cartes de classe", async ({ page }) => {
    await expect(page.locator(CREATION_TITLE)).toHaveText("Crée ton héros");
    await expectNoOverlap(page, [[CREATION_TITLE, CLASS_CARD]]);
  });

  test("le bouton Créer ne recouvre pas la dernière carte de classe", async ({ page }) => {
    await expectNoOverlap(page, [[CREATE_BUTTON, `${CLASS_CARD}:last-of-type`]]);
    await expectInsideViewport(page, CREATE_BUTTON);
  });
});

test.describe("exploration", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
  });

  test("le journal de la colonne gauche ne recouvre pas l'arène", async ({ page }) => {
    await expectNoOverlap(page, [[EXPLORATION_JOURNAL, ARENA]]);
    await expectInsideViewport(page, EXPLORATION_JOURNAL);
  });

  test("le bandeau de mode ne recouvre pas le journal et tient dans le viewport", async ({ page }) => {
    await expect(page.locator(EXPLORATION_BANNER)).toContainText("La Flotte");
    await expectNoOverlap(page, [[EXPLORATION_BANNER, EXPLORATION_JOURNAL]]);
    await expectInsideViewport(page, EXPLORATION_BANNER);
  });

  test("le bandeau d'exploration et le panneau de salle ne coexistent jamais", async ({ page }) => {
    await expect(page.locator(EXPLORATION_BANNER)).toBeVisible();
    await expect(page.locator(BATTLE_PANEL)).toHaveCount(0);
  });

  test("la fiche d'entrée de donjon tient dans le viewport avec son bouton Entrer", async ({ page }) => {
    await page.locator(DUNGEON_ENTRY_BUTTON).click();
    await expect(page.locator(DUNGEON_ENTRY_SHEET)).toBeVisible();
    await expectInsideViewport(page, DUNGEON_ENTRY_SHEET);
    await expectInsideViewport(page, `${DUNGEON_ENTRY_SHEET} button:has-text("Entrer")`);
  });
});

/**
 * Mesure la boîte DOM du canvas (100 % de la section), lue dans le **même**
 * `evaluate` que sa section et seulement après deux relevés identiques : la
 * mesure porte sur un layout arrêté, jamais sur le canvas 1×1 du premier paint.
 * L'image iso dessinée DEDANS — origine `centeredOrigin`, échelle cover — n'est
 * PAS couverte ici : voir la PR `src/renderer` / dette D44.
 */
test.describe("géométrie de l'arène", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
  });

  test("le canvas occupe toute la zone jouable", async ({ page }) => {
    await expectCenteredIn(page, ARENA_CANVAS, ARENA_SECTION);
  });

  test("le canvas remplit la surface de la zone jouable", async ({ page }) => {
    await expectCoverage(page, ARENA_CANVAS, ARENA_SECTION, CANVAS_COVERAGE);
  });

  test("l'arène et le dock du héros sont contigus : aucune bande morte", async ({ page }) => {
    await expect(page.locator(HERO_DOCK)).toBeVisible();
    await expectVerticallyAdjacent(page, ARENA_SECTION, HERO_DOCK);
    await expectFlushWithViewportBottom(page, HERO_DOCK);
  });
});

test.describe("combat 1v1", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(SPELLS)).toBeVisible();
  });

  test("le bouton de fin de tour ne recouvre pas les PA/PM", async ({ page }) => {
    await expectNoOverlap(page, [[PA_PM_ROW, TURN_BUTTON]]);
  });

  test("le nom du monstre et ses PV ne sont pas masqués par le panneau Sorts", async ({ page }) => {
    await expect(page.locator(TIMELINE_LAST)).toBeVisible();
    await expectNoOverlap(page, [
      [TIMELINE_LAST, SPELLS],
      [TIMELINE_FIRST, SPELLS],
    ]);
  });

  test("le journal ne recouvre pas la barre de sorts", async ({ page }) => {
    await expectNoOverlap(page, [
      [COMBAT_JOURNAL, SPELLS],
      [COMBAT_JOURNAL, VITALS],
    ]);
  });

  test("l'ordre de jeu reste lisible et dans le viewport", async ({ page }) => {
    await expectNoOverlap(page, [[TIMELINE_FIRST, TIMELINE_LAST]]);
    await expectInsideViewport(page, TIMELINE);
    await expectNoOverlap(page, [[TIMELINE, ARENA]]);
  });
});

test.describe("combat de salle (donjon)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=dungeon");
    await expect(page.locator(BATTLE_PANEL)).toBeVisible();
  });

  test("le panneau de salle et ses combattants tiennent dans le viewport", async ({ page }) => {
    await expectInsideViewport(page, BATTLE_PANEL);
    await expectInsideViewport(page, `${COMBATANT_LIST} > li:last-child`);
  });

  test("la bande d'initiative tient dans le panneau sans repousser la fin de tour", async ({ page }) => {
    await expect(page.locator(INITIATIVE_BAND)).toBeVisible();
    await expect(page.locator(`${INITIATIVE_BAND} > li`)).toHaveCount(4);
    await expect(page.locator(`${INITIATIVE_BAND} [aria-current="true"]`)).toHaveCount(1);
    await expectInsideViewport(page, INITIATIVE_BAND);
    await expectInsideViewport(page, END_TURN);
    await expectInsideViewport(page, `${COMBATANT_LIST} > li:last-child`);
    await expectNoOverlap(page, [
      [INITIATIVE_BAND, `${COMBATANT_LIST} > li:first-child`],
      [INITIATIVE_BAND, END_TURN],
      [COMBATANT_LIST, END_TURN],
    ]);
    const scrolls = await page.evaluate((selector) => {
      const panel = document.querySelector(selector);
      const pageScroll = document.documentElement.scrollHeight > window.innerHeight + 1;
      return pageScroll || (panel !== null && panel.scrollHeight > panel.clientHeight + 1);
    }, BATTLE_PANEL);
    expect(scrolls).toBe(false);
  });

  test("le bandeau d'exploration ne peut plus être recouvert par le panneau de salle", async ({ page }) => {
    await expect(page.locator(BATTLE_PANEL)).toBeVisible();
    await expect(page.locator(EXPLORATION_BANNER)).toHaveCount(0);
  });
});

/** Ouvre la salle de donjon : le panneau de salle y est monté par `?demo=dungeon`. */
async function openDungeonRoom(page: Page): Promise<void> {
  await page.goto("/?demo=dungeon");
  await expect(page.locator(BATTLE_PANEL)).toBeVisible();
}

/**
 * UI-05 — le panneau de salle recouvrait l'arène (combattant invisible, cases
 * non cliquables). Ces mesures comparent les rectangles DOM du panneau, de la
 * section jouable et du canvas, aux trois viewports des projets Playwright :
 * une colonne en flux ne recouvre aucune case, un overlay absolu si.
 */
test.describe("combat de salle — panneau dans le flux (UI-05)", () => {
  test.beforeEach(async ({ page }) => {
    await openDungeonRoom(page);
  });

  test("aucune case cliquable de l'arène n'est sous le panneau", async ({ page }) => {
    await expectNoOverlap(page, [
      [BATTLE_PANEL, ARENA_SECTION],
      [BATTLE_PANEL, ARENA],
    ]);
  });

  test("le panneau réserve une colonne contiguë à l'arène, bornée par le viewport", async ({ page }) => {
    const panel = await boxOf(page, BATTLE_PANEL);
    const arena = await boxOf(page, ARENA_SECTION);
    const viewport = page.viewportSize() ?? { width: 0, height: 0 };
    const gap = Math.min(
      Math.abs(panel.x - (arena.x + arena.width)),
      Math.abs(arena.x - (panel.x + panel.width)),
    );
    expect(gap, "colonne contiguë : aucune case entre elle et l'arène").toBeLessThanOrEqual(TOLERANCE_PX);
    expect(panel.width, "largeur de la colonne réservée").toBeLessThanOrEqual(PANEL_COLUMN_MAX);
    expect(panel.y, "colonne posée dans le flux").toBeGreaterThanOrEqual(-TOLERANCE_PX);
    expect(panel.y + panel.height, "colonne dans le viewport").toBeLessThanOrEqual(viewport.height + TOLERANCE_PX);
  });

  test("le panneau n'est jamais repositionné en overlay absolu", async ({ page }) => {
    const position = await page.locator(BATTLE_PANEL).evaluate((panel) => getComputedStyle(panel).position);
    expect(["absolute", "fixed"], "le panneau doit rester dans le flux").not.toContain(position);
  });
});

/** Les zones du panneau (initiative, combattants, journal, fin de tour) restent lisibles. */
test.describe("combat de salle — zones du panneau (UI-05)", () => {
  test.beforeEach(async ({ page }) => {
    await openDungeonRoom(page);
  });

  test("le panneau et ses zones restent lisibles sans scroll", async ({ page }) => {
    for (const selector of [INITIATIVE_BAND, COMBATANT_LIST, COMBAT_LOG, END_TURN]) {
      await expectInsideViewport(page, selector);
    }
    const overflow = await page.locator(BATTLE_PANEL).evaluate((panel) => ({
      pageScroll: document.documentElement.scrollHeight > window.innerHeight + 1,
      panelScroll: panel.scrollHeight > panel.clientHeight + 1,
    }));
    expect(overflow.pageScroll, "aucun scroll de page").toBe(false);
    expect(overflow.panelScroll, "aucun scroll interne du panneau").toBe(false);
  });
});
