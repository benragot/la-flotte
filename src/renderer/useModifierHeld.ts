import { useEffect, useState } from "react";

/** Touche dont l'état est exposé : `Maj` maintenu affiche la zone PM du héros (R1). */
const MODIFIER_KEY = "Shift";
const RELEASE_EVENT = "blur";

/** `Maj` maintenu ? Un `keyup` de `Maj` le relâche, un autre `keyup` reflète `shiftKey`. */
function heldAfter(event: KeyboardEvent): boolean {
  if (event.key === MODIFIER_KEY) return event.type === "keydown";
  return event.shiftKey;
}

/** Trois écouteurs, un seul détachement : la scène qui les a lancés les retire. */
function bindModifier(update: (event: KeyboardEvent) => void, release: () => void): () => void {
  window.addEventListener("keydown", update);
  window.addEventListener("keyup", update);
  window.addEventListener(RELEASE_EVENT, release);
  return () => {
    window.removeEventListener("keydown", update);
    window.removeEventListener("keyup", update);
    window.removeEventListener(RELEASE_EVENT, release);
  };
}

/**
 * État d'entrée `Maj` lu **à la frontière** (le hook vit avec le canvas) : la
 * peinture reçoit un booléen, elle ne touche jamais `window`. Perdre le focus
 * relâche la touche : aucun état collé ne survit à la fenêtre.
 */
export function useModifierHeld(): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const update = (event: KeyboardEvent): void => setHeld(heldAfter(event));
    const release = (): void => setHeld(false);
    return bindModifier(update, release);
  }, []);
  return held;
}
