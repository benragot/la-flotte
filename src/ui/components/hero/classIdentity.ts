import type { ClassDef, SoftCap, StatKey } from "../../../schemas/classSchema";
import type { SpellDef, SpellEffect } from "../../../schemas/spellSchema";
import type { SpellDetailView } from "../spellbook/spellbookView";
import { spellDetail } from "../spellbook/spellbookView";

/**
 * Modèle de vue de la carte de classe — **aucune statistique inventée**.
 *
 * En 1.29, les stats de départ ne distinguent pas les classes (55 PV / 6 PA /
 * 3 PM) : le seul socle commun est calculé depuis `data/classes.yaml`, et seuls
 * les écarts réels du fichier (PP d'Enutrof, gain de vitalité du Sacrieur) sont
 * affichés par classe. L'identité vient des **trois sorts** de `data/spells.yaml`
 * (liés par `classId`) et des **paliers de soft cap** de `classes.yaml`.
 */

/** Les quatre voies élémentaires : ce sont leurs courbes qui changent. */
export const CAP_STATS: readonly StatKey[] = ["strength", "intelligence", "chance", "agility"];

const CAP_LABELS: Record<StatKey, string> = {
  vitality: "Vit",
  wisdom: "Sag",
  strength: "For",
  intelligence: "Int",
  chance: "Cha",
  agility: "Agi",
};

export interface CapLine {
  stat: StatKey;
  label: string;
  value: string;
}

export interface ClassExtra {
  key: string;
  label: string;
}

export interface ClassSpellLine {
  spell: SpellDef;
  view: SpellDetailView;
  meta: string;
}

export interface BaseSocle {
  hp: number | null;
  ap: number | null;
  mp: number | null;
  pp: number | null;
  ppMode: number | null;
  vitalityGain: number | null;
}

/** « ×1→100 » : coût de 1 point de capital par +1, jusqu'à 100 inclus. */
function capPart([threshold, cost]: SoftCap): string {
  return threshold === null ? `×${cost}+` : `×${cost}→${threshold}`;
}

export function formatCaps(tiers: readonly SoftCap[]): string {
  return tiers.map(capPart).join(" ");
}

export function capLines(classDef: ClassDef): CapLine[] {
  return CAP_STATS.map((stat) => ({
    stat,
    label: CAP_LABELS[stat],
    value: formatCaps(classDef.softCaps[stat]),
  }));
}

/** Libellés courts d'effet : une ligne de carte, pas la fiche du grimoire. */
const EFFECT_SHORT: Record<SpellEffect["type"], string> = {
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

function effectValue(effect: SpellEffect): string {
  const value = effect.amount === undefined ? effect.value : `${effect.amount.min}–${effect.amount.max}`;
  return value === undefined ? "" : ` ${value}`;
}

function shortEffect(effect: SpellEffect): string {
  return `${EFFECT_SHORT[effect.type]}${effectValue(effect)}`;
}

/** Dégâts et élément (« 8–12 Terre ») ; sinon le type (« Téléportation »). */
function damageText(spell: SpellDef, view: SpellDetailView): string {
  if (spell.damage === undefined) return view.kind;
  const element = view.element === undefined ? "" : ` ${view.element}`;
  return `${spell.damage.min}–${spell.damage.max}${element}`;
}

function spellBody(spell: SpellDef, view: SpellDetailView): string {
  return spell.effect === undefined ? damageText(spell, view) : shortEffect(spell.effect);
}

function spellMeta(spell: SpellDef, view: SpellDetailView): string {
  return `${spell.apCost} PA · ${spellBody(spell, view)}`;
}

export function classSpellLine(spell: SpellDef): ClassSpellLine {
  const view = spellDetail(spell);
  return { spell, view, meta: spellMeta(spell, view) };
}

function commonOf(values: readonly number[]): number | null {
  const [first] = values;
  if (first === undefined) return null;
  return values.every((value) => value === first) ? first : null;
}

function countValues(values: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function betterEntry(best: [number, number] | null, entry: [number, number]): boolean {
  return best === null || entry[1] > best[1];
}

function firstOf(entry: [number, number] | null): number | null {
  return entry === null ? null : entry[0];
}

function mostFrequent(counts: Map<number, number>): number | null {
  let best: [number, number] | null = null;
  for (const entry of counts) {
    if (betterEntry(best, entry)) best = entry;
  }
  return firstOf(best);
}

function modeOf(values: readonly number[]): number | null {
  return mostFrequent(countValues(values));
}

export function baseSocle(classes: readonly ClassDef[]): BaseSocle {
  const hp = commonOf(classes.map((entry) => entry.baseHp));
  const ap = commonOf(classes.map((entry) => entry.basePa));
  const mp = commonOf(classes.map((entry) => entry.basePm));
  const pp = commonOf(classes.map((entry) => entry.basePp));
  const ppMode = modeOf(classes.map((entry) => entry.basePp));
  return { hp, ap, mp, pp, ppMode, vitalityGain: modeOf(classes.map((entry) => entry.vitalityGainPerPoint)) };
}

function soclePart(value: number | null, unit: string): string[] {
  return value === null ? [] : [`${value} ${unit}`];
}

/** « Socle commun 1.29 : 55 PV · 6 PA · 3 PM » — seuls les champs unanimes. */
export function socleLabel(socle: BaseSocle): string {
  const parts = [...soclePart(socle.hp, "PV"), ...soclePart(socle.ap, "PA"), ...soclePart(socle.mp, "PM"), ...soclePart(socle.pp, "PP")];
  return `Socle commun 1.29 : ${parts.join(" · ")}`;
}

function ppExtra(classDef: ClassDef, mode: number | null): ClassExtra[] {
  if (mode === null || classDef.basePp === mode) return [];
  return [{ key: "pp", label: `PP ${classDef.basePp}` }];
}

function vitalityExtra(classDef: ClassDef, mode: number | null): ClassExtra[] {
  if (mode === null || classDef.vitalityGainPerPoint === mode) return [];
  return [{ key: "vitality", label: `Vitalité +${classDef.vitalityGainPerPoint} PV/pt` }];
}

/** Écarts réels d'une classe au socle : seuls ceux que le YAML porte. */
export function classExtras(classDef: ClassDef, socle: BaseSocle): ClassExtra[] {
  return [...ppExtra(classDef, socle.ppMode), ...vitalityExtra(classDef, socle.vitalityGain)];
}
