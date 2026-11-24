import { spellUsageKey } from "../../engine/combat";
import { activeCombatant } from "../../engine/multiCombat";
import type { BattleState, CombatantLike } from "../../engine/multiCombat";
import { SPELL_CATALOG } from "../spellCatalog";

/** Le strict nécessaire du sort pour chiffrer le bouton : un `SpellDef` en fait partie. */
export interface AttackSpell {
  id: string;
  apCost: number;
}

/** Ce que le bouton « Attaquer » lit sur le héros actif. */
export interface AttackGate {
  /** PA restants du héros. */
  ap: number;
  /** Coût du sort de dégâts, lu dans `data/spells.yaml`. */
  apCost: number;
  /** Tours de recharge restants : `0` = sort prêt. */
  cooldownLeft: number;
}

export interface AttackButtonState {
  disabled: boolean;
  label: string;
}

/** Sort inconnu (aucune classe chargée) : l'ancien libellé, aucun chiffre inventé. */
const NO_SPELL: AttackButtonState = { disabled: false, label: "Attaquer" };

/** Le bouton n'existe qu'au tour du héros : hors main, rien à chiffrer. */
function heroOnTurn(state: BattleState): CombatantLike | null {
  const active = activeCombatant(state);
  if (active === null || active.side !== "player") return null;
  return active;
}

function cooldownLeft(state: BattleState, casterId: string, spell: AttackSpell): number {
  const usage = state.spellUsage?.[spellUsageKey(casterId, spell.id)];
  if (usage === undefined) return 0;
  return Math.max(0, usage.readyAt - state.turn);
}

/** PA du héros, coût et recharge du sort : tout ce qui décide du clic. */
export function attackGate(state: BattleState, spell: AttackSpell | null): AttackGate | null {
  const hero = heroOnTurn(state);
  if (hero === null || spell === null) return null;
  return { ap: hero.ap, apCost: spell.apCost, cooldownLeft: cooldownLeft(state, hero.id, spell) };
}

/**
 * État du bouton : la recharge l'emporte sur les PA (le joueur voit pourquoi il
 * attend), et le libellé annonce toujours le coût réel quand il est connu.
 */
export function attackButtonState(gate: AttackGate | null): AttackButtonState {
  if (gate === null) return NO_SPELL;
  const label = `Attaquer (${gate.apCost} PA)`;
  if (gate.cooldownLeft > 0) return { disabled: true, label: `Recharge (${gate.cooldownLeft})` };
  return { disabled: gate.ap < gate.apCost, label };
}

/** Sort de dégâts du héros : le premier de ses sorts connus qui frappe. */
function damageSpellOf(hero: CombatantLike): AttackSpell | null {
  const ids = hero.spellIds ?? [];
  const known = ids.map((id) => SPELL_CATALOG.find((spell) => spell.id === id));
  return known.find((spell) => spell?.kind === "damage") ?? null;
}

/** État du bouton du panneau : sort résolu dans `data/spells.yaml`, zéro chiffre en dur. */
export function battleAttackButton(battle: BattleState): AttackButtonState {
  const hero = heroOnTurn(battle);
  if (hero === null) return NO_SPELL;
  return attackButtonState(attackGate(battle, damageSpellOf(hero)));
}
