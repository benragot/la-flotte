/**
 * Pile des interfaces superposées ouvertes : le dernier panneau monté est le
 * plus interne, et c'est lui qu'Échap referme en premier. Un seul appui ferme
 * un seul niveau, jamais toute la pile.
 */
export type EscapeHandler = () => void;

export interface EscapeRegistry {
  /** Inscrit un panneau ; le retour le désinscrit à son démontage. */
  push: (handler: EscapeHandler) => () => void;
  /** Ferme **le** panneau le plus interne ; `false` si aucun n'est ouvert. */
  closeTop: () => boolean;
  /** Nombre de panneaux ouverts. */
  count: () => number;
}

const ESCAPE_KEY = "Escape";

export function isEscapeKey(event: KeyboardEvent): boolean {
  return event.key === ESCAPE_KEY;
}

function dropHandler(handlers: EscapeHandler[], handler: EscapeHandler): void {
  const index = handlers.lastIndexOf(handler);
  if (index === -1) return;
  handlers.splice(index, 1);
}

function addHandler(handlers: EscapeHandler[], handler: EscapeHandler): () => void {
  handlers.push(handler);
  return () => dropHandler(handlers, handler);
}

function closeLast(handlers: EscapeHandler[]): boolean {
  const handler = handlers[handlers.length - 1];
  if (handler === undefined) return false;
  handler();
  return true;
}

/** Pile vide au départ, ordre d'inscription = ordre d'ouverture. */
export function createEscapeRegistry(): EscapeRegistry {
  const handlers: EscapeHandler[] = [];
  const push = (handler: EscapeHandler) => addHandler(handlers, handler);
  return { push, closeTop: () => closeLast(handlers), count: () => handlers.length };
}

/** Registre de l'application : les panneaux montés s'y inscrivent. */
export const escapeRegistry = createEscapeRegistry();

/**
 * Échap ferme **un** panneau, le plus interne. La propagation vers l'écouteur
 * global de `window` n'est coupée que si un panneau a réellement été fermé :
 * sans panneau ouvert, Échap garde son rôle d'annulation du sort sélectionné.
 */
export function handleEscapeKey(event: KeyboardEvent, registry: EscapeRegistry = escapeRegistry): boolean {
  if (!isEscapeKey(event)) return false;
  if (!registry.closeTop()) return false;
  event.stopPropagation();
  return true;
}
