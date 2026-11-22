/**
 * Nombres flottants de combat : la **donnée** minimale qu'un coup produit pour
 * le rendu. Ce n'est pas une règle métier — le montant est déjà calculé par
 * `computeDamage` —, et ce n'est pas du texte : le rendu n'a aucun journal à
 * analyser pour retrouver un chiffre.
 */

export type FloatKind = "damage" | "heal";

/** Un nombre à faire flotter au-dessus d'un combattant, dans le repère du jeton. */
export interface FloatingEvent {
  /** Identifiant monotone **dans un état de combat** : le rendu consomme les inédits. */
  readonly id: number;
  readonly targetId: string;
  readonly amount: number;
  readonly kind: FloatKind;
}

/** Ce qu'un coup apporte : la cible, la valeur **appliquée** et son sens. */
export type FloatDraft = Omit<FloatingEvent, "id">;

/** Tampon borné : le rendu a au plus une seconde et demie de retard à rattraper. */
export const FLOAT_BUFFER_SIZE = 8;

/** Tout état de combat qui porte un tampon de nombres flottants. */
export interface FloatSource {
  readonly floats?: readonly FloatingEvent[];
}

function nextId(buffer: readonly FloatingEvent[]): number {
  return (buffer.at(-1)?.id ?? 0) + 1;
}

/**
 * Ajoute un nombre flottant et **borne** le tampon aux `FLOAT_BUFFER_SIZE`
 * derniers. Un coup nul n'écrit rien : aucun « -0 » à l'écran.
 */
export function appendFloat<T extends FloatSource>(state: T, draft: FloatDraft): T {
  if (draft.amount <= 0) return state;
  const buffer = state.floats ?? [];
  const event: FloatingEvent = { ...draft, id: nextId(buffer) };
  return { ...state, floats: [...buffer, event].slice(-FLOAT_BUFFER_SIZE) };
}

/** Événements que le rendu n'a pas encore vus (identifiant supérieur au curseur). */
export function unseenFloats(buffer: readonly FloatingEvent[], seenId: number): FloatingEvent[] {
  return buffer.filter((event) => event.id > seenId);
}
