import type { SpellDef, SpellEffect, SpellKind } from "../../schemas/spellSchema";

/**
 * Liste **blanche** des capacités que les deux moteurs exécutent réellement.
 *
 * `heal` n'est pas un `kind` de la donnée (`spellKindSchema` = damage, teleport,
 * other) : `mot_curatif` porte `kind: other` + `effect.type: heal`. Le déblocage
 * se fait donc sur l'axe des **effets** (`HANDLED_EFFECTS`), pas en ajoutant un
 * kind fantôme que `cast.ts` ne saurait pas résoudre. Tout autre effet
 * (`buff`, `debuff`, `trap`, `glyph`, `summon`, `state`, `push`, `steal`,
 * `reflect`) reste non implémenté : on n'annonce jamais un effet qui n'existe pas.
 */
const HANDLED_KINDS: ReadonlySet<SpellKind> = new Set<SpellKind>(["damage", "teleport"]);

/** Effets consommés par le moteur (SPELL-02, première tranche : le soin). */
const HANDLED_EFFECTS: ReadonlySet<SpellEffect["type"]> = new Set<SpellEffect["type"]>(["heal"]);

/** Motif de refus moteur, exposé tel quel au HUD (aucune divergence possible). */
export type SpellSupportRefusal = "missing-state" | "not-implemented";

/** Un effet consommé ET complet : un `heal` sans fourchette reste « à venir ». */
export function isHealSpell(spell: SpellDef): boolean {
  const effect = spell.effect;
  if (effect === undefined || !HANDLED_EFFECTS.has(effect.type)) return false;
  return effect.amount !== undefined;
}

export function hasHandledKind(spell: SpellDef): boolean {
  return HANDLED_KINDS.has(spell.kind) || isHealSpell(spell);
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
