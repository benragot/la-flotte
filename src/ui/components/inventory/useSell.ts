import { useCombatStore } from "../../../store/useCombatStore";
import { useGameStore } from "../../../store/useGameStore";
import type { SaleLock } from "./saleView";

/** Combat 1v1 ou salle ouverte : le sac reste consultable, la vente non. */
export function useLiveCombat(): boolean {
  const combat = useCombatStore((state) => state.combat);
  const battle = useCombatStore((state) => state.battle);
  return combat !== null || battle !== null;
}

export type SellHandler = (quantity: number) => void;

/**
 * Action `sellItem` du store, telle quelle : le prix unitaire et le crédit
 * appartiennent au moteur. Un verrou rend la fonction inerte — l'état n'est
 * jamais modifié « à moitié » par l'interface.
 */
export function useSell(itemId: string, lock: SaleLock): SellHandler {
  const sellItem = useGameStore((state) => state.sellItem);
  return (quantity) => {
    if (lock !== null) return;
    sellItem({ itemId, quantity });
  };
}
