import type { StatBlock, StatField, TotalStats } from "./types";

const ZERO_STATS: TotalStats = {
  vitality: 0,
  wisdom: 0,
  strength: 0,
  intelligence: 0,
  chance: 0,
  agility: 0,
  hp: 0,
  ap: 0,
  mp: 0,
  percentDmg: 0,
  flatRes: 0,
  percentRes: 0,
  prospection: 0,
};

/** Clés de `StatBlock`, dérivées de la table zéro pour rester exhaustives. */
export const STAT_FIELDS: readonly StatField[] = Object.keys(ZERO_STATS) as StatField[];

export function zeroStats(): TotalStats {
  return { ...ZERO_STATS };
}

/** Additionne `block` dans une copie de `total` : aucune mutation d'entrée. */
export function mergeStats(total: TotalStats, block: StatBlock): TotalStats {
  const next = { ...total };
  for (const field of STAT_FIELDS) next[field] += block[field] ?? 0;
  return next;
}

export function sumStats(blocks: readonly StatBlock[]): TotalStats {
  return blocks.reduce(mergeStats, zeroStats());
}
