import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeLevelFromXp } from "../../src/engine/economy";
import type { XpTier } from "../../src/engine/economy";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";

/**
 * Table XP 1.29 recopiée à la main depuis la fiche de référence : ce snapshot
 * est un verrou anti-faute-de-frappe, il n'est jamais régénéré depuis le YAML.
 */
const EXPECTED_XP_TABLE: readonly XpTier[] = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 110 },
  { level: 3, xpRequired: 650 },
  { level: 4, xpRequired: 1500 },
  { level: 5, xpRequired: 2800 },
  { level: 6, xpRequired: 4800 },
  { level: 7, xpRequired: 7300 },
  { level: 8, xpRequired: 10500 },
  { level: 9, xpRequired: 14500 },
  { level: 10, xpRequired: 19200 },
  { level: 11, xpRequired: 25200 },
  { level: 12, xpRequired: 32600 },
  { level: 13, xpRequired: 41000 },
  { level: 14, xpRequired: 50500 },
  { level: 15, xpRequired: 61000 },
  { level: 16, xpRequired: 75000 },
  { level: 17, xpRequired: 91000 },
  { level: 18, xpRequired: 115000 },
  { level: 19, xpRequired: 142000 },
  { level: 20, xpRequired: 171000 },
  { level: 21, xpRequired: 202000 },
  { level: 22, xpRequired: 235000 },
  { level: 23, xpRequired: 270000 },
  { level: 24, xpRequired: 310000 },
  { level: 25, xpRequired: 353000 },
  { level: 26, xpRequired: 398500 },
  { level: 27, xpRequired: 448000 },
  { level: 28, xpRequired: 503000 },
  { level: 29, xpRequired: 561000 },
  { level: 30, xpRequired: 621600 },
  { level: 31, xpRequired: 687000 },
  { level: 32, xpRequired: 755000 },
  { level: 33, xpRequired: 829000 },
  { level: 34, xpRequired: 910000 },
  { level: 35, xpRequired: 1000000 },
  { level: 36, xpRequired: 1100000 },
  { level: 37, xpRequired: 1240000 },
  { level: 38, xpRequired: 1400000 },
  { level: 39, xpRequired: 1580000 },
  { level: 40, xpRequired: 1780000 },
  { level: 41, xpRequired: 2000000 },
  { level: 42, xpRequired: 2250000 },
  { level: 43, xpRequired: 2530000 },
  { level: 44, xpRequired: 2850000 },
  { level: 45, xpRequired: 3200000 },
  { level: 46, xpRequired: 3570000 },
  { level: 47, xpRequired: 3960000 },
  { level: 48, xpRequired: 4400000 },
  { level: 49, xpRequired: 4860000 },
  { level: 50, xpRequired: 5350000 },
];

const PROGRESSION_PATH = join(process.cwd(), "data", "progression.yaml");
const progression = parseProgressionYaml(readFileSync(PROGRESSION_PATH, "utf8"));

describe("courbe XP 1.29 — snapshot des 50 paliers", () => {
  it("verrouille la table valeur par valeur", () => {
    expect(progression.xpThresholds).toEqual(EXPECTED_XP_TABLE);
  });

  it("couvre les niveaux 1 à 50 sans trou", () => {
    const levels = progression.xpThresholds.map((tier) => tier.level);
    expect(levels).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
  });

  it("garde des seuils strictement croissants depuis 0 XP", () => {
    const xp = progression.xpThresholds.map((tier) => tier.xpRequired);
    const increasing = xp.every((value, index) => index === 0 || value > (xp[index - 1] ?? 0));
    expect(increasing).toBe(true);
    expect(xp[0]).toBe(0);
  });

  it("ancre les paliers utilisés par les walkthroughs", () => {
    const tiers = progression.xpThresholds;
    expect(computeLevelFromXp(109, tiers)).toBe(1);
    expect(computeLevelFromXp(110, tiers)).toBe(2);
    expect(computeLevelFromXp(2800, tiers)).toBe(5);
    expect(computeLevelFromXp(2879, tiers)).toBe(5);
    expect(computeLevelFromXp(4800, tiers)).toBe(6);
  });
});
