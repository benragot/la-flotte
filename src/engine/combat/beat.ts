/**
 * Cadence de combat : un **budget de lecture**, pas une animation. Le joueur
 * doit pouvoir lire la ligne de dégâts avant que la suivante n'arrive.
 *
 * Le module est pur : le temps est **toujours** un paramètre, aucune horloge
 * (`Date.now`, `performance.now`, `setTimeout`) n'entre dans `src/engine/`.
 */

/** Intervalle minimal entre deux résolutions d'action, en millisecondes. */
export const MIN_BEAT_MS = 750;

/** Borne basse de l'action suivante : la dernière action plus un beat. */
export function nextBeatAt(lastAt: number): number {
  return lastAt + MIN_BEAT_MS;
}

/** L'action est-elle autorisée à `now` ? Ne mute ni `lastAt` ni `now`. */
export function canAct(lastAt: number, now: number): boolean {
  return now >= nextBeatAt(lastAt);
}
