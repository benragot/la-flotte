import { isDefeat, isVictory } from "../engine/multiCombat";
import { canCastSpellNow } from "../engine/multiCombat/spellUse";
import { isHealSpell, isSpellImplemented } from "../engine/combatLoop/spellSupport";
import type { BattleState, CombatantLike } from "../engine/multiCombat";
import type { SpellDef } from "../schemas/spellSchema";
import { heroHasHand } from "./battleSelectors";

/**
 * DEC-12 étape 3b : la barre de sorts d'un `BattleState`, sans réécrire une
 * règle. Les PA, les quotas (`castsPerTurn`/`cooldown`) et la main sont lus par
 * les fonctions du moteur (`canCastSpellNow`, `activeCombatant`, `isVictory`),
 * exactement comme la stratégie ennemie. Ce module ne connaît ni React ni le
 * store : il rend l'état affichable, le rendu ne décide rien.
 */
export type BattleSlotState =
  | "disponible"
  | "selectionne"
  | "pa-insuffisants"
  | "quota-epuise"
  | "pas-son-tour"
  | "salle-terminee";

export interface BattleSpellSlot {
  spellId: string;
  apCost: number;
  state: BattleSlotState;
  disabled: boolean;
}

export interface BattleSpellsInput {
  battle: BattleState;
  /** Catalogue `data/spells.yaml` : la bataille ne transporte que des ids. */
  spells: readonly SpellDef[];
  selectedSpellId: string | null;
}

/** Le héros est le camp `player` : la barre ne lit jamais un monstre. */
export function heroCombatant(battle: BattleState): CombatantLike | null {
  return battle.combatants.find((entry) => entry.side === "player") ?? null;
}

/** Plus rien à lancer : plus aucun ennemi vivant, ou plus aucun héros. */
export function battleOver(battle: BattleState): boolean {
  return isVictory(battle) || isDefeat(battle);
}

/**
 * Le chemin unifié résout les frappes (`castHeroSpell` → `resolveAttack`) et,
 * depuis SPELL-02, les soins (`resolveHeal`). Un `teleport` ou tout autre effet
 * non implémenté reste hors barre plutôt que de promettre un clic qui ne
 * ferait rien.
 */
export function isUnifiedCastable(spell: SpellDef): boolean {
  return (spell.kind === "damage" || isHealSpell(spell)) && isSpellImplemented(spell);
}

/** Sort du catalogue par id ; la bataille ne transporte que des ids. */
function spellById(spells: readonly SpellDef[], spellId: string | null): SpellDef | null {
  if (spellId === null) return null;
  return spells.find((entry) => entry.id === spellId) ?? null;
}

function heroOwns(hero: CombatantLike, spell: SpellDef): boolean {
  return (hero.spellIds ?? []).includes(spell.id);
}

function castableNow(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): SpellDef | null {
  if (!isUnifiedCastable(spell)) return null;
  return canCastSpellNow(input.battle, hero.id, spell) ? spell : null;
}

/** La main du héros et la propriété du sort : les deux gardes de camp. */
function heroReady(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): boolean {
  return heroHasHand(input.battle) && heroOwns(hero, spell);
}

/**
 * Sort armé réellement résoluble **maintenant** : il appartient au héros, la
 * main est à lui (`heroHasHand`, garde #156), et le quota est ouvert. Un clic
 * hors tour rend `null` : l'appelant n'entre pas dans `castHeroSpell` et ne
 * journalise rien — inerte et silencieux, jamais un faux départ.
 */
export function armedBattleSpell(input: BattleSpellsInput): SpellDef | null {
  const hero = heroCombatant(input.battle);
  const spell = spellById(input.spells, input.selectedSpellId);
  if (hero === null || spell === null) return null;
  return heroReady(input, hero, spell) ? castableNow(input, hero, spell) : null;
}

/** Verrous de bataille : ils gagnent sur tout le reste. */
function gateState(input: BattleSpellsInput): BattleSlotState | null {
  if (battleOver(input.battle)) return "salle-terminee";
  if (!heroHasHand(input.battle)) return "pas-son-tour";
  return null;
}

/** Ressources du héros : quota (`castsPerTurn`/`cooldown`) puis PA. */
function resourceState(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): BattleSlotState | null {
  if (!canCastSpellNow(input.battle, hero.id, spell)) return "quota-epuise";
  return hero.ap < spell.apCost ? "pa-insuffisants" : null;
}

function playableState(input: BattleSpellsInput, spell: SpellDef): BattleSlotState {
  return spell.id === input.selectedSpellId ? "selectionne" : "disponible";
}

function stateOf(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): BattleSlotState {
  const gate = gateState(input);
  if (gate !== null) return gate;
  return resourceState(input, hero, spell) ?? playableState(input, spell);
}

function isPlayable(state: BattleSlotState): boolean {
  return state === "disponible" || state === "selectionne";
}

function slotOf(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): BattleSpellSlot {
  const state = stateOf(input, hero, spell);
  return { spellId: spell.id, apCost: spell.apCost, state, disabled: !isPlayable(state) };
}

function heroSpells(input: BattleSpellsInput, hero: CombatantLike): SpellDef[] {
  const ids = hero.spellIds ?? [];
  const owned = ids.flatMap((id) => input.spells.filter((spell) => spell.id === id));
  return owned.filter(isUnifiedCastable);
}

/** Sorts du héros, dans l'ordre de `spellIds`, avec leur état de lancement. */
export function battleSpellSlots(input: BattleSpellsInput): BattleSpellSlot[] {
  const hero = heroCombatant(input.battle);
  if (hero === null) return [];
  return heroSpells(input, hero).map((spell) => slotOf(input, hero, spell));
}
