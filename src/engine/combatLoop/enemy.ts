import type { SpellDef } from "../../schemas/spellSchema";
import type { Position } from "../grid";
import { samePosition } from "../grid";
import { isSpellAvailable, spellUsageKey } from "../combat";
import { getActiveCombatant, getOpponent } from "./active";
import { castSpell } from "./cast";
import { getCastableCells } from "./castable";
import { getReachableCells, manhattan } from "./cells";
import { moveActiveEntity } from "./move";
import type { CombatantState, CombatState, Rng } from "./types";

const MAX_ENEMY_ACTIONS = 12;

/** Un sort connu, payable, hors recharge et non saturé sur la cible visée. */
function isUsable(state: CombatState, enemy: CombatantState, spell: SpellDef | undefined): spell is SpellDef {
  if (spell === undefined || spell.apCost > enemy.ap) return false;
  const key = spellUsageKey(enemy.id, spell.id);
  const turn = state.turn;
  const targetId = getOpponent(state).id;
  return isSpellAvailable({ usage: state.spellUsage ?? {}, key, limit: spell, turn, targetId });
}

function canHitOpponent(state: CombatState, spellId: string): boolean {
  const target = getOpponent(state).position;
  return getCastableCells(state, spellId).some((cell) => samePosition(cell, target));
}

/**
 * Premier sort du monstre payable, hors recharge ET dont la portée/LoS couvre
 * la cible : sans ce filtre, un sort de contact en tête de `spellIds` masquait
 * le sort à distance et l'IA venait coller au héros.
 */
function findSpell(state: CombatState, enemy: CombatantState) {
  const spells = enemy.spellIds.map((id) => state.spellsById[id]);
  return spells.find((spell) => isUsable(state, enemy, spell) && canHitOpponent(state, spell.id));
}

/** Au moins un sort couvre la cible : l'IA garde sa distance de tir. */
function hasSpellInRange(state: CombatState, enemy: CombatantState): boolean {
  return enemy.spellIds.some((id) => canHitOpponent(state, id));
}

function attackOpponent(state: CombatState, rng: Rng): CombatState {
  const enemy = getActiveCombatant(state);
  const spell = findSpell(state, enemy);
  if (spell === undefined) return state;
  return castSpell({ state, spellId: spell.id, target: getOpponent(state).position, rng });
}

const closest = (target: Position) => (best: Position | null, cell: Position) =>
  best === null || manhattan(cell, target) < manhattan(best, target) ? cell : best;

/** Rapprochement : meilleure case strictement plus proche de l'adversaire. */
function approachOpponent(state: CombatState): CombatState {
  const enemy = getActiveCombatant(state);
  const target = getOpponent(state).position;
  const reach = manhattan(enemy.position, target);
  const better = getReachableCells(state).filter((cell) => manhattan(cell, target) < reach);
  const best = better.reduce<Position | null>(closest(target), null);
  return best === null ? state : moveActiveEntity(state, best);
}

/** Une action : attaque si possible, sinon un pas de rapprochement. */
function enemyTurnStep(state: CombatState, rng: Rng): CombatState {
  const attacked = attackOpponent(state, rng);
  if (attacked !== state) return attacked;
  if (hasSpellInRange(state, getActiveCombatant(state))) return state;
  return approachOpponent(state);
}

function shouldAct(state: CombatState): boolean {
  return state.phase === "enemy_turn";
}

/**
 * IA « Piou Mazouté » : frappe tant qu'il a les PA et la portée, sinon se
 * rapproche de `min(PM, PM restants)` cases. Ne rend pas la main : la phase
 * reste `enemy_turn` (sauf défaite du joueur).
 */
export function runEnemyTurn(state: CombatState, rng: Rng): CombatState {
  let current = state;
  for (let action = 0; action < MAX_ENEMY_ACTIONS && shouldAct(current); action += 1) {
    const next = enemyTurnStep(current, rng);
    if (next === current) return current;
    current = next;
  }
  return current;
}
