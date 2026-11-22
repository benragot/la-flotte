import { equippedItems } from "./equipment";
import { getActiveSetBonuses } from "./sets";
import { sumStats } from "./stats";
import type { StatBlock, TotalStats, TotalStatsInput } from "./types";

function wornStats(input: TotalStatsInput): StatBlock[] {
  return equippedItems(input).map((item) => item.stats ?? {});
}

function wornSetBonuses(input: TotalStatsInput): StatBlock[] {
  return getActiveSetBonuses(input).flatMap((entry) => entry.bonuses);
}

/**
 * Somme commutative : `base + capital + stats des items équipés + bonus de
 * panoplie active`, toutes clés présentes (0 par défaut), sans mutation.
 */
export function computeTotalStats(input: TotalStatsInput): TotalStats {
  const blocks = [input.base, input.capital, ...wornStats(input), ...wornSetBonuses(input)];
  return sumStats(blocks);
}
