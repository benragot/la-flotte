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

/** `rng() × 100 < échappée` : l'échappée réussie annule le tacle. */
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
 * Règle de tacle retenue (1.29 simplifiée) : seuls les adversaires vivants à
 * distance 1 du point de départ comptent ; le plus agile mène le tacle.
 * Jet 1 : `computeTackleEscapePercent` ≥ `rng() × 100` ⇒ déplacement accepté,
 * 0 PA perdu. Jet 2 en cas d'échec : `computeApMpLossChance` ≥ `rng()` ⇒ 1 PA
 * perdu, sinon le déplacement est simplement refusé. La légalité de la case
 * d'arrivée et le coût en PM restent à la charge de l'appelant.
 */
export function resolveTackle(input: TackleInput): TackleResult {
  const mover = findCombatant(input.state, input.moverId);
  if (mover === undefined || !isTackleAttempt(input, mover)) {
    return { state: input.state, moved: false, apLoss: 0 };
  }
  return tackleStep(input, mover);
}
