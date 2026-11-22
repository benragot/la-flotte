import { firstLine, requireVisible, settles } from "./probe.mjs";
import { SCENE_SETTLE_MS, TURN_SETTLE_MS } from "./session.mjs";
import {
  ARENA,
  ARENA_CANVAS,
  BACKPACK_ITEM,
  BATTLE_PANEL,
  CLASS_CARDS,
  COMBAT_JOURNAL,
  CREATE_BUTTON,
  CREATION_TITLE,
  EXPLORATION_BANNER,
  EXPLORATION_JOURNAL,
  INVENTORY,
  IOP_CARD,
  ITEM_DETAIL,
  SPELLS,
  TURN_BUTTON,
} from "./selectors.mjs";

/** Nom fixe : le rapport devient comparable d'un run à l'autre. */
const HERO_NAME = "Balthazar";

/** Écran de création : comptage des cartes et présence du bouton de création. */
async function creationScreen(session) {
  const { page, baseUrl } = session;
  await page.goto(baseUrl);
  await requireVisible(page, CREATION_TITLE);
  const cards = await page.locator(CLASS_CARDS).count();
  await requireVisible(page, CREATE_BUTTON);
  return { notices: [`${cards} cartes de classe`, "bouton Créer visible"] };
}

/** Création d'un Iop par clic réel : nom + carte + bouton, comme un joueur. */
async function createIop(session) {
  const { page, baseUrl } = session;
  await page.goto(baseUrl);
  await page.getByRole("textbox").fill(HERO_NAME);
  await page.locator(IOP_CARD).click();
  const pressed = await page.locator(IOP_CARD).getAttribute("aria-pressed");
  await page.locator(CREATE_BUTTON).click();
  await requireVisible(page, ARENA);
  return { notices: [`carte Iop aria-pressed=${pressed}`, `héros « ${HERO_NAME} » créé`] };
}

/** Cherche un modèle de scène exposé sur `window` : sinon, le relevé reste DOM. */
async function probeSceneModel(page) {
  const keys = await page.evaluate(() => Object.keys(window).filter((key) => /scene|flotte|pixi/i.test(key)));
  return keys.length === 0 ? "aucun modèle de scène sur window (relevé DOM seul)" : `clés window : ${keys.join(", ")}`;
}

/** Exploration : journal, bandeau, dock et accès ; le canvas doit être monté. */
async function exploration(session) {
  const { page } = session;
  await requireVisible(page, EXPLORATION_JOURNAL);
  await requireVisible(page, EXPLORATION_BANNER);
  await requireVisible(page, ARENA_CANVAS);
  const scene = await probeSceneModel(page);
  return { notices: [scene, "journal, bandeau, dock et boutons d’accès présents"] };
}

async function lastJournalLine(page) {
  const text = await page.locator(COMBAT_JOURNAL).innerText();
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  return lines.at(-1) ?? "(journal vide)";
}

/** Combat 1v1 par `?demo=combat` (dev only), puis fin de tour réelle. */
async function combat1v1(session) {
  const { page, baseUrl } = session;
  await page.goto(`${baseUrl}/?demo=combat`);
  await requireVisible(page, SPELLS);
  const shots = [await session.shot("04-combat-1v1")];
  const before = await lastJournalLine(page);
  await page.locator(TURN_BUTTON).first().click();
  await page.waitForTimeout(TURN_SETTLE_MS);
  shots.push(await session.shot("04b-fin-de-tour"));
  const after = await lastJournalLine(page);
  return { shots, notices: [`journal avant : ${before}`, `journal après fin de tour : ${after}`] };
}

async function roomSummary(page) {
  const panel = page.locator(BATTLE_PANEL);
  const fighters = await panel.locator("li").count();
  const heading = firstLine(await panel.innerText());
  return `${heading} · ${fighters} combattant(s)`;
}

/** Salle de donjon : `?demo=dungeon` ; la fiche `Donjons` est le repli documenté. */
async function dungeonCombat(session) {
  const { page, baseUrl } = session;
  await page.goto(`${baseUrl}/?demo=dungeon`);
  const ready = await settles(() => requireVisible(page, BATTLE_PANEL));
  if (!ready) return skippedDungeon();
  await page.waitForTimeout(SCENE_SETTLE_MS);
  return { notices: ["route ?demo=dungeon (salle 1 de data/dungeons.yaml)", await roomSummary(page)] };
}

function skippedDungeon() {
  return {
    status: "skipped",
    reason: "ni ?demo=dungeon ni la fiche Donjons n’affichent de salle de combat sur ce build",
  };
}

/** Inventaire : ouverture réelle, clic sur un objet, capture du panneau de détail. */
async function inventory(session) {
  const { page, baseUrl } = session;
  await page.goto(baseUrl);
  await requireVisible(page, EXPLORATION_JOURNAL);
  await page.getByRole("button", { name: "Inventaire" }).click();
  await requireVisible(page, INVENTORY);
  const shots = [await session.shot("06-inventaire")];
  const item = page.locator(BACKPACK_ITEM).first();
  const name = firstLine(await item.innerText());
  await item.click();
  await requireVisible(page, ITEM_DETAIL);
  shots.push(await session.shot("06b-detail-objet"));
  const detail = firstLine(await page.locator(ITEM_DETAIL).innerText());
  return { shots, notices: [`objet cliqué : ${name}`, `détail : ${detail}`] };
}

export const STEPS = [
  { id: "01-ecran-creation", title: "Écran de création", run: creationScreen },
  { id: "02-creation-iop", title: "Création d’un Iop", run: createIop },
  { id: "03-exploration", title: "Exploration", run: exploration },
  { id: "04-combat-1v1", title: "Combat 1v1 + fin de tour", run: combat1v1 },
  { id: "05-combat-donjon", title: "Combat de donjon", run: dungeonCombat },
  { id: "06-inventaire", title: "Inventaire et détail d’objet", run: inventory },
];
