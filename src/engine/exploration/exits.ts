import type { ExitSpec } from "../../schemas/mapSchema";
import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";

/**
 * Les « soleils » : sortir par un bord d'une carte fait entrer par le bord
 * OPPOSÉ de la destination. Aucun YAML, aucun store ici — que des fonctions
 * pures, testables seules.
 */
export interface MapSize {
  width: number;
  height: number;
}

export type BorderSide = "west" | "east" | "north" | "south";

/** Ce qu'un clic de sortie produit : une case praticable sur la destination. */
export interface Landing {
  position: Position;
  /** `true` quand la case visée était impraticable : le héros a été décalé. */
  relocated: boolean;
}

export interface LandingInput {
  /** Taille de la carte quittée. */
  size: MapSize;
  /** Case de sortie cliquée, donc sur un bord de la carte quittée. */
  pos: Position;
  /** Carte d'arrivée. */
  to: AsciiMap;
  /** Case d'arrivée écrite en donnée ; sans elle, miroir du bord. */
  at?: Position | undefined;
}

const BORDERS: ReadonlyArray<{ side: BorderSide; on: (size: MapSize, pos: Position) => boolean }> = [
  { side: "west", on: (_size, pos) => pos.x <= 0 },
  { side: "east", on: (size, pos) => pos.x >= size.width - 1 },
  { side: "north", on: (_size, pos) => pos.y <= 0 },
  { side: "south", on: (size, pos) => pos.y >= size.height - 1 },
];

function clampAxis(value: number, size: number): number {
  return Math.min(Math.max(value, 0), Math.max(size - 1, 0));
}

const MIRRORED: Record<BorderSide, (to: MapSize, pos: Position) => Position> = {
  west: (to, pos) => ({ x: to.width - 1, y: clampAxis(pos.y, to.height) }),
  east: (to, pos) => ({ x: 0, y: clampAxis(pos.y, to.height) }),
  north: (to, pos) => ({ x: clampAxis(pos.x, to.width), y: to.height - 1 }),
  south: (to, pos) => ({ x: clampAxis(pos.x, to.width), y: 0 }),
};

/** Bord traversé par la sortie ; `null` pour une case intérieure. */
export function borderSide(size: MapSize, pos: Position): BorderSide | null {
  return BORDERS.find((border) => border.on(size, pos))?.side ?? null;
}

/** Bord opposé, calculé sur l'axe du bord traversé — jamais une constante. */
export function mirrorArrival(size: MapSize, pos: Position, to: MapSize): Position {
  const side = borderSide(size, pos);
  if (side === null) return { x: clampAxis(pos.x, to.width), y: clampAxis(pos.y, to.height) };
  return MIRRORED[side](to, pos);
}

function rowCells(map: AsciiMap, y: number): Position[] {
  const row = Array.from({ length: map.width }, (_cell, x) => ({ x, y }));
  return row.filter((cell) => isWalkableCell(map, cell));
}

function walkableCells(map: AsciiMap): Position[] {
  return Array.from({ length: map.height }, (_row, y) => rowCells(map, y)).flat();
}

function distance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Ordre stable (distance, puis y, puis x) : aucune oscillation entre deux cases. */
function byDistance(from: Position) {
  return (a: Position, b: Position) => distance(a, from) - distance(b, from) || a.y - b.y || a.x - b.x;
}

export function nearestWalkable(map: AsciiMap, from: Position): Position | null {
  return walkableCells(map).sort(byDistance(from))[0] ?? null;
}

/** Case d'arrivée : `at` si fourni, sinon miroir, puis repli praticable. */
export function landingFor(input: LandingInput): Landing {
  const wanted = input.at ?? mirrorArrival(input.size, input.pos, input.to);
  const position = nearestWalkable(input.to, wanted) ?? wanted;
  return { position, relocated: !samePosition(position, wanted) };
}

const RELOCATED_LINE = "Sortie noyée : le héros échoue sur la grève la plus proche —";
const DRY_LINE = "Le ressac dépose le héros :";

/**
 * Une ligne de journal par transition. La virgule de deux-points évite toute
 * contraction : « à Le Quai » n'existe pas, et aucune table par carte n'est
 * nécessaire pour le savoir.
 */
export function arrivalLine(destination: string, landing: Landing): string {
  if (landing.relocated) return `${RELOCATED_LINE} ${destination}.`;
  return `${DRY_LINE} ${destination}.`;
}

export function exitAt(exits: readonly ExitSpec[], position: Position): ExitSpec | null {
  return exits.find((exit) => samePosition(exit, position)) ?? null;
}
