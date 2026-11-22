import { useEffect } from "react";

const ESCAPE_KEY = "Escape";

/** Échap : la touche que les raccourcis du HUD réservent déjà à l'annulation. */
export function isEscapeKey(event: KeyboardEvent): boolean {
  return event.key === ESCAPE_KEY;
}

/** Échap coupe la propagation : l'écouteur global de `window` ne l'entend pas. */
function closeOnEscape(onClose: () => void): (event: KeyboardEvent) => void {
  return (event) => {
    if (!isEscapeKey(event)) return;
    event.stopPropagation();
    onClose();
  };
}

/**
 * Échap referme un panneau superposé. L'écoute est posée sur `document` : elle
 * passe après React mais avant l'écouteur global de `window`, dont elle coupe
 * la propagation pour ne pas annuler aussi le sort sélectionné.
 */
export function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const listener = closeOnEscape(onClose);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [onClose]);
}
