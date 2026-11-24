import type { BattleState, CastBlock, CombatantLike, RangeSpec, Side } from "../engine/multiCombat";
import { activeCombatant, castBlock, isAlive, targetsOf } from "../engine/multiCombat";
import { hpRatio } from "./tokens";

/** Vue d'un combattant 1vN : tout vient de `BattleState`, aucune valeur en dur. */
export interface BattleCombatantView {
  id: string;
  name: string;
  side: Side;
  level: number;
  hp: number;
  maxHp: number;
  ap: number;
  mp: number;
  /** Ratio de PV borné `[0, 1]`, pour une barre 100 % procédurale. */
  hpRatio: number;
  /** Couleur CSS déterministe dérivée de l'id (aucun asset, aucune palette externe). */
  color: string;
  /** C'est son tour dans la timeline. */
  isActive: boolean;
  /** Cible valide : camp opposé, vivante, à portée et avec ligne de vue. */
  isTargetable: boolean;
  /** Raison géométrique du refus, `null` quand la cible est attaquable. */
  blockedReason: CastBlock | null;
}

const HUE_COUNT = 360;
const SATURATION_MIN = 55;
const SATURATION_SPAN = 20;
const LIGHTNESS_MIN = 42;
const LIGHTNESS_SPAN = 16;
const FNV_OFFSET = 2_166_136_261;
const FNV_PRIME = 16_777_619;

/** FNV-1a 32 bits : déterministe, indépendant de la plateforme. */
function hashId(id: string): number {
  let hash = FNV_OFFSET;
  for (const char of id) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

/** Couleur HSL stable : un même id rend toujours la même couleur. */
export function colorForId(id: string): string {
  const hash = hashId(id);
  const hue = hash % HUE_COUNT;
  const saturation = SATURATION_MIN + ((hash >>> 8) % SATURATION_SPAN);
  const lightness = LIGHTNESS_MIN + ((hash >>> 16) % LIGHTNESS_SPAN);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

interface ViewContext {
  state: BattleState;
  active: CombatantLike | null;
  targets: ReadonlySet<string>;
}

interface CastGeometry {
  attacker: CombatantLike;
  range: RangeSpec;
}

interface ViewFlags {
  isActive: boolean;
  isTargetable: boolean;
  blockedReason: CastBlock | null;
}

/** Cibles du camp opposé : la vivacité seule, la géométrie vient ensuite. */
function targetIds(state: BattleState, active: CombatantLike | null): ReadonlySet<string> {
  if (active === null || !isAlive(active)) return new Set();
  return new Set(targetsOf(state, active.side).map((combatant) => combatant.id));
}

/** Portée du héros, exploitable seulement si la grille est connue. */
function heroRange(state: BattleState): RangeSpec | null {
  if (state.map === undefined) return null;
  return state.castRange ?? null;
}

/**
 * Géométrie applicable : seul le camp du héros porte `castRange`, les ripostes
 * ennemies n'ont pas de portée déclarée (aucun déplacement d'approche en 5C).
 */
function castGeometry(context: ViewContext): CastGeometry | null {
  const { active } = context;
  const range = heroRange(context.state);
  if (active === null || active.side !== "player" || range === null) return null;
  return { attacker: active, range };
}

function blockFor(context: ViewContext, combatant: CombatantLike): CastBlock | null {
  const geometry = castGeometry(context);
  if (geometry === null || !context.targets.has(combatant.id)) return null;
  return castBlock({ state: context.state, attacker: geometry.attacker, target: combatant, range: geometry.range });
}

function flagsFor(context: ViewContext, combatant: CombatantLike): ViewFlags {
  const isActive = context.active?.id === combatant.id;
  const blockedReason = blockFor(context, combatant);
  const isTargetable = context.targets.has(combatant.id) && blockedReason === null;
  return { isActive, isTargetable, blockedReason };
}

function combatantView(combatant: CombatantLike, context: ViewContext): BattleCombatantView {
  const { id, name, side, level, hp, maxHp, ap, mp } = combatant;
  const flags = flagsFor(context, combatant);
  return { id, name, side, level, hp, maxHp, ap, mp, hpRatio: hpRatio(hp, maxHp), color: colorForId(id), ...flags };
}

/**
 * Vue du 1vN : seuls les vivants, dans l'ordre de `state.combatants`
 * (héros puis les N ennemis). `order` n'est pas modifié : le tour saute déjà
 * les morts, ce panneau ne fait que les masquer.
 */
export function battleViewModel(state: BattleState | null): BattleCombatantView[] {
  if (state === null) return [];
  const active = activeCombatant(state);
  const context = { state, active, targets: targetIds(state, active) };
  return state.combatants.filter(isAlive).map((combatant) => combatantView(combatant, context));
}

/** Portillon du panneau : `battle` seul décide, le 1v1 (`combat`) n'est jamais concerné. */
export function shouldRenderBattle(state: BattleState | null): state is BattleState {
  return state !== null;
}
