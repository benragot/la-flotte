import type { SpellDef } from "../../schemas/spellSchema";

/**
 * SPELL-02 n'est pas encore livré : seuls `damage` et `teleport` produisent un
 * résultat moteur. Un sort utilitaire est donc **non implémenté**, jamais
 * silencieusement refusé. Source unique pour le moteur et pour le HUD.
 */
export function isSpellImplemented(spell: SpellDef): boolean {
  return spell.kind !== "other";
}
