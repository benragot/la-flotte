import { activeCombatant, enemiesAct, isDefeat, isVictory, resolveAttack } from "../engine/multiCombat";
import type { AttackSpec, BattleState, EnemyStrategy, Rng } from "../engine/multiCombat";
import type { SpellDef } from "../schemas/spellSchema";

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

/** Base de dégâts tirée dans la plage YAML du sort, un seul jet consommé. */
export function rollSpellBase(spell: SpellDef, rng: Rng): number {
  const range = spell.damage;
  if (range === undefined) return 0;
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

/**
 * Pont `SpellDef` → `AttackSpec` pour le 1vN. `baseCrit: 0` : `data/spells.yaml`
 * ne porte pas encore de taux de critique, on n'en invente pas.
 */
export function spellAttackSpec(spell: SpellDef, roll: number): AttackSpec {
  const element = spell.element ?? "neutral";
  return { base: roll, element, baseCrit: 0, apCost: spell.apCost, pushCells: spell.pushCells ?? 0 };
}
