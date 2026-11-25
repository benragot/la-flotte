import type { SpellDef } from "../../schemas/spellSchema";

export interface HealRange {
  min: number;
  max: number;
}

export interface HealAmountInput {
  /** Jet de soin déjà tiré et éventuellement scalé par la stat. */
  heal: number;
  currentHp: number;
  maxHp: number;
}

/**
 * Règle 1.29 du soin, **définie une seule fois** : le montant appliqué est le
 * jet, borné aux PV manquants. Le surplus est perdu, un soin ne ressuscite
 * jamais et ne dépasse jamais `maxHp`. Aucun plancher au-dessus de 0.
 */
export function healAmount(input: HealAmountInput): number {
  const missing = Math.max(0, input.maxHp - input.currentHp);
  return Math.min(Math.max(0, input.heal), missing);
}

/**
 * Stat de soin 1.29 (`effects-engine.md` §1.3) : les soins suivent
 * l'Intelligence, pas la stat de l'élément déclaré. `floor` au résultat final,
 * Intelligence négative ramenée à 0.
 */
export function scaledHeal(roll: number, intelligence: number): number {
  return Math.floor((roll * (100 + Math.max(0, intelligence))) / 100);
}

/** Fourchette de la donnée : `effect.amount` du sort de soin, `undefined` sinon. */
export function healRange(spell: SpellDef): HealRange | undefined {
  return spell.effect?.type === "heal" ? spell.effect.amount : undefined;
}

/** Même tirage que les dégâts : `min + floor(rng() × (max - min + 1))`. */
export function rollHeal(range: HealRange, rng: () => number): number {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}
