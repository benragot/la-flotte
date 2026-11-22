import type { BattleState, CombatantLike, Side } from "../engine/multiCombat";
import { activeCombatant, targetsOf } from "../engine/multiCombat";
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
  /** Cible valide pour le camp de l'actif (`targetsOf`). */
  isTargetable: boolean;
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

/** Cibles valides : celles du camp opposé au combattant actif. */
function targetIds(state: BattleState): ReadonlySet<string> {
  const active = activeCombatant(state);
  if (active === null) return new Set();
  return new Set(targetsOf(state, active.side).map((combatant) => combatant.id));
}

function combatantView(
  combatant: CombatantLike,
  activeId: string | null,
  targets: ReadonlySet<string>,
): BattleCombatantView {
  const { id, name, side, level, hp, maxHp, ap, mp } = combatant;
  const flags = { isActive: activeId === id, isTargetable: targets.has(id) };
  return { id, name, side, level, hp, maxHp, ap, mp, hpRatio: hpRatio(hp, maxHp), color: colorForId(id), ...flags };
}

/** Vue du 1vN dans l'ordre de `state.combatants` : héros puis les N ennemis. */
export function battleViewModel(state: BattleState | null): BattleCombatantView[] {
  if (state === null) return [];
  const activeId = activeCombatant(state)?.id ?? null;
  const targets = targetIds(state);
  return state.combatants.map((combatant) => combatantView(combatant, activeId, targets));
}

/** Portillon du panneau : `battle` seul décide, le 1v1 (`combat`) n'est jamais concerné. */
export function shouldRenderBattle(state: BattleState | null): state is BattleState {
  return state !== null;
}
