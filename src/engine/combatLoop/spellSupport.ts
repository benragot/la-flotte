import type { SpellDef, SpellKind } from "../../schemas/spellSchema";

/**
 * Liste **blanche** des `kind` que `cast.ts` exécute réellement aujourd'hui :
 * `damage` (frappe) et `teleport` (déplacement). Tout autre kind — présent ou
 * futur (`heal`, `buff`, `debuff`, `summon` de la spec effets §2.1) — reste
 * non implémenté par défaut : on n'annonce jamais un effet qui n'existe pas.
 */
const HANDLED_KINDS: ReadonlySet<SpellKind> = new Set<SpellKind>(["damage", "teleport"]);

/** Motif de refus moteur, exposé tel quel au HUD (aucune divergence possible). */
export type SpellSupportRefusal = "missing-state" | "not-implemented";

export function hasHandledKind(spell: SpellDef): boolean {
  return HANDLED_KINDS.has(spell.kind);
}

/** Aucun système d'états (SPELL-02) : `requiresState` ne peut jamais être satisfait. */
export function hasMissingState(spell: SpellDef): boolean {
  return spell.requiresState !== undefined;
}

export function isSpellImplemented(spell: SpellDef): boolean {
  return hasHandledKind(spell) && !hasMissingState(spell);
}

/** `null` = le sort peut être tenté ; sinon le motif exact du refus. */
export function spellSupportRefusal(spell: SpellDef): SpellSupportRefusal | null {
  if (hasMissingState(spell)) return "missing-state";
  return hasHandledKind(spell) ? null : "not-implemented";
}
