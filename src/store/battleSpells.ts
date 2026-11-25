import { spellUsageKey } from "../engine/combat";
import { canCastSpellNow } from "../engine/multiCombat/spellUse";
import { castBlock } from "../engine/multiCombat";
import { isDefeat, isVictory } from "../engine/multiCombat";
import { isHealSpell, isSpellImplemented, spellSupportRefusal } from "../engine/combatLoop/spellSupport";
import type { BattleState, CombatantLike, RangeSpec } from "../engine/multiCombat";
import type { SpellDef } from "../schemas/spellSchema";
import { heroHasHand } from "./battleSelectors";

/**
 * DEC-12 étape 3b : la barre de sorts d'un `BattleState`, sans réécrire une
 * règle. Les PA, les quotas (`castsPerTurn`/`cooldown`) et la main sont lus par
 * les fonctions du moteur (`canCastSpellNow`, `activeCombatant`, `isVictory`),
 * exactement comme la stratégie ennemie. Ce module ne connaît ni React ni le
 * store : il rend l'état affichable, le rendu ne décide rien.
 *
 * SPELL-04 : **tous** les sorts connus du héros sont rendus, y compris ceux que
 * le 1vN ne sait pas exécuter — désactivés et nommés, jamais un clic mort.
 */
export type BattleSlotState =
  | "disponible"
  | "selectionne"
  | "pa-insuffisants"
  | "quota-epuise"
  | "pas-son-tour"
  | "salle-terminee"
  | "hors-portee"
  | "non-supporte";

