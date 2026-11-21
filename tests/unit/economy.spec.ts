import { describe, expect, it } from "vitest";
import { computeProspection } from "../../src/engine/economy/prospection";
import { computeDropChance, isEligibleForDrop } from "../../src/engine/economy/drop";
import { computeCombatXp } from "../../src/engine/economy/xp";
import {
  computeLevelFromXp,
  getBaseApForLevel,
  getStatsGainForLevelUp,
} from "../../src/engine/economy/leveling";

interface TestTier {
  level: number;
  xpRequired: number;
}

const TIERS: readonly TestTier[] = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 110 },
  { level: 3, xpRequired: 650 },
  { level: 4, xpRequired: 1500 },
];

describe("computeProspection", () => {
  it("retourne la PP de base quand la chance est nulle", () => {
    expect(computeProspection({ basePp: 100, chance: 0 })).toBe(100);
  });

  it("ajoute un point de PP par tranche de 10 de chance", () => {
    expect(computeProspection({ basePp: 100, chance: 100 })).toBe(110);
    expect(computeProspection({ basePp: 100, chance: 57 })).toBe(105);
  });

  it("ignore une chance négative au lieu de retirer de la PP", () => {
    expect(computeProspection({ basePp: 100, chance: -50 })).toBe(100);
  });

  it("ajoute le bonus de PP fourni", () => {
    expect(computeProspection({ basePp: 100, chance: 20, bonusPp: 15 })).toBe(117);
  });

  it("traite un bonus de PP absent comme nul", () => {
    expect(computeProspection({ basePp: 42, chance: 0, bonusPp: undefined })).toBe(42);
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

  it("ne retourne jamais une XP négative", () => {
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
});

describe("getStatsGainForLevelUp", () => {
  it("accorde 5 PV, 5 points de capital et 1 point de sort", () => {
    expect(getStatsGainForLevelUp(2)).toEqual({ hp: 5, capitalPoints: 5, spellPoints: 1 });
  });

  it("garde les mêmes gains à tous les niveaux", () => {
    expect(getStatsGainForLevelUp(150)).toEqual(getStatsGainForLevelUp(2));
  });
});

describe("getBaseApForLevel", () => {
  it("donne 6 PA sous le niveau 100", () => {
    expect(getBaseApForLevel(1)).toBe(6);
    expect(getBaseApForLevel(99)).toBe(6);
  });

  it("donne 7 PA à partir du niveau 100", () => {
    expect(getBaseApForLevel(100)).toBe(7);
    expect(getBaseApForLevel(200)).toBe(7);
  });
});
