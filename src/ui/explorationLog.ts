/**
 * Journal d'exploration : le moteur écrit `« Le héros se déplace de N case(s). »`
 * (`src/engine/exploration/move.ts`), instrument de mise au point qui n'a rien à
 * faire sous les yeux du joueur. Le filtrage vit ici, côté UI : le moteur reste
 * inchangé et le message subsiste en développement.
 */
const DEV_ONLY_PATTERNS: readonly RegExp[] = [/^Le héros se déplace de \d+ case\(s\)\.$/];

/** Le journal technique n'est affiché qu'en développement. */
export function shouldLogMove(isDev: boolean): boolean {
  return isDev;
}

/** Ligne purement technique, sans valeur de jeu pour le joueur. */
export function isDevOnlyLine(line: string): boolean {
  return DEV_ONLY_PATTERNS.some((pattern) => pattern.test(line));
}

/** Journal affichable : tout en dev, lignes de jeu seulement en production. */
export function visibleExplorationLog(log: readonly string[], isDev: boolean): string[] {
  if (shouldLogMove(isDev)) return [...log];
  return log.filter((line) => !isDevOnlyLine(line));
}
