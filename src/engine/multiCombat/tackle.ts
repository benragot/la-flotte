import { computeApMpLossChance, computeTackleEscapePercent } from "../combat";
import type { Position } from "../grid";
import { findCombatant, isActive, isAlive, withCombatant } from "./combatants";
import type { BattleState, CombatantLike, Rng } from "./types";

const PERCENT = 100;
const MAX_AP_LOSS = 1;

export interface TackleInput {
  state: BattleState;
  moverId: string;
  move: Position;
  rng: Rng;
}

export interface TackleResult {
  state: BattleState;
  moved: boolean;
  apLoss: number;
}

function isAdjacent(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

/** Adversaires vivants au contact du déplaçant (4 directions). */
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

function apLossChance(tackler: CombatantLike, mover: CombatantLike): number {
  return computeApMpLossChance({
    casterWisdom: tackler.stats.wisdom,
    targetWisdom: mover.stats.wisdom,
    remaining: mover.ap,
    max: mover.maxAp,
  });
}

/** 1 PA au maximum par tentative, uniquement si le jet de retrait passe. */
function rollApLoss(tackler: CombatantLike, mover: CombatantLike, rng: Rng): number {
  return rng() < apLossChance(tackler, mover) ? MAX_AP_LOSS : 0;
}

function relocate(state: BattleState, mover: CombatantLike, to: Position): BattleState {
  return withCombatant(state, { ...mover, position: to });
}

function applyApLoss(state: BattleState, mover: CombatantLike, amount: number): BattleState {
  if (amount <= 0) return state;
  return withCombatant(state, { ...mover, ap: Math.max(0, mover.ap - amount) });
}

function freeMove(input: TackleInput, mover: CombatantLike): TackleResult {
  return { state: relocate(input.state, mover, input.move), moved: true, apLoss: 0 };
}

function tackled(input: TackleInput, mover: CombatantLike, tackler: CombatantLike): TackleResult {
  if (escapes(mover, tackler, input.rng)) return freeMove(input, mover);
  const apLoss = rollApLoss(tackler, mover, input.rng);
  return { state: applyApLoss(input.state, mover, apLoss), moved: false, apLoss };
}

function tackleStep(input: TackleInput, mover: CombatantLike): TackleResult {
  const tacklers = adjacentEnemies(input.state, mover);
  if (tacklers.length === 0) return freeMove(input, mover);
  return tackled(input, mover, strongestTackler(tacklers));
}

function isTackleAttempt(input: TackleInput, mover: CombatantLike): boolean {
  return isAlive(mover) && isActive(input.state, input.moverId);
}

/**
 * Règle de tacle retenue (1.29 simplifiée, assumée) :
 * 1. seuls les adversaires vivants à distance 1 du point de départ comptent ;
 *    le **plus agile** mène le tacle (départage par ordre de tableau) ;
 * 2. jet d'échappée : `rng() × 100 < computeTackleEscapePercent(...)` ⇒ le
 *    déplacement passe, 0 PA perdu (inégalité stricte, voir `escapes`) ;
 * 3. jet de retrait en cas de tacle : `rng() < computeApMpLossChance(...)` ⇒
 *    **1 PA** perdu, sinon le déplacement est refusé sans perte.
 *
 * Simplifications assumées par rapport à 1.29 :
 * - tacleur **unique** (1.29 combine plusieurs tacleurs par produit) ;
 * - perte de **PA** sur déplacement refusé (1.29 retire des PM) ;
 * - déplacement **refusé** (1.29 l'autorise avec un malus de PM).
 *
 * La légalité de la case d'arrivée et le coût en PM restent à la charge de
 * l'appelant.
 */
export function resolveTackle(input: TackleInput): TackleResult {
  const mover = findCombatant(input.state, input.moverId);
  if (mover === undefined || !isTackleAttempt(input, mover)) {
    return { state: input.state, moved: false, apLoss: 0 };
  }
  return tackleStep(input, mover);
}
