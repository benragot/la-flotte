import type { Element, SpellDef } from "../../schemas/spellSchema";
import type { DamageInput } from "../combat";
import { computeDamage, computePushbackDamage, healAmount, healRange, isSpellAvailable, recordSpellCast, rollHeal, scaledHeal, spellUsageKey, appendFloat } from "../combat";
import type { Position } from "../grid";
import { samePosition } from "../grid";
import { getActiveCombatant, getOpponent, isPlayablePhase, setCombatant } from "./active";
import { getCastableCells } from "./castable";
import { appendLog } from "./log";
import type { PushResult } from "./push";
import { applyPush } from "./push";
import { isHealSpell, spellSupportRefusal } from "./spellSupport";
import type { SpellSupportRefusal } from "./spellSupport";
import type {
  CombatPhase,
  CombatStatKey,
  CombatantKind,
  CombatantState,
  CombatState,
  Rng,
} from "./types";

export interface CastInput {
  state: CombatState;
  spellId: string;
  target: Position;
  rng: Rng;
}

interface CastPlan extends CastInput {
  spell: SpellDef;
}

interface DamageContext {
  spell: SpellDef;
  roll: number;
  caster: CombatantState;
  victim: CombatantState;
}

interface HitContext extends DamageContext {
  state: CombatState;
}

interface HitDetail {
  roll: number;
  damage: number;
  pushDamage: number;
  victim: CombatantState;
}

const ELEMENT_STAT: Record<Element, CombatStatKey> = {
  earth: "strength",
  fire: "intelligence",
  water: "chance",
  air: "agility",
  neutral: "strength",
};

function canAfford(state: CombatState, spell: SpellDef): boolean {
  return getActiveCombatant(state).ap >= spell.apCost;
}

function isTargetValid(plan: CastPlan): boolean {
  return getCastableCells(plan.state, plan.spell.id).some((cell) => samePosition(cell, plan.target));
}

/** Cible du quota : soi-même pour un soin ou un téléport, l'adversaire sinon. */
function quotaTargetId(plan: CastPlan): string {
  const caster = getActiveCombatant(plan.state);
  const selfTargeted = plan.spell.kind === "teleport" || isHealSpell(plan.spell);
  return selfTargeted ? caster.id : getOpponent(plan.state).id;
}

/** Quota 1.29 du sort : `castsPerTurn`, `castsPerTarget` et `cooldown`. */
function withinQuota(plan: CastPlan): boolean {
  const caster = getActiveCombatant(plan.state);
  const key = spellUsageKey(caster.id, plan.spell.id);
  const usage = plan.state.spellUsage ?? {};
  const turn = plan.state.turn;
  return isSpellAvailable({ usage, key, limit: plan.spell, turn, targetId: quotaTargetId(plan) });
}

function isValidPlan(plan: CastPlan): boolean {
  if (!isPlayablePhase(plan.state) || !canAfford(plan.state, plan.spell)) return false;
  return withinQuota(plan) && isTargetValid(plan);
}

function planCast(input: CastInput): CastPlan | null {
  const spell = input.state.spellsById[input.spellId];
  if (spell === undefined) return null;
  const plan = { ...input, spell };
  return isValidPlan(plan) ? plan : null;
}

function spendAp(state: CombatState, amount: number): CombatState {
  const caster = getActiveCombatant(state);
  return setCombatant(state, { ...caster, ap: Math.max(0, caster.ap - amount) });
}

/** Comptabilise le lancement ; identité conservée quand le sort n'a aucun quota. */
function recordCast(state: CombatState, plan: CastPlan): CombatState {
  const caster = getActiveCombatant(state);
  const current = state.spellUsage ?? {};
  const key = spellUsageKey(caster.id, plan.spell.id);
  const turn = state.turn;
  const usage = recordSpellCast({ usage: current, key, limit: plan.spell, turn, targetId: quotaTargetId(plan) });
  return usage === current ? state : { ...state, spellUsage: usage };
}

