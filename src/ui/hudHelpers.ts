import type { CombatPhase, CombatState } from "../engine/combatLoop/types";
import type { SpellDef } from "../schemas/spellSchema";

export interface CastCheckInput {
  spell: SpellDef;
  combat: CombatState;
}

const PHASE_LABELS: Record<CombatPhase, string> = {
  player_turn: "À toi de jouer",
  enemy_turn: "Tour adverse",
  victory: "Victoire",
  defeat: "Défaite",
};

const HP_PERCENT_MAX = 100;

function isPlayerTurn(phase: CombatPhase): boolean {
  return phase === "player_turn";
}

function hasEnoughAp(combat: CombatState, spell: SpellDef): boolean {
  return combat.player.ap >= spell.apCost;
}

export function canCastSpell(input: CastCheckInput): boolean {
  const { spell, combat } = input;
  return isPlayerTurn(combat.phase) && hasEnoughAp(combat, spell);
}

export function getRecentLog(log: readonly string[], limit: number): string[] {
  if (limit <= 0) return [];
  return log.slice(-limit);
}

function clampHp(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.max(current, 0), max);
}

function hpPercent(current: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((clampHp(current, max) / max) * HP_PERCENT_MAX);
}

export function formatHpBar(current: number, max: number): {
  text: string;
  percent: number;
} {
  return { text: `${clampHp(current, max)} / ${max}`, percent: hpPercent(current, max) };
}

export function formatSpellRange(spell: SpellDef): string {
  if (spell.minRange === spell.maxRange) return `${spell.minRange} PO`;
  return `${spell.minRange}–${spell.maxRange} PO`;
}

export function phaseLabel(phase: CombatPhase): string {
  return PHASE_LABELS[phase];
}

export function isBattleOver(phase: CombatPhase): boolean {
  return phase === "victory" || phase === "defeat";
}
