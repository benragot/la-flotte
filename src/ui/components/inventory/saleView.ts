/**
 * Vue de l'écran de vente (§11 de `ui-visual-direction.md`).
 *
 * **Aucune règle métier ici** : le prix est une **donnée** de `data/items.yaml`,
 * lue par le même catalogue que l'action `sellItem` du store ; le crédit et la
 * quantité appartiennent au moteur. Ce module ne décide que de ce qui est
 * **affichable** — une vente interdite est une raison lisible, jamais un bouton
 * muet (exigence « aucun clic mort »).
 */
export type SaleLock = "combat" | "no-price" | null;

/** Prix unitaire connu ; `null` = l'objet n'a pas de `sellPrice`. */
export type SalePrice = number | null;

const LOCK_LABELS: Record<Exclude<SaleLock, null>, string> = {
  combat: "Vente impossible en combat",
  "no-price": "Objet invendable",
};

/** Le combat prime : c'est le verrou global, expliqué une fois en tête du sac. */
export function saleLock(price: SalePrice, inCombat: boolean): SaleLock {
  if (inCombat) return "combat";
  return price === null ? "no-price" : null;
}

/** Raison affichée sur le bouton désactivé ; `null` quand la vente est ouverte. */
export function saleLockLabel(lock: SaleLock): string | null {
  return lock === null ? null : LOCK_LABELS[lock];
}

/** Prix unitaire de la ligne : le mot remplace le chiffre absent, il ne le cache pas. */
export function priceLabel(price: SalePrice): string {
  return price === null ? "Invendable" : `${price} kamas`;
}

/** Confirmation de vente : la bourse porte le montant, pas cette ligne. */
export function saleNotice(name: string, quantity: number): string {
  return `Vendu : ${name} ×${quantity}`;
}
