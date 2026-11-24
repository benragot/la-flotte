/**
 * Règles d'écart de niveau fournies par l'appelant (`data/progression.yaml`).
 * Le `mode` porte le calcul : une table de facteurs constants ne peut pas
 * exprimer le rendement décroissant 1.29 (le facteur dépend des deux niveaux).
 */
export type LevelGapMode = "flat" | "over" | "under";

export interface LevelGapRule {
  minGap: number;
  maxGap: number;
  factor: number;
  mode: LevelGapMode;
}

export interface AntiFarmRule {
  maxMonsterLevelRatio: number;
}

export interface CombatXpInput {
  baseMonsterXp: number;
  playerLevel: number;
  /** Niveau du monstre vaincu : `M` dans le facteur d'écart. */
  monsterLevel: number;
  wisdom: number;
  levelGapRules: readonly LevelGapRule[];
  antiFarm: AntiFarmRule;
}

/** Bonus de niveau accordé quand le monstre dépasse le joueur (`P + 10`). */
const OVER_GAP_LEVEL_BONUS = 10;

type GapModeFactor = (playerLevel: number, monsterLevel: number) => number;

const GAP_MODE_FACTOR: Record<LevelGapMode, GapModeFactor> = {
  flat: () => 1,
  over: (playerLevel, monsterLevel) => (playerLevel + OVER_GAP_LEVEL_BONUS) / monsterLevel,
  under: (playerLevel, monsterLevel) => monsterLevel / playerLevel,
};

function findGapRule(gap: number, rules: readonly LevelGapRule[]): LevelGapRule | undefined {
  return rules.find((rule) => gap >= rule.minGap && gap <= rule.maxGap);
}

/**
 * Facteur `B` de la formule 1.29, plafonné à 1 : neutre dans la bande
 * `-10 ≤ gap ≤ 5`, `M / P` au-dessus, `(P + 10) / M` en dessous.
 */
export function levelGapFactor(
  playerLevel: number,
  monsterLevel: number,
  rules: readonly LevelGapRule[],
): number {
  const rule = findGapRule(playerLevel - monsterLevel, rules);
  if (rule === undefined) return 1;
  return rule.factor * GAP_MODE_FACTOR[rule.mode](playerLevel, monsterLevel);
}

/**
 * Facteur anti-farm `C` : neutre tant que `P ≤ floor(ratio × H)`, sinon
 * `floor(ratio × H) / P`. `H` est le niveau du plus gros monstre du combat.
 */
export function antiFarmFactor(
  playerLevel: number,
  topMonsterLevel: number,
  maxMonsterLevelRatio: number,
): number {
  const cap = Math.floor(maxMonsterLevelRatio * topMonsterLevel);
  if (playerLevel <= cap) return 1;
  return cap / playerLevel;
}

/** Un `floor` après CHAQUE facteur, dans l'ordre B → C → sagesse. */
function floorSteps(base: number, factors: readonly number[]): number {
  return factors.reduce((value, factor) => Math.floor(value * factor), base);
}

function combatXpFactors(input: CombatXpInput): number[] {
  const gap = levelGapFactor(input.playerLevel, input.monsterLevel, input.levelGapRules);
  const antiFarm = antiFarmFactor(input.playerLevel, input.monsterLevel, input.antiFarm.maxMonsterLevelRatio);
  return [gap, antiFarm, (100 + input.wisdom) / 100];
}

/**
 * XP de combat 1.29 : `floor(floor(floor(base × B) × C) × (100 + sagesse) / 100)`.
 * Garde défensive : une sagesse négative ne produit jamais d'XP négative.
 */
export function computeCombatXp(input: CombatXpInput): number {
  return Math.max(0, floorSteps(input.baseMonsterXp, combatXpFactors(input)));
}
