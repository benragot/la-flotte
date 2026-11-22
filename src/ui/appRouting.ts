/** Écran affiché par `App` : formulaire de création ou arène jouable. */
export type AppScreen = "creation" | "arena";

/** Un héros restauré ou créé ouvre l'arène, son absence ramène à la création. */
export function appScreen(hasHero: boolean): AppScreen {
  return hasHero ? "arena" : "creation";
}

export interface ExplorationBootstrapInput {
  hasHero: boolean;
  isFresh: boolean;
  requested: boolean;
}

/** L'exploration ne démarre qu'une fois : héros présent, session vierge, pas déjà demandée. */
export function shouldStartExploration(input: ExplorationBootstrapInput): boolean {
  if (!input.hasHero || input.requested) return false;
  return input.isFresh;
}
