import { GAME_CATALOG, useGameStore } from "../store/useGameStore";
import type { EffectiveHp } from "./hudHp";
import { effectiveHp } from "./hudHp";

/**
 * PV effectifs du héros persisté, catalogue validé inclus. Les composants du
 * HUD n'appellent jamais le moteur avec des stats recalculées à la main.
 */
export function useEffectiveHp(): EffectiveHp | null {
  const hero = useGameStore((state) => state.hero);
  const inventory = useGameStore((state) => state.inventory);
  if (hero === null) return null;
  return effectiveHp({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}
