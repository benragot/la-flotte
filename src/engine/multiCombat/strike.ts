import { computeDamage, computePushbackDamage } from "../combat";
import { applyPush } from "../combatLoop";
import type { CombatantState, PushResult } from "../combatLoop";
import type { Element } from "../../schemas/spellSchema";
import type { DamageInput } from "../combat";
import type { Position } from "../grid";
import { withCombatant } from "./combatants";
import type { AttackSpec, BattleState, CombatantLike, CombatStats } from "./types";

// TODO 5B : mutualiser avec combatLoop/cast.ts (ELEMENT_STAT y est privé).
const ELEMENT_STAT: Record<Element, keyof CombatStats> = {
  earth: "strength",
  fire: "intelligence",
  water: "chance",
  air: "agility",
  neutral: "strength",
};

/** Contexte complet d'un coup déjà validé (PA, tour, cible vivante). */
export interface DamageContext {
  state: BattleState;
  attacker: CombatantLike;
  target: CombatantLike;
  attack: AttackSpec;
  critical: boolean;
  critDamagePct: number;
}

interface PushOutcome {
  position: Position;
  damage: number;
}

function elementStat(stats: CombatStats, element: Element): number {
  return stats[ELEMENT_STAT[element]];
}

function resistanceInput(target: CombatantLike, element: Element): Pick<DamageInput, "flatRes" | "pctRes" | "armor"> {
  return {
    flatRes: target.resistances.flat[element],
    pctRes: target.resistances.percent[element],
    armor: target.armor,
  };
}

/** `isPlayer` décrit bien la **cible** (plafond 50 % sur ses résistances %). */
function damageInput(context: DamageContext): DamageInput {
  const { attack, attacker, target, critical, critDamagePct } = context;
  return {
    base: attack.base,
    stat: elementStat(attacker.stats, attack.element),
    percentDmg: critical ? critDamagePct : 0,
    ...resistanceInput(target, attack.element),
    isPlayer: target.side === "player",
  };
}

/** Dégâts du coup, `percentDmg` ne portant que le bonus de critique. */
export function damageOf(context: DamageContext): number {
  return computeDamage(damageInput(context));
}

/**
 * Pont minimal vers `applyPush` (qui attend un `CombatantState` complet) :
 * `applyPush` ne lit que `map` et les deux positions.
 */
function asPushCombatant(combatant: CombatantLike): CombatantState {
  return { ...combatant, kind: combatant.side, accuracyPct: 0, pp: 0, spellIds: [] };
}

/** `remainingCells` = cases réellement parcourues (comme le 1v1 dans cast.ts). */
function collisionDamage(context: DamageContext, push: PushResult): number {
  if (!push.blocked) return 0;
  return computePushbackDamage({
    casterLevel: context.attacker.level,
    roll: context.attack.roll ?? 0,
    remainingCells: push.travelled,
    isSecondaryTarget: false,
  });
}

/** Parcours de poussée délégué à `combatLoop/push.ts`, aucune case codée en dur. */
function pushOutcome(context: DamageContext): PushOutcome {
  const cells = context.attack.pushCells ?? 0;
  const map = context.state.map;
  if (cells <= 0 || map === undefined) return { position: context.target.position, damage: 0 };
  const push = applyPush({ map, caster: asPushCombatant(context.attacker), victim: asPushCombatant(context.target), cells });
  return { position: push.position, damage: collisionDamage(context, push) };
}

export function spendAp(state: BattleState, attacker: CombatantLike, cost: number): BattleState {
  if (cost <= 0) return state;
  return withCombatant(state, { ...attacker, ap: Math.max(0, attacker.ap - cost) });
}

function appendLog(state: BattleState, entry: string): BattleState {
  return { ...state, log: [...state.log, entry] };
}

function describeHit(context: DamageContext, total: number): string {
  const suffix = context.critical ? " (critique)" : "";
  const spell = context.attack.spellName === undefined ? "" : ` avec ${context.attack.spellName}`;
  return `${context.attacker.name} frappe ${context.target.name}${spell}${suffix} : ${total} dégâts.`;
}

/** Applique les dégâts (plancher 0), relocalise la cible poussée et journalise. */
export function applyHit(context: DamageContext, damage: number, push: PushOutcome): BattleState {
  const target = { ...context.target, position: push.position };
  const hp = Math.max(0, target.hp - damage - push.damage);
  const next = withCombatant(context.state, { ...target, hp });
  return appendLog(next, describeHit(context, damage + push.damage));
}

/** Coup complet : poussée calculée avant les dégâts pour connaître la position finale. */
export function resolveHit(context: DamageContext): BattleState {
  return applyHit(context, damageOf(context), pushOutcome(context));
}
