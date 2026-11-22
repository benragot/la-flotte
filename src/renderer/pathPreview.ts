import type { AsciiMap, Position } from "../engine/grid";
import { findPath, getCell, samePosition } from "../engine/grid";
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

/** Motif déterministe d'un chemin refusé, dans cet ordre de priorité. */
export type BlockReason = "wall" | "water" | "occupied" | "range";

export interface PathPreview {
  reachable: boolean;
  path: Position[];
  /** Cases réellement consommées (`path.length - 1`), 0 si inatteignable. */
  cost: number;
  blockedBy: BlockReason | null;
  remainingPm: number;
}

export interface PathCentersInput {
  path: readonly Position[];
  origin: IsoOrigin;
}

function isOccupiedTarget(target: Position, occupied: readonly Position[] | undefined): boolean {
  return (occupied ?? []).some((cell) => samePosition(cell, target));
}

function cellReason(cell: CellType | undefined): BlockReason | null {
  if (cell === "#") return "wall";
  if (cell === "~") return "water";
  return null;
}

/**
 * Cause du refus, dans l'ordre : case cible occupée, puis relief bloquant
 * (`#` mur, `~` eau), sinon simple dépassement de la portée en PM.
 */
function blockedReason(input: PathPreviewInput): BlockReason {
  if (isOccupiedTarget(input.to, input.occupied)) return "occupied";
  return cellReason(getCell(input.map, input.to)) ?? "range";
}

function reached(path: Position[], maxPm: number): PathPreview {
  const cost = path.length - 1;
  return { reachable: true, path, cost, blockedBy: null, remainingPm: maxPm - cost };
}

function unreachable(input: PathPreviewInput): PathPreview {
  return { reachable: false, path: [], cost: 0, blockedBy: blockedReason(input), remainingPm: input.maxPm };
}

/** Aperçu de déplacement : A* du moteur réutilisé tel quel, aucune formule recopiée. */
export function buildPathPreview(input: PathPreviewInput): PathPreview {
  const path = findPath(input);
  return path === null ? unreachable(input) : reached(path, input.maxPm);
}

/** Centres iso des cases du chemin, projetés par `gridToIso`. */
export function pathIsoCenters(input: PathCentersInput): PixelPoint[] {
  return input.path.map((position) => gridToIso({ ...position, origin: input.origin }));
}
