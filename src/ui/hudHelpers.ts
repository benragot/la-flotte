import type {
  CombatPhase,
  CombatRewards,
  CombatState,
} from "../engine/combatLoop/types";
import type { SpellDef } from "../schemas/spellSchema";

export interface CastCheckInput {
  spell: SpellDef;
  combat: CombatState;
}

/** Mode du HUD : combat actif ou exploration libre de la carte. */
export type HudMode = "combat" | "exploration";

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

/**
 * Source de vérité des gains : le store (`state.rewards`), jamais
 * `CombatState.rewards` (non réassigné par le moteur V1).
 */
export function shouldShowRewards(
  phase: CombatPhase,
  rewards: CombatRewards | null,
): boolean {
  return phase === "victory" && rewards !== null;
}

/** Palette rétro Dofus 1.29 : source unique des couleurs du HUD. */
export const HUD_COLORS = {
  /** Fond pierre / ardoise. */
  stone: "#2b241d",
  /** Bordures ocre / cuivre. */
  copper: "#8c6d46",
  /** Panneaux parchemin foncé. */
  parchment: "#3d342a",
  /** Texte principal. */
  text: "#e8dcc8",
  /** Accent rouge PV. */
  hpRed: "#b83b3b",
  /** Accent bleu PA. */
  apBlue: "#3b6fb8",
  /** Accent vert PM. */
  mpGreen: "#4a8c4a",
  /** Doré du tour actif. */
  gold: "#d4a537",
} as const;

export type HudColorKey = keyof typeof HUD_COLORS;

/** Étiquette d'un état requis (`requiresState`) : vocabulaire partagé grimoire/case. */
export const SPELL_STATE_LABELS: Record<NonNullable<SpellDef["requiresState"]>, string> = { drunk: "Ivre" };

/** Grille de sorts du dock : 2 rangées de 6 emplacements. */
export const SPELL_SLOT_COUNT = 12;

export interface SpellSlotsInput {
  combat: CombatState;
  /** Documenté mais volontairement ignoré : la grille ne bouge pas à la sélection. */
  selectedSpellId: string | null;
}

function spellOf(combat: CombatState, spellId: string): SpellDef | null {
  return combat.spellsById[spellId] ?? null;
}

function padSlots(slots: readonly (SpellDef | null)[]): (SpellDef | null)[] {
  const padding = Array.from({ length: SPELL_SLOT_COUNT }, () => null);
  return [...slots, ...padding].slice(0, SPELL_SLOT_COUNT);
}

/** Grille fixe de 12 emplacements remplie dans l'ordre de `player.spellIds`. */
export function buildSpellSlots(input: SpellSlotsInput): (SpellDef | null)[] {
  const { combat } = input;
  return padSlots(combat.player.spellIds.map((id) => spellOf(combat, id)));
}

const SLOT_SHORTCUTS: readonly string[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Numéro de touche affiché sur l'emplacement, `null` au-delà de 9. */
export function shortcutNumberForSlot(index: number): string | null {
  return SLOT_SHORTCUTS[index] ?? null;
}

export type LogTone = "player" | "enemy" | "system";

/** Formes produites par `engine/combatLoop` pour une action de combattant. */
const ACTOR_MARKERS: readonly string[] = [" lance ", " se déplace", " se téléporte"];

function isEnemyAction(line: string): boolean {
  return ACTOR_MARKERS.some((marker) => line.includes(marker));
}

/**
 * Le HUD ne reçoit que le nom du joueur : une ligne d'action qui ne commence
 * pas par lui appartient donc à l'adversaire, le reste est du système.
 */
export function logTone(line: string, playerName: string): LogTone {
  if (line.startsWith(playerName)) return "player";
  if (isEnemyAction(line)) return "enemy";
  return "system";
}
