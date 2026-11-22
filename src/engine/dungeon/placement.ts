import { manhattan } from "../combatLoop/cells";
import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";

/**
 * Placement d'une salle (5C-d). **Aucun aléa** : l'ordre de parcours de la
 * grille décide, donc deux appels rendent les mêmes cases. Les monstres
 * prennent les cases `M` de la carte (puis les premières cases praticables
 * libres s'ils sont plus nombreux), le héros se place sur la case praticable
 * libre la plus proche du premier monstre : sans déplacement héroïque en 1vN,
 * un héros à l'autre bout de la salle ne pourrait jamais lancer un sort.
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

function nearestFree(map: AsciiMap, origin: Position, taken: readonly Position[]): Position {
  const free = walkableCells(map).filter((cell) => isFree(cell, taken));
  return [...free].sort(byDistanceFrom(origin))[0] ?? origin;
}

/** Placement complet d'une salle : monstres puis héros, sur des cases distinctes. */
export function placeBattle(map: AsciiMap, monsterCount: number): BattlePlacement {
  const monsters = placeMonsters(map, monsterCount);
  const anchor = monsters[0] ?? map.playerSpawns[0] ?? ORIGIN;
  return { hero: nearestFree(map, anchor, monsters), monsters };
}
