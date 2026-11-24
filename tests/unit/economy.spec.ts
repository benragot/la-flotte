import { describe, expect, it } from "vitest";
import {
  antiFarmFactor,
  computeCombatXp,
  computeDropChance,
  computeLevelFromXp,
  computeProspection,
  getBaseApForLevel,
  getStatsGainForLevelUp,
  isEligibleForDrop,
  levelGapFactor,
} from "../../src/engine/economy";
import type { AntiFarmRule, ApRule, LevelGapRule, LevelUpGain, XpTier } from "../../src/engine/economy";

const TIERS: readonly XpTier[] = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 110 },
  { level: 3, xpRequired: 650 },
  { level: 4, xpRequired: 1500 },
];

const UNSORTED_TIERS: readonly XpTier[] = [
  { level: 3, xpRequired: 650 },
  { level: 1, xpRequired: 0 },
  { level: 4, xpRequired: 1500 },
  { level: 2, xpRequired: 110 },
];

const AP_RULES: readonly ApRule[] = [
  { minLevel: 1, ap: 6 },
  { minLevel: 100, ap: 7 },
];

const LEVEL_UP_GAIN: LevelUpGain = { hp: 5, capitalPoints: 5, spellPoints: 1 };

describe("computeProspection", () => {
  it("retourne la PP de base quand la chance est nulle", () => {
    expect(computeProspection({ basePp: 100, chance: 0 })).toBe(100);
  });

  it("ajoute un point de PP par tranche de 10 de chance", () => {
    expect(computeProspection({ basePp: 100, chance: 100 })).toBe(110);
    expect(computeProspection({ basePp: 100, chance: 57 })).toBe(105);
  });

  it("ajoute le bonus de PP fourni", () => {
    expect(computeProspection({ basePp: 100, chance: 20, bonusPp: 15 })).toBe(117);
  });

  it("traite un bonus de PP absent comme nul", () => {
    expect(computeProspection({ basePp: 42, chance: 0, bonusPp: undefined })).toBe(42);
  });

  it("garde défensive : une chance négative n'ajoute aucun bonus", () => {
    expect(computeProspection({ basePp: 100, chance: -50 })).toBe(100);
  });
});

describe("computeDropChance", () => {
  it("retourne 0 sous le seuil de PP", () => {
    expect(computeDropChance({ playerPp: 50, ppThreshold: 100, baseDropRate: 0.1 })).toBe(0);
  });

  it("retourne le taux de base à 100 PP", () => {
    expect(computeDropChance({ playerPp: 100, ppThreshold: 100, baseDropRate: 0.1 })).toBe(0.1);
  });

  it("double le taux à 200 PP", () => {
    expect(computeDropChance({ playerPp: 200, ppThreshold: 100, baseDropRate: 0.1 })).toBe(0.2);
  });

  it("plafonne la probabilité à 1", () => {
    expect(computeDropChance({ playerPp: 300, ppThreshold: 100, baseDropRate: 0.5 })).toBe(1);
  });

  it("autorise le drop dès que la PP atteint le seuil", () => {
    expect(isEligibleForDrop(100, 100)).toBe(true);
    expect(isEligibleForDrop(99, 100)).toBe(false);
  });
});

/**
 * Règles d'écart de niveau 1.29 : facteur identité dans la bande neutre, et
 * ratio de niveaux hors bande. Le `mode` porte le calcul, pas une constante.
 */
const GAP_RULES: readonly LevelGapRule[] = [
  { minGap: -999, maxGap: -11, factor: 1, mode: "over" },
  { minGap: -10, maxGap: 5, factor: 1, mode: "flat" },
  { minGap: 6, maxGap: 999, factor: 1, mode: "under" },
];

const ANTI_FARM: AntiFarmRule = { maxMonsterLevelRatio: 2.5 };

const xpFor = (playerLevel: number, monsterLevel: number, base = 1000, wisdom = 0): number =>
  computeCombatXp({
    baseMonsterXp: base,
    playerLevel,
    monsterLevel,
    wisdom,
    levelGapRules: GAP_RULES,
    antiFarm: ANTI_FARM,
  });

describe("levelGapFactor", () => {
  it("reste à 1 dans la bande neutre −10 ≤ écart ≤ 5", () => {
    expect(levelGapFactor(50, 50, GAP_RULES)).toBe(1);
    expect(levelGapFactor(50, 45, GAP_RULES)).toBe(1);
    expect(levelGapFactor(50, 60, GAP_RULES)).toBe(1);
  });

  it("applique M / P quand le joueur dépasse le monstre de plus de 5 niveaux", () => {
    expect(levelGapFactor(50, 40, GAP_RULES)).toBeCloseTo(0.8);
    expect(levelGapFactor(40, 20, GAP_RULES)).toBeCloseTo(0.5);
    expect(levelGapFactor(100, 20, GAP_RULES)).toBeCloseTo(0.2);
  });

  it("applique (P + 10) / M quand le monstre dépasse le joueur de plus de 10 niveaux", () => {
    expect(levelGapFactor(50, 61, GAP_RULES)).toBeCloseTo(60 / 61);
    expect(levelGapFactor(40, 51, GAP_RULES)).toBeCloseTo(50 / 51);
  });

  it("ne dépasse jamais 1, même face à un monstre plus haut niveau", () => {
    for (const monsterLevel of [11, 20, 50, 200]) {
      expect(levelGapFactor(10, monsterLevel, GAP_RULES)).toBeLessThanOrEqual(1);
    }
  });

  it("lit le facteur de la règle et pas une constante du code", () => {
    const halved: readonly LevelGapRule[] = [
      { minGap: -999, maxGap: 999, factor: 0.5, mode: "flat" },
    ];
    expect(levelGapFactor(50, 40, halved)).toBe(0.5);
  });
});

