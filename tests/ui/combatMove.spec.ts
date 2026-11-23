import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { GridSize } from "../../src/renderer/gridProjection";
import { gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";

/**
 * Le moteur savait bouger depuis la PR précédente, mais aucun clic ne l'appelait :
 * le héros restait immobile en combat. Ces tests cliquent le **canvas** de la
 * salle de donjon (`?demo=dungeon`) et lisent `data-hero-cell`, la position
 * logique immédiate dont dépendent les tests navigateur.
 *
 * Les cases attendues sont calculées depuis `data/*.yaml` : la carte donne le
 * `P` de départ, la fiche du combattant donne les PM. Aucune coordonnée métier
 * n'est recopiée ici, aucune tolérance n'est élargie.
 */
const ARENA = 'main[aria-label="Terrain de combat"]';
const ROOM_PANEL = 'section[aria-label="Combat de salle"]';
const ACTIVE = `${ROOM_PANEL} header p`;
const HERO_CARD = 'li[aria-label="Combattant Balthazar"] p';
const BATTLE_LOG = 'ul[aria-label="Journal du combat"]';
const HERO_NAME = "Balthazar";

interface Cell {
  x: number;
  y: number;
}

interface RoomMap {
  size: GridSize;
  grid: readonly string[];
  hero: Cell;
}

function read(file: string): string {
  return readFileSync(join(process.cwd(), "data", file), "utf8");
}

function cellsOf(grid: readonly string[], symbol: string): Cell[] {
  const cells: Cell[] = [];
  grid.forEach((row, y) => [...row].forEach((char, x) => {
    if (char === symbol) cells.push({ x, y });
  }));
  return cells;
}

/** Première salle du premier donjon : exactement ce que monte `?demo=dungeon`. */
function readFirstRoom(): RoomMap {
  const dungeon = parseDungeonsYaml(read("dungeons.yaml"))[0];
  const room = dungeon?.rooms[0];
  if (room === undefined) throw new Error("data/dungeons.yaml ne déclare aucune salle");
  const map = parseMapsYaml(read("maps.yaml")).find((entry) => entry.id === room.mapId);
  if (map === undefined) throw new Error(`Carte introuvable : ${room.mapId}`);
  const hero = cellsOf(map.grid, "P")[0];
  if (hero === undefined) throw new Error(`Symbole « P » absent de ${map.id}`);
  return { size: { width: map.width, height: map.height }, grid: map.grid, hero };
}

/** Cases libres à l'est du héros ; échoue bruyamment si la donnée ne les offre plus. */
function eastRun(room: RoomMap, steps: number): Cell[] {
  const row = room.grid[room.hero.y] ?? "";
  const cells = Array.from({ length: steps }, (_, index) => ({ x: room.hero.x + index + 1, y: room.hero.y }));
  const free = cells.every((cell) => row[cell.x] === ".");
  if (!free) throw new Error(`La rangée du héros n'offre pas ${steps} cases libres à l'est`);
  return cells;
}

function label(cell: Cell): string {
  return `${cell.x},${cell.y}`;
}

function cellCenter(cell: Cell, size: GridSize, viewport: GridSize) {
  return gridToIso({ ...cell, origin: sceneOrigin(size, viewport) });
}

async function openRoom(page: Page): Promise<void> {
  await page.goto("/?demo=dungeon");
  await expect(page.locator(ROOM_PANEL)).toBeVisible();
  await expect(page.locator(ARENA)).toBeVisible();
}

/** La timeline démarre sur l'initiative la plus haute : « Terminer le tour » rend la main au héros. */
async function giveHeroHand(page: Page): Promise<void> {
  const active = page.locator(ACTIVE);
  const text = (await active.textContent()) ?? "";
  if (!text.includes(HERO_NAME)) await page.getByRole("button", { name: "Terminer le tour" }).click();
  await expect(active).toContainText(HERO_NAME, { timeout: 15_000 });
}

async function heroMp(page: Page): Promise<number> {
  const text = (await page.locator(HERO_CARD).textContent()) ?? "";
  const match = /(\d+) PM/.exec(text);
  if (match === null) throw new Error(`PM illisibles dans « ${text} »`);
  return Number(match[1]);
}

async function heroAp(page: Page): Promise<number> {
  const text = (await page.locator(HERO_CARD).textContent()) ?? "";
  const match = /(\d+) PA/.exec(text);
  if (match === null) throw new Error(`PA illisibles dans « ${text} »`);
  return Number(match[1]);
}

async function clickCell(page: Page, cell: Cell, size: GridSize): Promise<void> {
  const arena = page.locator(ARENA);
  const box = await arena.boundingBox();
  if (box === null) throw new Error("Zone jouable sans rectangle");
  const pixel = cellCenter(cell, size, { width: box.width, height: box.height });
  await page.mouse.click(box.x + pixel.x, box.y + pixel.y);
}

/** Salle ouverte, main au héros, et position de départ vérifiée avant tout clic. */
async function startBattle(page: Page): Promise<RoomMap> {
  const room = readFirstRoom();
  await openRoom(page);
  await giveHeroHand(page);
  await expect(page.locator(ARENA)).toHaveAttribute("data-hero-cell", label(room.hero));
  return room;
}

test.describe("combat de salle — le clic déplace le héros", () => {
  test("une case libre à portée de PM change la case du héros", async ({ page }) => {
    const room = await startBattle(page);
    const ap = await heroAp(page);
    const target = eastRun(room, 2)[1];
    if (target === undefined) throw new Error("case cible absente");
    await clickCell(page, target, room.size);
    await expect(page.locator(ARENA)).toHaveAttribute("data-hero-cell", label(target));
    // Une case vide ne lance ni sort ni attaque : les PA du héros sont intacts.
    await expect(page.locator(HERO_CARD)).toContainText(`${ap} PA`);
  });

  test("une case trop loin fait avancer jusqu'à la dernière case payable", async ({ page }) => {
    const room = await startBattle(page);
    const mp = await heroMp(page);
    const far = eastRun(room, 8)[7];
    if (far === undefined || mp >= 8) throw new Error("clic « trop loin » mal calibré");
    await clickCell(page, far, room.size);
    const expected = { x: room.hero.x + mp, y: room.hero.y };
    await expect(page.locator(ARENA)).toHaveAttribute("data-hero-cell", label(expected));
  });

  test("un clic sur le jeton du héros ne déplace ni n'attaque", async ({ page }) => {
    const room = await startBattle(page);
    const log = page.locator(BATTLE_LOG);
    const before = (await log.textContent()) ?? "";
    // Le jeton du héros est la seule case occupée dont la position est certaine :
    // les monstres ont déjà bougé avant la main du héros.
    await clickCell(page, room.hero, room.size);
    await expect(page.locator(ARENA)).toHaveAttribute("data-hero-cell", label(room.hero));
    await expect(log).toHaveText(before);
  });
});
