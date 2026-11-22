import { manhattan } from "../combatLoop/cells";
import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";

/**
 * Placement d'une salle (5C-d/5C-e). **Aucun aléa** : l'ordre de parcours de la
 * grille décide, donc deux appels rendent les mêmes cases. Placement fidèle à
 * la carte : monstres sur les cases `M`, héros sur la première case `P`. Sans
 * `P`, le héros prend la case praticable libre la **plus éloignée** des `M`.
 * L'approche est ensuite le travail de `spellStrategy` (`kind: "move"`) : le
 * placement ne fabrique pas une mêlée de départ.
 */
export interface BattlePlacement {
  hero: Position;
  monsters: Position[];
}

const ORIGIN: Position = { x: 0, y: 0 };

function rowCells(map: AsciiMap, y: number): Position[] {
  const xs = Array.from({ length: map.width }, (_, x) => ({ x, y }));
  return xs.filter((cell) => isWalkableCell(map, cell));
}

/** Toutes les cases praticables, parcours en lecture (y puis x). */
function walkableCells(map: AsciiMap): Position[] {
  const rows = Array.from({ length: map.height }, (_, y) => y);
  return rows.flatMap((y) => rowCells(map, y));
}

function isFree(position: Position, taken: readonly Position[]): boolean {
  return !taken.some((cell) => samePosition(cell, position));
}

/** Cases `M` d'abord (ordre du parseur), puis le reste de la grille en lecture. */
function candidateCells(map: AsciiMap): Position[] {
  const spawns = map.monsterSpawns.filter((cell) => isWalkableCell(map, cell));
  const rest = walkableCells(map).filter((cell) => isFree(cell, spawns));
  return [...spawns, ...rest];
}

function placeMonsters(map: AsciiMap, count: number): Position[] {
  return candidateCells(map).slice(0, count);
}

function byDistanceFrom(origin: Position): (a: Position, b: Position) => number {
  return (a, b) => manhattan(origin, a) - manhattan(origin, b) || a.y - b.y || a.x - b.x;
}

/** Repli : la case libre la plus loin du premier monstre (départage en lecture). */
function farthestFree(map: AsciiMap, monsters: readonly Position[]): Position {
  const origin = monsters[0] ?? map.playerSpawns[0] ?? ORIGIN;
  const free = walkableCells(map).filter((cell) => isFree(cell, monsters));
  const ranked = free.sort(byDistanceFrom(origin));
  return ranked[ranked.length - 1] ?? origin;
}

/** Case du héros : la première `P` de la carte, sinon le repli le plus éloigné. */
function heroCell(map: AsciiMap, monsters: readonly Position[]): Position {
  const spawn = map.playerSpawns[0];
  if (spawn !== undefined && isFree(spawn, monsters)) return spawn;
  return farthestFree(map, monsters);
}

/** Placement complet d'une salle : monstres puis héros, sur des cases distinctes. */
export function placeBattle(map: AsciiMap, monsterCount: number): BattlePlacement {
  const monsters = placeMonsters(map, monsterCount);
  return { hero: heroCell(map, monsters), monsters };
}
