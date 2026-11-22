import type { StorageLike } from "../engine/save";
import { useCombatStore } from "./useCombatStore";
import { useGameStore } from "./useGameStore";

/**
 * « Nouvelle partie » : la sauvegarde du slot est **effacée**, puis les deux
 * stores reprennent leur état d'ouverture. Sans l'effacement, le `loadGame` du
 * montage ramènerait l'ancien héros au prochain rechargement de la page.
 */
export function startNewGame(storage?: StorageLike): void {
  useGameStore.getState().eraseSave(storage);
  useCombatStore.getState().resetCombat();
  useGameStore.getState().resetGame();
}

/** Le « Annuler » de la confirmation n'appelle rien : les deux états gardent leur identité. */
export function startNewGameIfConfirmed(confirmed: boolean, storage?: StorageLike): void {
  if (confirmed) startNewGame(storage);
}
