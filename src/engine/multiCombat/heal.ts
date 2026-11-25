import { appendFloat, healAmount, isSpellAvailable, recordSpellCast, scaledHeal, spellUsageKey } from "../combat";
import type { SpellLimit } from "../combat";
import { appendLog, findCombatant, isActive, isAlive, withCombatant } from "./combatants";
import { spendAp } from "./strike";
import type { BattleState, CombatantLike, Rng } from "./types";

/**
 * Ce que le moteur 1vN doit savoir d'un sort de soin. La fourchette vient de
 * `data/spells.yaml` (`effect.amount` pour `mot_curatif`), jamais d'une valeur
 * écrite dans `src/` ; `scales` dit si la stat de soin 1.29 s'applique.
 */
export interface HealSpec extends SpellLimit {
  id: string;
  name: string;
  apCost: number;
  min: number;
  max: number;
  /** `true` = sort avec élément déclaré : le soin suit l'Intelligence (§1.3). */
  scales: boolean;
}

export interface HealInput {
  state: BattleState;
  healerId: string;
  targetId: string;
  heal: HealSpec;
  rng: Rng;
}

interface HealContext {
  heal: HealSpec;
  healer: CombatantLike;
  target: CombatantLike;
  roll: number;
}

function rolled(heal: HealSpec, rng: Rng): number {
  return heal.min + Math.floor(rng() * (heal.max - heal.min + 1));
}

/** Stat puis plafond : les deux règles viennent de `engine/combat/heal`. */
function amountFor(context: HealContext): number {
  const { heal, healer, target, roll } = context;
  const base = heal.scales ? scaledHeal(roll, healer.stats.intelligence) : roll;
  return healAmount({ heal: base, currentHp: target.hp, maxHp: target.maxHp });
}

/** Un soin ne vise qu'un vivant du **même camp** ; l'ennemi est refusé. */
function sameCampAlive(healer: CombatantLike, target: CombatantLike): boolean {
  return healer.side === target.side && isAlive(healer) && isAlive(target);
}

function canPay(input: HealInput, healer: CombatantLike): boolean {
  return isActive(input.state, healer.id) && input.heal.apCost <= healer.ap;
}

function withinQuota(input: HealInput, healer: CombatantLike): boolean {
  const key = spellUsageKey(healer.id, input.heal.id);
  return isSpellAvailable({ usage: input.state.spellUsage ?? {}, key, limit: input.heal, turn: input.state.turn });
}

function isHealAllowed(input: HealInput, healer: CombatantLike, target: CombatantLike): boolean {
  if (!sameCampAlive(healer, target)) return false;
  return canPay(input, healer) && withinQuota(input, healer);
}

function recordHeal(state: BattleState, casterId: string, heal: HealSpec): BattleState {
  const current = state.spellUsage ?? {};
  const key = spellUsageKey(casterId, heal.id);
  const usage = recordSpellCast({ usage: current, key, limit: heal, turn: state.turn });
  return usage === current ? state : { ...state, spellUsage: usage };
}

interface HealOutcome {
  input: HealInput;
  healer: CombatantLike;
  target: CombatantLike;
  amount: number;
}

function applyHeal(outcome: HealOutcome): BattleState {
  const { input, healer, target, amount } = outcome;
  const paid = spendAp(input.state, healer, input.heal.apCost);
  const recorded = recordHeal(paid, healer.id, input.heal);
  const current = findCombatant(recorded, target.id) ?? target;
  const healed = withCombatant(recorded, { ...current, hp: current.hp + amount });
  const floated = appendFloat(healed, { targetId: target.id, amount, kind: "heal" });
  return appendLog(floated, `${healer.name} soigne ${target.name} de ${amount} PV.`);
}

/**
 * Résout un soin 1vN. Refus par identité (aucun PA, aucun aléa, aucun journal) :
 * lanceur inconnu/inactif/mort, cible inconnue/morte, cible d'un autre camp,
 * PA insuffisants ou quota épuisé. Le montant est borné aux PV manquants.
 */
export function resolveHeal(input: HealInput): BattleState {
  const healer = findCombatant(input.state, input.healerId);
  const target = findCombatant(input.state, input.targetId);
  if (healer === undefined || target === undefined) return input.state;
  if (!isHealAllowed(input, healer, target)) return input.state;
  const roll = rolled(input.heal, input.rng);
  const amount = amountFor({ heal: input.heal, healer, target, roll });
  return applyHeal({ input, healer, target, amount });
}
