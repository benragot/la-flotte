import { useEffect, useRef } from "react";
import type { EscapeHandler } from "./escapeStack";
import { escapeRegistry, handleEscapeKey } from "./escapeStack";

export { isEscapeKey } from "./escapeStack";

/**
 * Le `onClose` du dernier rendu, sans réinscription : l'ordre de la pile fait
 * la priorité, un panneau qui se re-rend ne doit pas redevenir le plus interne.
 */
function useLatestClose(onClose: EscapeHandler): { current: EscapeHandler } {
  const latest = useRef(onClose);
  useEffect(() => {
    latest.current = onClose;
  });
  return latest;
}

/**
 * Échap referme un panneau superposé. Il s'inscrit dans la pile partagée
 * seulement quand `enabled` est vrai : un détail ouvert après son parent est
 * plus interne, donc fermé en premier.
 */
export function useEscapeClose(onClose: EscapeHandler, enabled = true): void {
  const latest = useLatestClose(onClose);
  useEffect(() => {
    if (!enabled) return undefined;
    return escapeRegistry.push(() => latest.current());
  }, [enabled, latest]);
}

/**
 * Écouteur Échap unique de l'application, posé sur `document` : il passe après
 * React mais avant l'écouteur global de `window`, ce qui donne la priorité au
 * panneau ouvert sur l'annulation du sort.
 */
export function useEscapeLayer(): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      handleEscapeKey(event);
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
}
