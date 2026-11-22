import { computeDamage, computePushbackDamage } from "../combat";
import { isWalkableCell } from "../grid";
import type { Position } from "../grid";
import type { Element } from "../../schemas/spellSchema";
import { withCombatant } from "./combatants";
import type { AttackSpec, BattleState, CombatantLike, CombatStats } from "./types";

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

function elementStat(stats: CombatStats, element: Element): number {
  return stats[ELEMENT_STAT[element]];
}

/** Dégâts du coup, `percentDmg` ne portant que le bonus de critique. */
export function damageOf(context: DamageContext): number {
  const { attack, attacker, critical, critDamagePct } = context;
  return computeDamage({
    base: attack.base,
    stat: elementStat(attacker.stats, attack.element),
    percentDmg: critical ? critDamagePct : 0,
    isPlayer: attacker.side === "player",
  });
}

function pushStep(from: Position, to: Position): Position {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: Math.sign(dx), y: 0 };
  return { x: 0, y: Math.sign(dy) };
}

function nextCell(position: Position, step: Position): Position {
  return { x: position.x + step.x, y: position.y + step.y };
}

/** Bloquée si la case suivante sur l'axe lanceur→cible est hors map ou `#`. */
export function isPushBlocked(context: DamageContext): boolean {
  const { attack, attacker, state, target } = context;
  if ((attack.pushCells ?? 0) <= 0 || state.map === undefined) return false;
  const cell = nextCell(target.position, pushStep(attacker.position, target.position));
  return !isWalkableCell(state.map, cell);
}

/** Dégâts de collision : la cible n'a pas pu parcourir la première case. */
export function pushDamageOf(context: DamageContext): number {
  if (!isPushBlocked(context)) return 0;
  const { attack, attacker } = context;
  return computePushbackDamage({
    casterLevel: attacker.level,
    roll: attack.roll ?? 0,
    remainingCells: 1,
    isSecondaryTarget: false,
  });
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
  return `${context.attacker.name} frappe ${context.target.name}${suffix} : ${total} dégâts.`;
}

/** Applique les dégâts (plancher 0) et journalise le coup. */
export function applyHit(context: DamageContext, damage: number, pushDamage: number): BattleState {
  const target = context.target;
  const hp = Math.max(0, target.hp - damage - pushDamage);
  const next = withCombatant(context.state, { ...target, hp });
  return appendLog(next, describeHit(context, damage + pushDamage));
}