describe("antiFarmFactor", () => {
  it("ne pénalise pas tant que P ≤ floor(2.5 × H)", () => {
    expect(antiFarmFactor(50, 50, 2.5)).toBe(1);
    expect(antiFarmFactor(49, 20, 2.5)).toBe(1);
    expect(antiFarmFactor(50, 20, 2.5)).toBe(1);
  });

  it("applique floor(2.5 × H) / P au-delà du plafond", () => {
    expect(antiFarmFactor(100, 20, 2.5)).toBeCloseTo(0.5);
    expect(antiFarmFactor(101, 40, 2.5)).toBeCloseTo(100 / 101);
  });

  it("suit le ratio injecté par la donnée", () => {
    expect(antiFarmFactor(100, 20, 1)).toBeCloseTo(0.2);
  });
});

describe("computeCombatXp", () => {
  it("rend l'XP de base entre pairs", () => {
    expect(xpFor(50, 50)).toBe(1000);
  });

  it("garde la bande neutre intacte", () => {
    expect(xpFor(50, 45)).toBe(1000);
  });

  it("réduit l'XP quand le joueur dépasse le monstre", () => {
    expect(xpFor(50, 40)).toBe(800);
    expect(xpFor(40, 20)).toBe(500);
  });

  it("cumule écart de niveau et anti-farm", () => {
    expect(xpFor(100, 20)).toBe(100);
  });

  it("applique le malus du monstre au-dessus du joueur", () => {
    expect(xpFor(50, 61)).toBe(983);
  });

  it("floor à chaque étape : 101 × 0,5 puis sagesse 100 donne 100, pas 101", () => {
    expect(xpFor(40, 20, 101, 100)).toBe(100);
  });

  it("double l'XP avec 100 de sagesse", () => {
    expect(xpFor(50, 50, 100, 100)).toBe(200);
  });

  it("arrondit vers le bas le résultat", () => {
    expect(xpFor(50, 50, 37, 33)).toBe(49);
  });

  it("garde défensive : une sagesse négative ne produit jamais d'XP négative", () => {
    expect(xpFor(50, 50, 100, -200)).toBe(0);
  });
});

describe("computeLevelFromXp", () => {
  it("retourne le niveau 1 sans XP", () => {
    expect(computeLevelFromXp(0, TIERS)).toBe(1);
  });

  it("retourne le palier exact atteint", () => {
    expect(computeLevelFromXp(110, TIERS)).toBe(2);
  });

  it("retourne le palier inférieur entre deux paliers", () => {
    expect(computeLevelFromXp(1000, TIERS)).toBe(3);
  });

  it("retourne le dernier palier pour une XP énorme", () => {
    expect(computeLevelFromXp(999_999, TIERS)).toBe(4);
  });

  it("retourne le niveau 1 quand la table est vide", () => {
    expect(computeLevelFromXp(500, [])).toBe(1);
  });

  it("reste correct avec une table de paliers non triée", () => {
    expect(computeLevelFromXp(1000, UNSORTED_TIERS)).toBe(3);
    expect(computeLevelFromXp(650, UNSORTED_TIERS)).toBe(3);
    expect(computeLevelFromXp(109, UNSORTED_TIERS)).toBe(1);
  });
});

describe("getStatsGainForLevelUp", () => {
  it("renvoie les gains injectés par l'appelant", () => {
    expect(getStatsGainForLevelUp(2, LEVEL_UP_GAIN)).toEqual({
      hp: 5,
      capitalPoints: 5,
      spellPoints: 1,
    });
  });

  it("n'utilise aucune valeur de gain codée en dur", () => {
    const customGain = { hp: 7, capitalPoints: 2, spellPoints: 3 };
    expect(getStatsGainForLevelUp(50, customGain)).toEqual(customGain);
  });

  it("garde les mêmes gains à tous les niveaux valides", () => {
    expect(getStatsGainForLevelUp(150, LEVEL_UP_GAIN)).toEqual(
      getStatsGainForLevelUp(2, LEVEL_UP_GAIN),
    );
  });

  it("renvoie des gains nuls sous le niveau 1", () => {
    expect(getStatsGainForLevelUp(0, LEVEL_UP_GAIN)).toEqual({
      hp: 0,
      capitalPoints: 0,
      spellPoints: 0,
    });
  });
});

describe("getBaseApForLevel", () => {
  it("utilise le palier de PA fourni sous le niveau 100", () => {
    expect(getBaseApForLevel(1, AP_RULES)).toBe(6);
    expect(getBaseApForLevel(99, AP_RULES)).toBe(6);
  });

  it("utilise le palier de PA fourni à partir du niveau 100", () => {
    expect(getBaseApForLevel(100, AP_RULES)).toBe(7);
    expect(getBaseApForLevel(200, AP_RULES)).toBe(7);
  });

  it("suit des paliers personnalisés sans valeur codée en dur", () => {
    const customRules: readonly ApRule[] = [
      { minLevel: 1, ap: 5 },
      { minLevel: 50, ap: 8 },
    ];
    expect(getBaseApForLevel(49, customRules)).toBe(5);
    expect(getBaseApForLevel(50, customRules)).toBe(8);
  });

  it("reste correct avec des paliers non triés", () => {
    const unsortedRules: readonly ApRule[] = [
      { minLevel: 100, ap: 7 },
      { minLevel: 1, ap: 6 },
    ];
    expect(getBaseApForLevel(120, unsortedRules)).toBe(7);
  });
});
