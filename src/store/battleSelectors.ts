import { activeCombatant, enemiesAct, isDefeat, isVictory, resolveAttack } from "../engine/multiCombat";
import type { AttackSpec, BattleState, EnemyStrategy, Rng } from "../engine/multiCombat";

export const VICTORY_LOG = "Victoire : la salle est nettoyée.";
export const DEFEAT_LOG = "Défaite : le héros tombe dans la salle.";

export interface BattleAttackInput {
  state: BattleState;
  targetId: string;
  attack: AttackSpec;
  rng: Rng;
}

export interface BattleEnemyTurnInput {
  state: BattleState;
  strategy: EnemyStrategy;
  rng: Rng;
}

export function appendBattleLog(state: BattleState, entry: string): BattleState {
  return { ...state, log: [...state.log, entry] };
}

function withOutcome(state: BattleState): BattleState {
  if (isVictory(state)) return appendBattleLog(state, VICTORY_LOG);
  if (isDefeat(state)) return appendBattleLog(state, DEFEAT_LOG);
  return state;
}

/** Refus (même référence) : aucune écriture de log, aucun `set` inutile. */
function settled(previous: BattleState, next: BattleState): BattleState {
  if (next === previous) return next;
  return withOutcome(next);
}

/** L'attaquant est l'actif de la timeline : la portée et la LoS restent à 5C. */
export function battleAttack(input: BattleAttackInput): BattleState {
  const attacker = activeCombatant(input.state);
  if (attacker === null) return input.state;
  return settled(input.state, resolveAttack({ ...input, attackerId: attacker.id }));
}

export function battleEnemyTurn(input: BattleEnemyTurnInput): BattleState {
  const next = enemiesAct({ state: input.state, rng: input.rng, strategy: input.strategy });
  return settled(input.state, next);
}
