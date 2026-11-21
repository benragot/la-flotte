/**
 * Paliers de PA fournis par l'appelant (données YAML), jamais codés en dur ici.
 */
export interface ApRule {
  minLevel: number;
  ap: number;
}

export interface XpTier {
  level: number;
  xpRequired: number;
}

export interface LevelUpGain {
  hp: number;
  capitalPoints: number;
  spellPoints: number;
}

/** Garde purement structurelle : niveau de héros minimal. */
const MIN_LEVEL = 1;
/** Aucun AP disponible : structurel, pas une valeur de jeu. */
const NO_AP = 0;

function reachedLevels(xp: number, tiers: readonly XpTier[]): number[] {
  return tiers.filter((tier) => tier.xpRequired <= xp).map((tier) => tier.level);
}

/**
 * Renvoie le plus haut palier atteint pour l'XP donnée, insensible à l'ordre
 * de la table ; niveau minimal si aucun palier n'est atteint.
 */
export function computeLevelFromXp(xp: number, tiers: readonly XpTier[]): number {
  const levels = reachedLevels(xp, tiers);
  if (levels.length === 0) return MIN_LEVEL;
  return Math.max(MIN_LEVEL, ...levels);
}

/**
 * Renvoie les gains de montée de niveau fournis par l'appelant
 * (`gainRules`). Sous le niveau minimal, aucun gain n'est accordé.
 */
export function getStatsGainForLevelUp(level: number, gainRules: LevelUpGain): LevelUpGain {
  if (level < MIN_LEVEL) return { hp: 0, capitalPoints: 0, spellPoints: 0 };
  return { ...gainRules };
}

function higherApRule(rule: ApRule, best: ApRule): ApRule {
  return rule.minLevel > best.minLevel ? rule : best;
}

/**
 * Renvoie les PA du plus haut palier `apRules` dont `minLevel <= level`.
 * Les paliers proviennent de l'appelant et peuvent être non triés.
 */
export function getBaseApForLevel(level: number, apRules: readonly ApRule[]): number {
  const reached = apRules.filter((rule) => rule.minLevel <= level);
  if (reached.length === 0) return NO_AP;
  return reached.reduce(higherApRule).ap;
}
