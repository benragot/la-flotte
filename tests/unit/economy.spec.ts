import { describe, expect, it } from "vitest";
import {
  computeCombatXp,
  computeDropChance,
  computeLevelFromXp,
  computeProspection,
  getBaseApForLevel,
  getStatsGainForLevelUp,
  isEligibleForDrop,
} from "../../src/engine/economy";
import type { ApRule, LevelUpGain, XpTier } from "../../src/engine/economy";

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

describe("computeCombatXp", () => {
  it("retourne l'XP de base sans sagesse ni écart de niveau", () => {
    const xp = computeCombatXp({ baseMonsterXp: 100, wisdom: 0, levelGapFactor: 1 });
    expect(xp).toBe(100);
  });

  it("double l'XP avec 100 de sagesse", () => {
    const xp = computeCombatXp({ baseMonsterXp: 100, wisdom: 100, levelGapFactor: 1 });
    expect(xp).toBe(200);
  });

  it("applique le facteur d'écart de niveau", () => {
    const xp = computeCombatXp({ baseMonsterXp: 100, wisdom: 0, levelGapFactor: 0.5 });
    expect(xp).toBe(50);
  });

  it("arrondit vers le bas le résultat", () => {
    const xp = computeCombatXp({ baseMonsterXp: 37, wisdom: 33, levelGapFactor: 1 });
    expect(xp).toBe(49);
  });

  it("garde défensive : une sagesse négative ne produit jamais d'XP négative", () => {
    const xp = computeCombatXp({ baseMonsterXp: 100, wisdom: -200, levelGapFactor: 1 });
    expect(xp).toBe(0);
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
