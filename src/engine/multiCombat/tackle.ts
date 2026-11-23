import { computeTackleEscapePercent } from "../combat";
import type { Position } from "../grid";
import { findCombatant, isActive, isAlive } from "./combatants";
import type { BattleState, CombatantLike, Rng } from "./types";

const PERCENT = 100;

/** Coût d'un tacle réussi : **1 PM**, jamais un PA (1.29, dette D70). */
export const TACKLE_MP_LOSS = 1;

export interface TackleCheckInput {
  state: BattleState;
  moverId: string;
  rng: Rng;
}

export interface TackleCheckResult {
  /** `true` : le pas passe, aucun PM perdu. `false` : tacle, arrêt sur place. */
  escaped: boolean;
  /** PM retirés au déplaçant : `TACKLE_MP_LOSS` sur échec, `0` sinon. */
  mpLoss: number;
}

/** Contact de tacle : Manhattan 1, donc les **quatre** orthogonales seulement. */
function isAdjacent(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/** Adversaires vivants au contact du déplaçant (4 directions, jamais la diagonale). */
export function adjacentEnemies(state: BattleState, mover: CombatantLike): CombatantLike[] {
  return state.combatants.filter(
    (entry) => entry.side !== mover.side && isAlive(entry) && isAdjacent(entry.position, mover.position),
  );
}

/** Tacleur retenu : le plus agile, départage déterministe par ordre de tableau. */
function strongestTackler(tacklers: readonly CombatantLike[]): CombatantLike {
  return tacklers.reduce((best, entry) => (entry.stats.agility > best.stats.agility ? entry : best));
}

/**
 * Échappée si `rng() × 100 < percent` (inégalité **stricte**) : `percent = 0`
 * ne s'échappe jamais, `percent = 100` s'échappe toujours (`rng() < 1`).
 */
function escapes(mover: CombatantLike, tackler: CombatantLike, rng: Rng): boolean {
  const percent = computeTackleEscapePercent({
    fleeAgility: mover.stats.agility,
    tackleAgility: tackler.stats.agility,
  });
  return rng() * PERCENT < percent;
}

/** Aucun tacle : le pas est libre et rien n'est prélevé. */
function freeCheck(): TackleCheckResult {
  return { escaped: true, mpLoss: 0 };
}

/** Un seul jet d'échappée, jamais de retrait de PA : le PM est la seule facture. */
function judged(mover: CombatantLike, tackler: CombatantLike, rng: Rng): TackleCheckResult {
  if (escapes(mover, tackler, rng)) return freeCheck();
  return { escaped: false, mpLoss: TACKLE_MP_LOSS };
}

/** Le tacle ne concerne que l'actif vivant : les autres sont hors jeu. */
function mayTackle(input: TackleCheckInput, mover: CombatantLike): boolean {
  return isAlive(mover) && isActive(input.state, input.moverId);
}

/**
 * Jet de tacle au **départ d'un pas** (1.29, dette D70). La case quittée est
 * celle du déplaçant dans `state` : l'appelant doit donc la mettre à jour
 * avant chaque pas. Les quatre orthogonales comptent, la diagonale non.
 *
 * Un seul tirage par pas, et **aucun** quand personne n'est au contact :
 * `computeApMpLossChance` n'est plus consulté (l'ancienne perte de PA sur un
 * second jet a été supprimée, 1.29 retire des PM).
 */
export function tackleCheck(input: TackleCheckInput): TackleCheckResult {
  const mover = findCombatant(input.state, input.moverId);
  if (mover === undefined || !mayTackle(input, mover)) return freeCheck();
  const tacklers = adjacentEnemies(input.state, mover);
  if (tacklers.length === 0) return freeCheck();
  return judged(mover, strongestTackler(tacklers), input.rng);
}
