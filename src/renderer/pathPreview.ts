import type { AsciiMap, Position } from "../engine/grid";
import { findPath, getCell, mapPathBudget, pathCost, samePosition } from "../engine/grid";
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

/** Aperçu d'un survol : le coût est facturé **même** quand les PM ne le paient pas. */
export interface HoverPath {
  /** Cases à peindre ; vide si la cible est refusée ou si le budget ne paie pas. */
  path: Position[];
  /** Facture DEC-10 du plus court chemin — 0 seulement s'il n'existe aucun chemin. */
  cost: number;
  /** `true` : le déplacement réel passera (chemin trouvé **et** payé par les PM). */
  payable: boolean;
  blockedBy: BlockReason | null;
}

/**
 * Chemin le plus court **sans plafond de PM** : `mapPathBudget` est le budget qui
 * couvre toute carte, donc la recherche ne s'arrête que sur un vrai obstacle.
 * Le plafond des PM est jugé après, pour pouvoir annoncer ce qu'il en coûte.
 */
function unboundedPath(input: PathPreviewInput): Position[] | null {
  if (isStartBlocked(input)) return null;
  return findPath({ ...input, maxPm: mapPathBudget(input.map) });
}

function refused(input: PathPreviewInput): HoverPath {
  return { path: [], cost: 0, payable: false, blockedBy: blockedReason(input) };
}

/**
 * Aperçu de survol : réutilise l'A* et la facture du moteur, n'ajoute **aucune**
 * règle de grille. Hors budget, `path` reste vide (on ne promet pas un trajet
 * impossible) mais `cost` est conservé pour que le rendu l'annonce en rouge.
 */
export function hoverPathPreview(input: PathPreviewInput): HoverPath {
  const path = unboundedPath(input);
  if (path === null) return refused(input);
  const cost = pathCost(path);
  const payable = cost <= input.maxPm;
  return { path: payable ? path : [], cost, payable, blockedBy: payable ? null : "range" };
}
