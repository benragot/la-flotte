import type { AsciiMap, Position } from "../engine/grid";
import { findPath, getCell, pathCost, samePosition } from "../engine/grid";
import type { CellType } from "../schemas/mapSchema";
import type { IsoOrigin, PixelPoint } from "./gridProjection";
import { gridToIso } from "./gridProjection";

export interface PathPreviewInput {
  map: AsciiMap;
  from: Position;
  to: Position;
  maxPm: number;
  occupied?: Position[];
}

/** Motif déterministe d'un chemin refusé, énuméré dans l'ordre de priorité réel. */
export type BlockReason = "occupied" | "wall" | "water" | "range";

export interface PathPreview {
  reachable: boolean;
  path: Position[];
  /** Coût en PM facturé par `pathCost` (1 orthogonal, 2 diagonal), 0 si inatteignable. */
  cost: number;
  blockedBy: BlockReason | null;
  remainingPm: number;
}

export interface PathCentersInput {
  path: readonly Position[];
  origin: IsoOrigin;
}

function isOccupied(target: Position, occupied: readonly Position[] | undefined): boolean {
  return (occupied ?? []).some((cell) => samePosition(cell, target));
}

function cellReason(cell: CellType | undefined): BlockReason | null {
  if (cell === "#") return "wall";
  if (cell === "~") return "water";
  return null;
}

/**
 * Motif rattaché à une case, dans l'ordre `occupied → wall → water`.
 * Hors carte (`getCell` indéfini) = terrain infranchissable, assimilé à un mur.
 * `null` = case franchissable.
 */
function terrainReason(input: PathPreviewInput, position: Position): BlockReason | null {
  if (isOccupied(position, input.occupied)) return "occupied";
  const cell = getCell(input.map, position);
  if (cell === undefined) return "wall";
  return cellReason(cell);
}

/**
 * Cause du refus : la case de départ d'abord (départ sur un mur, dans l'eau, hors
 * carte ou occupé), puis la cible. `"range"` couvre tout le reste : dépassement
 * des PM **et** cible enclavée qu'aucun chemin ne peut atteindre.
 */
function blockedReason(input: PathPreviewInput): BlockReason {
  return terrainReason(input, input.from) ?? terrainReason(input, input.to) ?? "range";
}

function reached(path: Position[], maxPm: number): PathPreview {
  const cost = pathCost(path);
  return { reachable: true, path, cost, blockedBy: null, remainingPm: maxPm - cost };
}

function unreachable(input: PathPreviewInput): PathPreview {
  return { reachable: false, path: [], cost: 0, blockedBy: blockedReason(input), remainingPm: input.maxPm };
}

function isStartBlocked(input: PathPreviewInput): boolean {
  return terrainReason(input, input.from) !== null;
}

/**
 * Aperçu de déplacement : A* du moteur réutilisé tel quel, aucune formule recopiée.
 * Un départ non franchissable est refusé sans lancer la recherche (aucun throw).
 */
export function buildPathPreview(input: PathPreviewInput): PathPreview {
  const path = isStartBlocked(input) ? null : findPath(input);
  return path === null ? unreachable(input) : reached(path, input.maxPm);
}

/** Centres iso des cases du chemin, projetés par `gridToIso`. */
export function pathIsoCenters(input: PathCentersInput): PixelPoint[] {
  return input.path.map((position) => gridToIso({ ...position, origin: input.origin }));
}
