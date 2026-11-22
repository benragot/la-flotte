import type { StorageLike } from "../engine/save";
import { useCombatStore } from "./useCombatStore";
import { useGameStore } from "./useGameStore";

/** Stockage refusé (mode privé, quota) : le slot survit, l'ancien héros reviendra. */
function warnSaveSurvives(): void {
  console.warn("Nouvelle partie : la sauvegarde locale n'a pas pu être effacée (stockage refusé).");
}

/**
 * « Nouvelle partie » : la sauvegarde du slot est **effacée**, puis les deux
 * stores reprennent leur état d'ouverture. Sans l'effacement, le `loadGame` du
 * montage ramènerait l'ancien héros au prochain rechargement de la page.
 * Si le stockage refuse l'effacement, la partie repart quand même à zéro et la
 * limite est signalée (console) : elle est aussi écrite dans la PR.
 */
export function startNewGame(storage?: StorageLike): void {
  if (!useGameStore.getState().eraseSave(storage)) warnSaveSurvives();
  useCombatStore.getState().resetCombat();
  useGameStore.getState().resetGame();
}

/** Le « Annuler » de la confirmation n'appelle rien : les deux états gardent leur identité. */
export function startNewGameIfConfirmed(confirmed: boolean, storage?: StorageLike): void {
  if (confirmed) startNewGame(storage);
}
