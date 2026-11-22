import { isSpellAvailable, recordSpellCast, spellUsageKey } from "../combat";
import type { SpellLimit, SpellUsageMap } from "../combat";
import type { AttackSpec, BattleState } from "./types";

const NO_USAGE: SpellUsageMap = {};

/** Ce que la stratégie ennemie connaît d'un sort : son id et ses deux quotas. */
export interface CastableSpell extends SpellLimit {
  id: string;
}

function attackKey(casterId: string, attack: AttackSpec): string | null {
  return attack.spellId === undefined ? null : spellUsageKey(casterId, attack.spellId);
}

function usageOf(state: BattleState): SpellUsageMap {
  return state.spellUsage ?? NO_USAGE;
}

/** Un coup sans `spellId` est une attaque nue : aucun quota à vérifier. */
export function isAttackAvailable(state: BattleState, casterId: string, attack: AttackSpec): boolean {
  const key = attackKey(casterId, attack);
  if (key === null) return true;
  return isSpellAvailable({ usage: usageOf(state), key, limit: attack, turn: state.turn });
}

/**
 * Disponibilité d'un `SpellDef` pour un lanceur, lue sur l'état de la bataille :
 * c'est ce que la stratégie ennemie consulte **avant** de proposer un sort, pour
 * ne pas transformer une recharge en tour perdu.
 */
export function canCastSpellNow(state: BattleState, casterId: string, spell: CastableSpell): boolean {
  const key = spellUsageKey(casterId, spell.id);
  return isSpellAvailable({ usage: usageOf(state), key, limit: spell, turn: state.turn });
}

/** Comptabilise le lancement ; identité conservée quand le sort n'a aucun quota. */
export function recordAttack(state: BattleState, casterId: string, attack: AttackSpec): BattleState {
  const key = attackKey(casterId, attack);
  if (key === null) return state;
  const current = usageOf(state);
  const usage = recordSpellCast({ usage: current, key, limit: attack, turn: state.turn });
  return usage === current ? state : { ...state, spellUsage: usage };
}
