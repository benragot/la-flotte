/** Écran affiché par `App` : formulaire de création ou arène jouable. */
export type AppScreen = "creation" | "arena";

/** Un héros restauré ou créé ouvre l'arène, son absence ramène à la création. */
export function appScreen(hasHero: boolean): AppScreen {
  return hasHero ? "arena" : "creation";
}

export interface ExplorationBootstrapInput {
  hasHero: boolean;
  /** Aucun combat 1v1 et aucune exploration en cours. */
  isFresh: boolean;
  /** Une salle de donjon ou une bataille unifiée est déjà ouverte. */
  battleOpen: boolean;
  requested: boolean;
}

/**
 * L'exploration ne démarre qu'une fois : héros présent, session vierge, pas
 * déjà demandée, et **aucune salle ouverte**. Ce dernier point est la seule
 * source de la condition : `useDemoEntry` publie la salle de `?demo=dungeon`
 * avant le bootstrap, qui ne doit donc jamais lancer l'exploration par-dessus.
 */
export function shouldStartExploration(input: ExplorationBootstrapInput): boolean {
  if (!input.hasHero || input.requested || input.battleOpen) return false;
  return input.isFresh;
}
