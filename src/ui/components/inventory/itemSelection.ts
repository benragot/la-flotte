/** Intention de sélection : clic sur un objet ou fermeture explicite. */
export type SelectionInput = { type: "toggle"; itemId: string } | { type: "escape" };

/** Contrat de sélection partagé par les listes d'objets et le panneau de détail. */
export interface ItemSelectionProps {
  selected: string | null;
  onSelect: (itemId: string) => void;
}

/**
 * Bascule : un clic sur l'objet déjà sélectionné referme la fiche, un clic sur
 * un autre objet déplace la sélection. Aucune mutation d'argument.
 */
export function nextSelection(current: string | null, input: SelectionInput): string | null {
  if (input.type === "escape") return null;
  return input.itemId === current ? null : input.itemId;
}

/** Échap referme ; les autres touches laissent la sélection intacte. */
export function selectionAfterKey(current: string | null, key: string): string | null {
  return key === "Escape" ? null : current;
}