/** `roll = min + floor(rng() × (max - min + 1))`, tirage unique par cast. */
function rollDamage(spell: SpellDef, rng: Rng): number {
  const range = spell.damage;
  if (range === undefined) return 0;
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

function elementStat(caster: CombatantState, element: Element): number {
  return caster.stats[ELEMENT_STAT[element]];
}

function resistanceInput(victim: CombatantState, element: Element): Pick<DamageInput, "flatRes" | "pctRes"> {
  return { flatRes: victim.resistances.flat[element], pctRes: victim.resistances.percent[element] };
}

/** Le caster apporte sa stat et son `% Dégâts`, la cible ses deux résistances. */
function damageInput(context: DamageContext): DamageInput {
  const { spell, roll, caster, victim } = context;
  const element = spell.element ?? "neutral";
  const offense = { base: roll, stat: elementStat(caster, element), percentDmg: caster.percentDmg };
  return { ...offense, ...resistanceInput(victim, element), isPlayer: victim.kind === "player" };
}

function pushbackFor(context: HitContext, push: PushResult): number {
  if (!push.blocked) return 0;
  const casterLevel = context.caster.level;
  return computePushbackDamage({
    casterLevel,
    roll: context.roll,
    remainingCells: push.travelled,
    isSecondaryTarget: false,
  });
}

function resolveHit(context: HitContext): HitDetail {
  const damage = computeDamage(damageInput(context));
  const cells = context.spell.pushCells ?? 0;
  const push = applyPush({ map: context.state.map, caster: context.caster, victim: context.victim, cells });
  const victim = { ...context.victim, position: push.position };
  return { roll: context.roll, damage, pushDamage: pushbackFor(context, push), victim };
}

function outcomePhase(kind: CombatantKind): CombatPhase {
  return kind === "player" ? "defeat" : "victory";
}

function applyHit(state: CombatState, hit: HitDetail): CombatState {
  const hp = Math.max(0, hit.victim.hp - hit.damage - hit.pushDamage);
  const victim = { ...hit.victim, hp };
  const next = setCombatant(state, victim);
  const floated = appendFloat(next, { targetId: victim.id, amount: hit.victim.hp - hp, kind: "damage" });
  return hp <= 0 ? { ...floated, phase: outcomePhase(victim.kind) } : floated;
}

function describeHit(state: CombatState, hit: HitDetail, spell: SpellDef): string {
  const caster = getActiveCombatant(state);
  const total = hit.damage + hit.pushDamage;
  return `${caster.name} lance ${spell.name} : ${total} dégâts.`;
}

function strike(state: CombatState, plan: CastPlan): CombatState {
  const caster = getActiveCombatant(state);
  const victim = getOpponent(state);
  const roll = rollDamage(plan.spell, plan.rng);
  const hit = resolveHit({ state, spell: plan.spell, caster, victim, roll });
  return appendLog(applyHit(state, hit), describeHit(state, hit, plan.spell));
}

function healRoll(spell: SpellDef, rng: Rng): number {
  const range = healRange(spell);
  return range === undefined ? 0 : rollHeal(range, rng);
}

/**
 * Soin 1v1 : la cible est toujours le lanceur (seul allié du modèle à deux
 * camps). La formule vit dans `engine/combat/heal`, jamais recopiée ici.
 */
function healTarget(state: CombatState, plan: CastPlan): CombatState {
  const caster = getActiveCombatant(state);
  const roll = healRoll(plan.spell, plan.rng);
  const base = scaledHeal(roll, caster.stats.intelligence);
  const amount = healAmount({ heal: base, currentHp: caster.hp, maxHp: caster.maxHp });
  const healed = setCombatant(state, { ...caster, hp: caster.hp + amount });
  const floated = appendFloat(healed, { targetId: caster.id, amount, kind: "heal" });
  return appendLog(floated, `${caster.name} soigne ${caster.name} de ${amount} PV.`);
}

function teleport(state: CombatState, plan: CastPlan): CombatState {
  const caster = getActiveCombatant(state);
  const moved = setCombatant(state, { ...caster, position: plan.target });
  return appendLog(moved, `${caster.name} se téléporte.`);
}

/** Motif pour lequel le moteur refuse ce sort avant toute géométrie ; `null` = tentable. */
export function spellRefusal(state: CombatState, spellId: string): SpellSupportRefusal | null {
  const spell = state.spellsById[spellId];
  return spell === undefined ? null : spellSupportRefusal(spell);
}

/** Lance un sort si le support, la phase, les PA et la cible le permettent ; sinon inchangé. */
function resolveSpell(state: CombatState, plan: CastPlan): CombatState {
  if (isHealSpell(plan.spell)) return healTarget(state, plan);
  return plan.spell.kind === "teleport" ? teleport(state, plan) : strike(state, plan);
}

export function castSpell(input: CastInput): CombatState {
  // Effet absent (SPELL-02) ou état requis non géré : refus nommé, jamais silencieux.
  if (spellRefusal(input.state, input.spellId) !== null) return input.state;
  const plan = planCast(input);
  if (plan === null) return input.state;
  return resolveSpell(recordCast(spendAp(plan.state, plan.spell.apCost), plan), plan);
}