export interface BattleSpellSlot {
  spellId: string;
  apCost: number;
  state: BattleSlotState;
  disabled: boolean;
  /** Badge court d'honnêteté : « à venir », « Recharge (2) ». */
  badge: string | null;
  /** Cause longue, écrite dans l'infobulle. */
  reason: string | null;
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

/** Ce que la barre doit dire d'un sort que le 1vN ne sait pas exécuter. */
interface SupportGap {
  state: BattleSlotState;
  badge: string;
  reason: string;
}

const TELEPORT_GAP: SupportGap = { state: "non-supporte", badge: "à venir", reason: "Téléportation pas encore gérée en salle" };
const FUTURE_GAP: SupportGap = { state: "non-supporte", badge: "à venir", reason: "Effet pas encore implémenté" };
const MISSING_GAP: SupportGap = { state: "non-supporte", badge: "état non géré", reason: "État non géré par le moteur" };

/** Écart entre ce que le héros connaît et ce que le moteur 1vN exécute. */
function supportGap(spell: SpellDef): SupportGap | null {
  if (isUnifiedCastable(spell)) return null;
  if (spell.kind === "teleport") return TELEPORT_GAP;
  return spellSupportRefusal(spell) === "missing-state" ? MISSING_GAP : FUTURE_GAP;
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
  const query = { state: input.battle, casterId: hero.id, spell };
  return canCastSpellNow(query) ? spell : null;
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

function quotaOpen(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): boolean {
  return canCastSpellNow({ state: input.battle, casterId: hero.id, spell });
}

/** Tours de recharge restants lus sur `spellUsage` : `0` = pas de recharge. */
function cooldownLeft(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): number {
  const usage = input.battle.spellUsage?.[spellUsageKey(hero.id, spell.id)];
  return usage === undefined ? 0 : Math.max(0, usage.readyAt - input.battle.turn);
}

/** Recharge armée seulement quand le quota refuse : `0` sinon. */
function rechargeLeft(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): number {
  return quotaOpen(input, hero, spell) ? 0 : cooldownLeft(input, hero, spell);
}

/** Ressources du héros : quota (`castsPerTurn`/`cooldown`) puis PA. */
function resourceState(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): BattleSlotState | null {
  if (!quotaOpen(input, hero, spell)) return "quota-epuise";
  return hero.ap < spell.apCost ? "pa-insuffisants" : null;
}

/** Portée déclarée par la donnée : `castBlock` refuse hors bornes et sans LoS. */
function spellRange(spell: SpellDef): RangeSpec {
  return { min: spell.minRange, max: spell.maxRange, requiresLos: spell.requiresLos };
}

/** Ce qu'il faut pour juger un sort : l'entrée, le lanceur, le sort et son écart. */
interface CastContext {
  input: BattleSpellsInput;
  hero: CombatantLike;
  spell: SpellDef;
  gap: SupportGap | null;
}

/** Contexte de jugement **plus** l'état calculé, pour badge et motif. */
interface SlotContext extends CastContext {
  state: BattleSlotState;
}

function targetInSight(context: CastContext, target: CombatantLike): boolean {
  const range = spellRange(context.spell);
  const check = { state: context.input.battle, attacker: context.hero, target, range };
  return castBlock(check) === null;
}

/** Sans carte, aucune mesure : le comportement historique reste intact. */
function measurable(input: BattleSpellsInput): boolean {
  return input.battle.map !== undefined;
}

/**
 * Un sort sans **aucune cible légale** ne s'arme pas : la case le dit et refuse
 * le clic (`hors-portee`), plutôt que de laisser le joueur armer dans le vide.
 * Un soin vise son lanceur : il a toujours une cible.
 */
function hasLegalTarget(context: CastContext): boolean {
  const { input, hero, spell } = context;
  if (isHealSpell(spell) || !measurable(input)) return true;
  const enemies = input.battle.combatants.filter((entry) => entry.side !== hero.side && entry.hp > 0);
  return enemies.some((target) => targetInSight(context, target));
}

function playableState(input: BattleSpellsInput, spell: SpellDef): BattleSlotState {
  return spell.id === input.selectedSpellId ? "selectionne" : "disponible";
}

/** Verrous du tour et écart de support : ils gagnent sur les ressources. */
function blockedState(context: CastContext): BattleSlotState | null {
  const gate = gateState(context.input);
  if (gate !== null) return gate;
  return context.gap === null ? null : context.gap.state;
}

/** Quota et PA d'abord, portée ensuite : le joueur lit la cause la plus proche. */
function resourceOrPortee(context: CastContext): BattleSlotState | null {
  const resource = resourceState(context.input, context.hero, context.spell);
  if (resource !== null) return resource;
  return hasLegalTarget(context) ? null : "hors-portee";
}

function stateOf(context: CastContext): BattleSlotState {
  const blocked = blockedState(context);
  if (blocked !== null) return blocked;
  const resource = resourceOrPortee(context);
  if (resource !== null) return resource;
  return playableState(context.input, context.spell);
}

function isPlayable(state: BattleSlotState): boolean {
  return state === "disponible" || state === "selectionne";
}

const REASONS: Readonly<Partial<Record<BattleSlotState, string>>> = {
  "pa-insuffisants": "PA insuffisants",
  "quota-epuise": "Quota du tour épuisé",
  "pas-son-tour": "Tour adverse",
  "salle-terminee": "Combat terminé",
  "hors-portee": "Hors portée",
};

function rechargeBadge(context: SlotContext): string | null {
  if (context.state !== "quota-epuise") return null;
  const { input, hero, spell } = context;
  const left = rechargeLeft(input, hero, spell);
  return left > 0 ? `Recharge (${left})` : null;
}

function badgeOf(context: SlotContext): string | null {
  return context.gap === null ? rechargeBadge(context) : context.gap.badge;
}

function reasonOf(context: SlotContext): string | null {
  if (context.gap !== null) return context.gap.reason;
  return rechargeBadge(context) ?? REASONS[context.state] ?? null;
}

function slotOf(input: BattleSpellsInput, hero: CombatantLike, spell: SpellDef): BattleSpellSlot {
  const cast = { input, hero, spell, gap: supportGap(spell) };
  const state = stateOf(cast);
  const context = { ...cast, state };
  const disabled = !isPlayable(state);
  return { spellId: spell.id, apCost: spell.apCost, state, disabled, badge: badgeOf(context), reason: reasonOf(context) };
}

/** Tous les sorts connus du héros, dans l'ordre de `spellIds`. */
function heroSpells(input: BattleSpellsInput, hero: CombatantLike): SpellDef[] {
  const ids = hero.spellIds ?? [];
  return ids.flatMap((id) => input.spells.filter((spell) => spell.id === id));
}

/** Sorts du héros, dans l'ordre de `spellIds`, avec leur état de lancement. */
export function battleSpellSlots(input: BattleSpellsInput): BattleSpellSlot[] {
  const hero = heroCombatant(input.battle);
  if (hero === null) return [];
  return heroSpells(input, hero).map((spell) => slotOf(input, hero, spell));
}
