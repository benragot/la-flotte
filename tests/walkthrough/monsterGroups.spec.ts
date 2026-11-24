import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { getCell, samePosition } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import type { MapDef } from "../../src/schemas/mapSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * WALKTHROUGH — « une carte, trois ou quatre groupes ».
 *
 * CE QUE CE FICHIER PROUVE : un joueur qui traverse l'archipel par les seules
 * sorties de `data/maps.yaml` trouve **trois ou quatre** groupes sur CHAQUE
 * carte, chacun de 1 à 3 monstres, tous praticables, à distance du héros, hors
 * des sorties, jamais superposés — et la même disposition quand il revient.
 *
 * CE QU'IL NE PROUVE PAS : le respawn après victoire (couvert par
 * `progression.spec.ts`), le déplacement des groupes, ni le rendu.
 */
const maps = parseMapsYaml(readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8"));

/** Marge minimale au héros : trois cases, sinon le combat s'ouvre au chargement. */
const MIN_HERO_GAP = 3;

function mapById(id: string): MapDef {
  const found = maps.find((map) => map.id === id);
  if (found === undefined) throw new Error(`${id} absente de data/maps.yaml`);
  return found;
}

function exploration() {
  const state = useCombatStore.getState();
  if (state.exploration === null) throw new Error("exploration attendue");
  return { state, map: mapById(state.mapId), scene: state.exploration };
}

function gap(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Journalise la carte courante et vérifie les cinq interdits + la taille. */
function visitMap(): { mapId: string; count: number; positions: Position[] } {
  const { map, scene } = exploration();
  const groups = scene.monsterGroups;
  expect(groups.length).toBeGreaterThanOrEqual(3);
  expect(groups.length).toBeLessThanOrEqual(4);
  groups.forEach((group) => {
    const cell = getCell(scene.map, group.pos);
    expect(cell === "#" || cell === "~").toBe(false);
    expect(group.monsterIds.length).toBeGreaterThanOrEqual(1);
    expect(group.monsterIds.length).toBeLessThanOrEqual(3);
    expect(gap(group.pos, scene.playerPos)).toBeGreaterThanOrEqual(MIN_HERO_GAP);
    expect(samePosition(group.pos, scene.playerPos)).toBe(false);
    expect(map.exits.some((exit) => samePosition(exit, group.pos))).toBe(false);
  });
  const keys = new Set(groups.map((group) => `${group.pos.x},${group.pos.y}`));
  expect(keys.size).toBe(groups.length);
  return { mapId: map.id, count: groups.length, positions: groups.map((group) => group.pos) };
}

function clickCell(cell: Position): void {
  useCombatStore.getState().clickCell(cell);
}

/** Sortie de la carte courante vers une carte pas encore visitée. */
function exitAwayFrom(visited: readonly string[]): Position {
  const { map } = exploration();
  const exit = map.exits.find((candidate) => !visited.includes(candidate.to));
  if (exit === undefined) throw new Error(`${map.id} ne mène plus nulle part`);
  return { x: exit.x, y: exit.y };
}

/** Sortie de la carte courante qui ramène sur `target`. */
function exitTo(target: string): Position {
  const { map } = exploration();
  const exit = map.exits.find((candidate) => candidate.to === target);
  if (exit === undefined) throw new Error(`${map.id} ne mène pas à ${target}`);
  return { x: exit.x, y: exit.y };
}

/** Chaîne de sorties depuis la carte courante jusqu'à `target`. */
function routeFrom(startId: string, target: string): MapDef[] {
  const queue: MapDef[][] = [[mapById(startId)]];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const route = queue.shift() ?? [];
    const last = route[route.length - 1];
    if (last === undefined) continue;
    if (last.id === target) return route;
    if (visited.has(last.id)) continue;
    visited.add(last.id);
    last.exits.forEach((exit) => queue.push([...route, mapById(exit.to)]));
  }
  throw new Error(`${target} est injoignable depuis ${startId}`);
}

/** Le joueur rejoint `target` à pied, par les seules sorties de la donnée. */
function travelTo(target: string): void {
  const { mapId } = useCombatStore.getState();
  const route = routeFrom(mapId, target);
  for (let index = 0; index < route.length - 1; index += 1) {
    const from = route[index];
    const to = route[index + 1];
    if (from === undefined || to === undefined) throw new Error("trajet incomplet");
    const exit = from.exits.find((candidate) => candidate.to === to.id);
    if (exit === undefined) throw new Error(`${from.id} ne mène pas à ${to.id}`);
    clickCell({ x: exit.x, y: exit.y });
    expect(useCombatStore.getState().mapId).toBe(to.id);
  }
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  useCombatStore.getState().startExploration();
});

describe("walkthrough — trois à quatre groupes sur chaque carte de l'archipel", () => {
  it("traverse plage → quai → cale et compte les groupes de chacune", () => {
    const plage = visitMap();
    clickCell(exitAwayFrom([plage.mapId]));
    const quai = visitMap();
    clickCell(exitAwayFrom([plage.mapId, quai.mapId]));
    const cale = visitMap();
    expect(new Set([plage.mapId, quai.mapId, cale.mapId]).size).toBe(3);
  });
});

describe("walkthrough — la disposition d'une carte ne bouge pas", () => {
  it("retrouve les mêmes groupes en revenant sur le quai", () => {
    const plage = visitMap();
    clickCell(exitAwayFrom([plage.mapId]));
    const quai = visitMap();
    clickCell(exitAwayFrom([plage.mapId, quai.mapId]));
    clickCell(exitTo(quai.mapId));
    const back = visitMap();
    expect(back.mapId).toBe(quai.mapId);
    expect(back.positions).toEqual(quai.positions);
    expect(back.count).toBe(quai.count);
  });
});

/**
 * Bug 7 — sur le quai et la cale, cliquer un monstre ne faisait RIEN : le 1v1
 * cherchait une case `M` absente de ces grilles et levait une exception. Le
 * joueur doit pouvoir cliquer n'importe quel groupe, sur n'importe quelle carte.
 */
describe("walkthrough — cliquer un monstre engage le combat partout", () => {
  for (const target of ["ferraille_plage_01", "ferraille_quai_02", "ferraille_cale_03"]) {
    it(`engage le combat sur ${target}`, () => {
      travelTo(target);
      const { map, scene } = exploration();
      const group = scene.monsterGroups[0];
      if (group === undefined) throw new Error(`aucun groupe sur ${map.id}`);
      clickCell(group.pos);
      const { mode, combat, mapId } = useCombatStore.getState();
      const enemy = combat?.enemy.position ?? { x: -1, y: -1 };
      expect(mode).toBe("combat");
      expect(mapId).toBe(target);
      expect(combat?.enemy.name).toBe((group.label.split(" · ")[0] ?? "").trim());
      expect(getCell(scene.map, enemy)).not.toBe("#");
      expect(getCell(scene.map, enemy)).not.toBe("~");
      expect(samePosition(enemy, scene.playerPos)).toBe(false);
    });
  }
});
