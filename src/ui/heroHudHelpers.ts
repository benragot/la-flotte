import type { Hero } from "../engine/createHero";
import type { ClassDef, SoftCap, SoftCaps, StatKey } from "../schemas/classSchema";

export interface StatOption {
  stat: StatKey;
  label: string;
  current: number;
  cost: number;
  affordable: boolean;
}

export interface ClassSummary {
  id: string;
  name: string;
  basePa: number;
  basePm: number;
  baseHp: number;
  basePp: number;
}

/** Ordre d'affichage figé du panneau de capital (colonnes Dofus 1.29). */
export const STAT_KEYS: readonly StatKey[] = [
  "vitality",
  "wisdom",
  "strength",
  "intelligence",
  "chance",
  "agility",
];

const STAT_LABELS: Record<StatKey, string> = {
  vitality: "Vitalité",
  wisdom: "Sagesse",
  strength: "Force",
  intelligence: "Intelligence",
  chance: "Chance",
  agility: "Agilité",
};

const NAME_MAX_LENGTH = 20;

function isFlatRate(caps: readonly SoftCap[]): boolean {
  return caps.length === 1;
}

/** Table à un palier `[capitalPerPoint, gain]` : le coût est le premier terme. */
function flatRateCost(caps: readonly SoftCap[]): number {
  const [capitalPerPoint] = caps[0] ?? [];
  return capitalPerPoint ?? Number.POSITIVE_INFINITY;
}

/** Palier contenant la valeur visée : seuil `>=` comme `spendStatPoints`. */
function tierCost(caps: readonly SoftCap[], target: number): number {
  for (const [threshold, capitalPerPoint] of caps) {
    if (threshold === null || threshold >= target) return capitalPerPoint;
  }
  return Number.POSITIVE_INFINITY;
}

export function statCostAt(input: {
  softCaps: SoftCaps;
  stat: StatKey;
  value: number;
}): number {
  const caps = input.softCaps[input.stat];
  if (isFlatRate(caps)) return flatRateCost(caps);
  return tierCost(caps, input.value + 1);
}

function optionFor(hero: Hero, classDef: ClassDef, stat: StatKey): StatOption {
  const cost = statCostAt({ softCaps: classDef.softCaps, stat, value: hero[stat] });
  return { stat, label: STAT_LABELS[stat], current: hero[stat], cost, affordable: hero.capitalPoints >= cost };
}

export function buildStatOptions(input: { hero: Hero; classDef: ClassDef }): StatOption[] {
  return STAT_KEYS.map((stat) => optionFor(input.hero, input.classDef, stat));
}

export function canAffordAnyStat(input: { hero: Hero; classDef: ClassDef }): boolean {
  return buildStatOptions(input).some((option) => option.affordable);
}

function pluralPoints(points: number): string {
  return points > 1 ? "pts" : "pt";
}

/** Borne basse d'un palier : seuil précédent exclu, donc + 1. */
function lowerBound(caps: readonly SoftCap[], index: number): number {
  return (caps[index - 1]?.[0] ?? 0) + 1;
}

function tierIndexFor(caps: readonly SoftCap[], target: number): number {
  const found = caps.findIndex(([threshold]) => threshold === null || threshold >= target);
  return found === -1 ? caps.length - 1 : found;
}

function formatRange(caps: readonly SoftCap[], index: number): string {
  const upper = caps[index]?.[0] ?? null;
  const lower = lowerBound(caps, index);
  return upper === null ? `${lower}+` : `${lower}→${upper}`;
}

function costLabel(cost: number): string {
  return `${cost} ${pluralPoints(cost)}`;
}

function formatTierRange(caps: readonly SoftCap[], value: number): string {
  return formatRange(caps, tierIndexFor(caps, value + 1));
}

export function formatSoftCapTier(input: {
  softCaps: SoftCaps;
  stat: StatKey;
  value: number;
}): string {
  const caps = input.softCaps[input.stat];
  const label = costLabel(statCostAt(input));
  if (isFlatRate(caps)) return `Taux fixe : ${label}`;
  return `${formatTierRange(caps, input.value)} : ${label}`;
}

export function classSummary(classDef: ClassDef): ClassSummary {
  const { id, name, basePa, basePm, baseHp, basePp } = classDef;
  return { id, name, basePa, basePm, baseHp, basePp };
}

export function isValidCharacterName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= NAME_MAX_LENGTH;
}
