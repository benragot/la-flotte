import { isSpellAvailable, recordSpellCast, spellUsageKey } from "../combat";
import type { SpellLimit, SpellUsageMap } from "../combat";
import type { AttackSpec, BattleState } from "./types";

const NO_USAGE: SpellUsageMap = {};

/** Ce que la stratégie ennemie connaît d'un sort : son id et ses quotas. */
export interface CastableSpell extends SpellLimit {
  id: string;
}

/** Quota et cible d'un sort : la cible absente ne vérifie que `castsPerTurn`. */
export interface SpellCastQuery {
  state: BattleState;
  casterId: string;
  spell: CastableSpell;
  targetId?: string | undefined;
}

/** Même requête pour une frappe (`AttackSpec` porte ses propres quotas). */
export interface AttackQuotaQuery {
  state: BattleState;
  casterId: string;
  attack: AttackSpec;
  targetId?: string | undefined;
}

function attackKey(casterId: string, attack: AttackSpec): string | null {
  return attack.spellId === undefined ? null : spellUsageKey(casterId, attack.spellId);
}

function usageOf(state: BattleState): SpellUsageMap {
  return state.spellUsage ?? NO_USAGE;
}

/** Un coup sans `spellId` est une attaque nue : aucun quota à vérifier. */
export function isAttackAvailable(input: AttackQuotaQuery): boolean {
  const key = attackKey(input.casterId, input.attack);
  if (key === null) return true;
  const { state, attack, targetId } = input;
  return isSpellAvailable({ usage: usageOf(state), key, limit: attack, turn: state.turn, targetId });
}

/**
 * Disponibilité d'un `SpellDef` pour un lanceur et une cible, lue sur l'état de
 * la bataille : c'est ce que la stratégie ennemie consulte **avant** de
 * proposer un sort, pour ne pas transformer une recharge ou une cible saturée
 * en tour perdu.
 */
export function canCastSpellNow(input: SpellCastQuery): boolean {
  const key = spellUsageKey(input.casterId, input.spell.id);
  const { state, spell, targetId } = input;
  return isSpellAvailable({ usage: usageOf(state), key, limit: spell, turn: state.turn, targetId });
}

/** Comptabilise le lancement ; identité conservée quand le sort n'a aucun quota. */
export function recordAttack(input: AttackQuotaQuery): BattleState {
  const key = attackKey(input.casterId, input.attack);
  if (key === null) return input.state;
  const current = usageOf(input.state);
  const limit = input.attack;
  const options = { usage: current, key, limit, turn: input.state.turn, targetId: input.targetId };
  const usage = recordSpellCast(options);
  return usage === current ? input.state : { ...input.state, spellUsage: usage };
}
