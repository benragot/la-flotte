export interface CritRateInput {
  baseCrit: number;
  bonusCrit: number;
  agility: number;
}

const MIN_DENOMINATOR = 2;
const AGILITY_THRESHOLD = 8;
const EULER_WEIGHT = Math.E * 1.1;

/** Le `+CC` d'équipement se retire **avant** l'Agilité (fiche 1.29). */
function critDiff(input: CritRateInput): number {
  const diff = input.baseCrit - input.bonusCrit;
  return diff <= MIN_DENOMINATOR ? MIN_DENOMINATOR : diff;
}

function agilityDenominator(diff: number, agility: number): number {
  const scaled = (diff * EULER_WEIGHT) / Math.log(agility + 12);
  return Math.max(MIN_DENOMINATOR, Math.floor(scaled));
}

/**
 * Dénominateur `X` du coup critique : le CC tombe sur `rng() * X < 1`, soit
 * une chance exacte de `1/X`. Dofus 1.29 : `X = floor(base * e * 1,1 /
 * ln(Agi + 12))`, `X = 2` (1 chance sur 2) quand `base <= 2` ou que le calcul
 * descend sous 2, et l'écart brut quand `Agilité < 8`. **Aucun CC garanti** :
 * `158` rend `100`, soit 1 %.
 */
export function computeCritDenominator(input: CritRateInput): number {
  const diff = critDiff(input);
  if (diff === MIN_DENOMINATOR) return MIN_DENOMINATOR;
  if (input.agility < AGILITY_THRESHOLD) return diff;
  return agilityDenominator(diff, input.agility);
}

/**
 * Dérivé d'**affichage** seulement : `100 / X`. Le moteur tire sur le
 * dénominateur (`computeCritDenominator`), jamais sur ce pourcentage.
 */
export function computeCritRate(input: CritRateInput): number {
  return 100 / computeCritDenominator(input);
}
