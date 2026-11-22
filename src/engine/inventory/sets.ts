import { equippedItems } from "./equipment";
import type { ActiveSetBonus, ItemLike, SetBonusInput, SetLike, StatBlock } from "./types";

function countPieces(set: SetLike, equipped: readonly ItemLike[]): number {
  return equipped.filter((item) => set.pieceIds.includes(item.id)).length;
}

function reachedBonuses(set: SetLike, pieces: number): StatBlock[] {
  return set.bonuses.filter((bonus) => bonus.pieces <= pieces).map((bonus) => bonus.stats);
}

function toActiveSet(set: SetLike, pieces: number): ActiveSetBonus {
  return { setId: set.id, activePieces: pieces, bonuses: reachedBonuses(set, pieces) };
}

/**
 * Paliers de panoplie atteints par les pièces **équipées** (le sac ne compte
 * pas). Un set sans palier atteint est omis du résultat.
 */
export function getActiveSetBonuses(input: SetBonusInput): ActiveSetBonus[] {
  const equipped = equippedItems(input);
  const entries = input.sets.map((set) => toActiveSet(set, countPieces(set, equipped)));
  return entries.filter((entry) => entry.bonuses.length > 0);
}
