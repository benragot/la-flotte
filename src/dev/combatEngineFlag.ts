/**
 * Drapeau DEC-12, étape 2 : `VITE_COMBAT_ENGINE=unified` désignera le moteur
 * unique. Toute autre valeur (absente, vide, inconnue) ⇒ `legacy`.
 *
 * Il n'est **pas** encore consommé par `useCombatStore` : basculer aujourd'hui
 * laisserait l'UI d'exploration sur `CombatHud`, qui lit la slice `combat`
 * (`CombatState`), alors que le moteur unique produit la slice `battle`
 * (`BattleState`). Le raccordement appartient à l'étape 3, avec `BattlePanel`.
 */
export type CombatEngine = "legacy" | "unified";

const UNIFIED = "unified";

/** Lecture pure : seul l'exact `"unified"` active le moteur unique. */
export function resolveCombatEngine(raw: string | undefined): CombatEngine {
  return raw === UNIFIED ? UNIFIED : "legacy";
}

/** Wrapper fin : lit l'environnement Vite, la logique vit dans `resolveCombatEngine`. */
export function combatEngine(): CombatEngine {
  return resolveCombatEngine(import.meta.env.VITE_COMBAT_ENGINE as string | undefined);
}
