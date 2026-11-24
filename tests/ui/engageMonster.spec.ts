import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createSeededRng, initExploration, seedForMap } from "../../src/engine/exploration";
import type { MonsterGroup } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import type { MapDef } from "../../src/schemas/mapSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import { ARENA, createHero } from "./helpers";

/**
 * Bug 7 — « sur quai 02 ou 03, je peux pas cliquer sur les monstres ».
 * Ce spec entre en jeu par le formulaire, rejoint CHAQUE carte de la Ferraille
 * par les seules sorties de `data/maps.yaml`, calcule la case des groupes avec
 * la MÊME graine et la MÊME projection que le jeu, puis clique le monstre :
 * l'ordre de jeu doit apparaître. Aucune spec existante n'est touchée.
 */
const maps = parseMapsYaml(readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8"));
const monsters = parseMonstersYaml(readFileSync(join(process.cwd(), "data", "monsters.yaml"), "utf8"));
const zones = parseSpawnsYaml(readFileSync(join(process.cwd(), "data", "spawns.yaml"), "utf8"));

/** Observables stables : l'ordre de jeu et le bandeau n'existent QU'EN combat. */
const COMBAT_ORDER = 'aside[aria-label="Ordre de jeu"]';
const FERRAILLE = ["ferraille_plage_01", "ferraille_quai_02", "ferraille_cale_03"] as const;

function mustMap(id: string): MapDef {
  const found = maps.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absente de data/maps.yaml`);
  return found;
}

function mustMonster(monsterId: string) {
  const found = monsters.find((entry) => entry.id === monsterId);
  if (found === undefined) throw new Error(`${monsterId} absent de data/monsters.yaml`);
  return found;
}

/** Même graine ET même plan que `arrivalExploration` : la disposition réelle. */
function expectedGroups(mapId: string): MonsterGroup[] {
  const def = mustMap(mapId);
  const zone = zones.find((entry) => entry.mapId === mapId) ?? zones[0];
  if (zone === undefined) throw new Error("data/spawns.yaml ne déclare aucune zone");
  const roster = zone.monsters.map((entry) => ({
    monsterId: entry.monsterId,
    monsterName: mustMonster(entry.monsterId).name,
    level: mustMonster(entry.monsterId).level,
    weight: entry.weight,
  }));
  const first = roster[0];
  if (first === undefined) throw new Error(`zone ${zone.id} sans monstre`);
  const plan = { groups: zone.groups, members: zone.members, roster };
  const options = { map: parseAsciiMap(def.grid), ...first, plan, rng: createSeededRng(seedForMap(mapId)) };
  return initExploration({ ...options, safeCells: def.exits }).monsterGroups;
}

/** Centre pixel d'une case, via la projection exacte du jeu. */
async function clickCell(page: Page, def: MapDef, cell: Position): Promise<void> {
  const box = await page.locator(ARENA).boundingBox();
  if (box === null) throw new Error("Zone jouable sans rectangle");
  const origin = sceneOrigin({ width: def.width, height: def.height }, { width: box.width, height: box.height });
  const pixel = gridToIso({ ...cell, origin });
  await page.mouse.click(box.x + pixel.x, box.y + pixel.y);
}

/** Trajet par les sorties réelles : chaque saut est vérifié par le bandeau. */
async function travelThrough(page: Page, route: readonly MapDef[]): Promise<void> {
  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    if (from === undefined || to === undefined) throw new Error("trajet incomplet");
    const exit = from.exits.find((candidate) => candidate.to === to.id);
    if (exit === undefined) throw new Error(`${from.id} ne mène pas à ${to.id}`);
    await clickCell(page, from, { x: exit.x, y: exit.y });
    await expect(page.getByText(`Carte ${to.id}`)).toBeVisible();
  }
}

/** Chemin de sorties depuis la carte de départ (`data/maps.yaml`) jusqu'à `target`. */
function routeTo(target: string): MapDef[] {
  const start = maps[0];
  if (start === undefined) throw new Error("data/maps.yaml ne déclare aucune carte");
  const queue: MapDef[][] = [[start]];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const route = queue.shift() ?? [];
    const last = route[route.length - 1];
    if (last === undefined) continue;
    if (last.id === target) return route;
    if (visited.has(last.id)) continue;
    visited.add(last.id);
    last.exits.forEach((exit) => queue.push([...route, mustMap(exit.to)]));
  }
  throw new Error(`${target} est injoignable depuis ${start.id}`);
}

for (const mapId of FERRAILLE) {
  test.describe(`engagement — ${mapId}`, () => {
    test("un clic sur un monstre ouvre le combat", async ({ page }) => {
      await createHero(page);
      await travelThrough(page, routeTo(mapId));
      const group = expectedGroups(mapId)[0];
      if (group === undefined) throw new Error(`aucun groupe attendu sur ${mapId}`);
      await clickCell(page, mustMap(mapId), group.pos);
      await expect(page.locator(COMBAT_ORDER)).toBeVisible();
      await expect(page.locator(COMBAT_ORDER)).toContainText(mustMonster(group.monsterIds[0] ?? "").name);
      await expect(page.getByText(`Carte ${mapId} · Tour 1`)).toBeVisible();
    });
  });
}
