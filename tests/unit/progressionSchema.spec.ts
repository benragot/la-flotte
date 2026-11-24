import { describe, expect, it } from "vitest";
import { progressionFileSchema } from "../../src/schemas/progressionSchema";
import type { LevelGapRuleDef } from "../../src/schemas/progressionSchema";

const BASE = {
  xpThresholds: [
    { level: 1, xpRequired: 0 },
    { level: 2, xpRequired: 110 },
  ],
  apRules: [{ minLevel: 1, ap: 6 }],
  gainRules: { hp: 5, capitalPoints: 5, spellPoints: 1 },
  experience: {
    levelGapRules: [
      { minGap: -999, maxGap: -11, factor: 1, mode: "over" },
      { minGap: -10, maxGap: 5, factor: 1, mode: "flat" },
      { minGap: 6, maxGap: 999, factor: 1, mode: "under" },
    ],
    antiFarm: { maxMonsterLevelRatio: 2.5 },
  },
};

type Fixture = typeof BASE;

const withRule = (index: number, rule: LevelGapRuleDef): Fixture => {
  const def: Fixture = structuredClone(BASE);
  def.experience.levelGapRules[index] = rule;
  return def;
};

describe("progressionFileSchema — mode et bornes des règles d'écart", () => {
  it("accepte des règles d'écart de niveau et un anti-farm", () => {
    expect(progressionFileSchema.safeParse(structuredClone(BASE)).success).toBe(true);
  });

  it("refuse un mode inconnu", () => {
    const rule = { minGap: -999, maxGap: -11, factor: 1, mode: "slope" } as unknown as LevelGapRuleDef;
    expect(progressionFileSchema.safeParse(withRule(0, rule)).success).toBe(false);
  });

  it("refuse minGap > maxGap", () => {
    const rule = { minGap: 5, maxGap: -10, factor: 1, mode: "flat" } as const;
    expect(progressionFileSchema.safeParse(withRule(1, rule)).success).toBe(false);
  });

  it("refuse un facteur hors de [0, 1]", () => {
    const above = { minGap: 6, maxGap: 999, factor: 2, mode: "under" } as const;
    const below = { minGap: 6, maxGap: 999, factor: -0.1, mode: "under" } as const;
    expect(progressionFileSchema.safeParse(withRule(2, above)).success).toBe(false);
    expect(progressionFileSchema.safeParse(withRule(2, below)).success).toBe(false);
  });
});

describe("progressionFileSchema — anti-farm et unicité du facteur", () => {
  it("refuse un ratio anti-farm non positif", () => {
    const def: Fixture = structuredClone(BASE);
    def.experience.antiFarm = { maxMonsterLevelRatio: 0 };
    expect(progressionFileSchema.safeParse(def).success).toBe(false);
  });

  it("remplace l'ancien levelGapFactor unique par les règles d'écart", () => {
    const parsed = progressionFileSchema.safeParse({ ...structuredClone(BASE), levelGapFactor: 1 });
    expect(parsed.success).toBe(true);
    expect(parsed.success && "levelGapFactor" in parsed.data).toBe(false);
  });
});
