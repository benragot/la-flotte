import type { Element, SpellDef, SpellDamage, SpellEffect, SpellKind } from "../../../schemas/spellSchema";
import { formatSpellRange } from "../../hudHelpers";

/** Ligne prête à afficher : libellé lisible et valeur déjà formatée. */
export interface SpellDetailRow {
  key: string;
  label: string;
  value: string;
}

/**
 * Modèle de vue **honnête** d'un sort : chaque champ absent du YAML reste
 * `undefined`, et `rows` ne porte que les champs réellement présents. Aucun `0`
 * ni `-` de remplissage : le grimoire affiche ce que la donnée dit.
 */
export interface SpellDetailView {
  id: string;
  name: string;
  description: string;
  kind: string;
  apCost: number;
  element: string | undefined;
  damage: string | undefined;
  range: string;
  requiresLos: boolean;
  cooldown: number | undefined;
  castsPerTurn: number | undefined;
  castsPerTarget: number | undefined;
  pushCells: number | undefined;
  requiresState: string | undefined;
  effect: string | undefined;
  rows: SpellDetailRow[];
}

export interface HeroSpellsInput {
  /** Catalogue complet (`data/spells.yaml`) : jamais affiché tel quel. */
  spells: readonly SpellDef[];
  classId: string;
  /** Ids réellement appris (combat en cours) : prime sur l'appartenance de classe. */
  learnedIds?: readonly string[] | undefined;
}

const ELEMENT_LABELS: Record<Element, string> = {
  earth: "Terre",
  fire: "Feu",
  water: "Eau",
  air: "Air",
  neutral: "Neutre",
};

const KIND_LABELS: Record<SpellKind, string> = {
  damage: "Dégâts",
  teleport: "Téléportation",
  other: "Utilitaire",
};

const STATE_LABELS: Record<NonNullable<SpellDef["requiresState"]>, string> = { drunk: "Ivre" };

const EFFECT_LABELS: Record<SpellEffect["type"], string> = {
  heal: "Soin",
  buff: "Bonus",
  debuff: "Malus",
  summon: "Invocation",
  trap: "Piège",
  glyph: "Glyphe",
  state: "État",
  push: "Poussée",
  steal: "Vol",
  reflect: "Renvoi",
};

const TARGET_LABELS: Record<NonNullable<SpellEffect["target"]>, string> = {
  self: "soi",
  ally: "allié",
  enemy: "ennemi",
  cell: "case",
  area: "zone",
};

function damageLabel(damage?: SpellDamage): string | undefined {
  return damage === undefined ? undefined : `${damage.min}–${damage.max}`;
}

function elementLabel(element?: Element): string | undefined {
  return element === undefined ? undefined : ELEMENT_LABELS[element];
}

function turnsLabel(turns?: number): string | undefined {
  if (turns === undefined) return undefined;
  return `${turns} tour${turns > 1 ? "s" : ""}`;
}

function cellsLabel(cells?: number): string | undefined {
  if (cells === undefined) return undefined;
  return `${cells} case${cells > 1 ? "s" : ""}`;
}

function countLabel(count?: number): string | undefined {
  return count === undefined ? undefined : `${count}`;
}

function targetPart(target?: SpellEffect["target"]): string | undefined {
  return target === undefined ? undefined : TARGET_LABELS[target];
}

function present(parts: readonly (string | undefined)[]): string[] {
  return parts.filter((part): part is string => part !== undefined);
}

function effectParts(effect: SpellEffect): readonly (string | undefined)[] {
  const head = [EFFECT_LABELS[effect.type], damageLabel(effect.amount), countLabel(effect.value)];
  return [...head, turnsLabel(effect.duration), targetPart(effect.target)];
}

/** « Glyphe · 1–3 · 3 tours · soi » : uniquement les morceaux que la donnée porte. */
function effectLabel(effect?: SpellEffect): string | undefined {
  if (effect === undefined) return undefined;
  return present(effectParts(effect)).join(" · ");
}

function losValue(requiresLos: boolean): string {
  return requiresLos ? "Requise" : "Non requise";
}

function row(key: string, label: string, value: string | undefined): SpellDetailRow[] {
  return value === undefined ? [] : [{ key, label, value }];
}

type SpellFacts = Omit<SpellDetailView, "rows">;

type SpellRowBuilder = (facts: SpellFacts) => SpellDetailRow[];

/** Table de correspondance : une ligne par champ affichable, aucune ligne vide. */
const ROW_BUILDERS: readonly SpellRowBuilder[] = [
  (facts) => row("element", "Élément", facts.element),
  (facts) => row("damage", "Dégâts", facts.damage),
  (facts) => row("range", "Portée", facts.range),
  (facts) => row("los", "Ligne de vue", losValue(facts.requiresLos)),
  (facts) => row("cooldown", "Recharge", turnsLabel(facts.cooldown)),
  (facts) => row("castsPerTurn", "Lancers par tour", countLabel(facts.castsPerTurn)),
  (facts) => row("castsPerTarget", "Lancers par cible", countLabel(facts.castsPerTarget)),
  (facts) => row("push", "Poussée", cellsLabel(facts.pushCells)),
  (facts) => row("requiresState", "État requis", facts.requiresState),
  (facts) => row("effect", "Effet", facts.effect),
];

function identityOf(spell: SpellDef): Pick<SpellFacts, "id" | "name" | "description" | "kind" | "apCost"> {
  const { id, name, description, apCost } = spell;
  return { id, name, description, kind: KIND_LABELS[spell.kind], apCost };
}

function targetingOf(spell: SpellDef): Pick<SpellFacts, "element" | "damage" | "range" | "requiresLos"> {
  const element = elementLabel(spell.element);
  return { element, damage: damageLabel(spell.damage), range: formatSpellRange(spell), requiresLos: spell.requiresLos };
}

function limitsOf(spell: SpellDef): Pick<SpellFacts, "cooldown" | "castsPerTurn" | "castsPerTarget" | "pushCells" | "requiresState" | "effect"> {
  const { cooldown, castsPerTurn, castsPerTarget, pushCells } = spell;
  const state = spell.requiresState;
  return { cooldown, castsPerTurn, castsPerTarget, pushCells, requiresState: state === undefined ? undefined : STATE_LABELS[state], effect: effectLabel(spell.effect) };
}

/** Modèle de vue complet d'un sort, sans DOM ni store. */
export function spellDetail(spell: SpellDef): SpellDetailView {
  const facts: SpellFacts = { ...identityOf(spell), ...targetingOf(spell), ...limitsOf(spell) };
  return { ...facts, rows: ROW_BUILDERS.flatMap((build) => build(facts)) };
}

function spellsForIds(spells: readonly SpellDef[], ids: readonly string[]): SpellDef[] {
  const byId = new Map(spells.map((spell) => [spell.id, spell]));
  const found = ids.map((id) => byId.get(id));
  return found.filter((spell): spell is SpellDef => spell !== undefined);
}

/** Sorts du héros : la liste apprise du combat, sinon ceux de sa classe. */
export function heroSpells(input: HeroSpellsInput): SpellDef[] {
  if (input.learnedIds !== undefined) return spellsForIds(input.spells, input.learnedIds);
  return input.spells.filter((spell) => spell.classId === input.classId);
}

/** Résumé d'une ligne de liste : « 3 PA · Terre · 8–12 · 1–2 PO ». */
export function spellSummary(view: SpellDetailView): string {
  const head = `${view.apCost} PA`;
  return present([head, view.element, view.damage, view.range]).join(" · ");
}
