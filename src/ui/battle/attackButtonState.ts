import { spellUsageKey } from "../../engine/combat";
import { activeCombatant } from "../../engine/multiCombat";
import type { BattleState, CombatantLike } from "../../engine/multiCombat";
import type { SpellDef } from "../../schemas/spellSchema";
import { isHealSpell } from "../../engine/combatLoop/spellSupport";
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
/** Soin armé : l'ennemi n'est plus prenable, la cible est le héros. */
const HEAL_ARMED: AttackButtonState = { disabled: true, label: "Soin armé" };

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
 * État d'un bouton d'action : la recharge l'emporte sur les PA (le joueur voit
 * pourquoi il attend), et le libellé annonce toujours le coût réel quand il est
 * connu. Le verbe vient de l'appelant : « Attaquer » ou « Se soigner ».
 */
export function actionButtonState(gate: AttackGate | null, verb: string): AttackButtonState {
  if (gate === null) return NO_SPELL;
  const label = `${verb} (${gate.apCost} PA)`;
  if (gate.cooldownLeft > 0) return { disabled: true, label: `Recharge (${gate.cooldownLeft})` };
  return { disabled: gate.ap < gate.apCost, label };
}

export function attackButtonState(gate: AttackGate | null): AttackButtonState {
  return actionButtonState(gate, "Attaquer");
}

/** Sort connu du héros, `undefined` s'il ne le connaît pas. */
function knownSpell(hero: CombatantLike, spellId: string | null): SpellDef | undefined {
  if (spellId === null) return undefined;
  const ids = hero.spellIds ?? [];
  if (!ids.includes(spellId)) return undefined;
  return SPELL_CATALOG.find((spell) => spell.id === spellId);
}

function knownSpells(hero: CombatantLike): readonly (SpellDef | undefined)[] {
  return (hero.spellIds ?? []).map((id) => SPELL_CATALOG.find((spell) => spell.id === id));
}

function firstDamage(spells: readonly (SpellDef | undefined)[]): AttackSpell | null {
  return spells.find((spell) => spell?.kind === "damage") ?? null;
}

/** Le sort armé s'il frappe, sinon le premier sort de dégâts du héros. */
function damageSpell(hero: CombatantLike, spellId: string | null): AttackSpell | null {
  const chosen = knownSpell(hero, spellId);
  if (chosen?.kind === "damage") return chosen;
  return firstDamage(knownSpells(hero));
}

/** Sort de soin armé : l'ennemi n'est plus prenable, la cible est le héros. */
function healArmed(hero: CombatantLike, spellId: string | null): boolean {
  const spell = knownSpell(hero, spellId);
  return spell !== undefined && isHealSpell(spell);
}

/**
 * État du bouton du panneau : le coût suit **le sort armé** (SPELL-04). Un soin
 * armé désactive l'attaque — le héros est la cible, pas l'ennemi.
 */
export function battleAttackButton(battle: BattleState, selectedSpellId: string | null = null): AttackButtonState {
  const hero = heroOnTurn(battle);
  if (hero === null) return NO_SPELL;
  if (healArmed(hero, selectedSpellId)) return HEAL_ARMED;
  return attackButtonState(attackGate(battle, damageSpell(hero, selectedSpellId)));
}

/** Sort de soin armé, pour le bouton de la carte du héros ; `null` sinon. */
export function battleSelfButton(battle: BattleState, selectedSpellId: string | null): AttackButtonState | null {
  const hero = heroOnTurn(battle);
  if (hero === null || !healArmed(hero, selectedSpellId)) return null;
  return actionButtonState(attackGate(battle, knownSpell(hero, selectedSpellId) ?? null), "Se soigner");
}
