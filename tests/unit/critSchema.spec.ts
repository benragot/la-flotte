import { describe, expect, it } from "vitest";
import { spellSchema } from "../../src/schemas/spellSchema";

/** Sort minimal valide : seuls les champs de CC varient d'un cas à l'autre. */
const BASE = {
  id: "sort_test",
  name: "Sort test",
  description: "Un sort de test.",
  classId: "iop",
  kind: "damage" as const,
  element: "earth" as const,
  apCost: 3,
  minRange: 1,
  maxRange: 1,
  requiresLos: false,
  damage: { min: 8, max: 12 },
};

describe("spellSchema — critRate est un dénominateur 1/X (SPELL-03)", () => {
  it("accepte un dénominateur ≥ 2 et un critDamage ordonné", () => {
    // PARITÉ: SPELL-03, X = 2 est le plafond de chance (1/2), jamais un pourcentage.
    const spell = spellSchema.parse({ ...BASE, critRate: 30, critDamage: { min: 10, max: 12 } });
    expect(spell.critRate).toBe(30);
    expect(spell.critDamage).toEqual({ min: 10, max: 12 });
  });

  it("refuse un dénominateur inférieur à 2", () => {
    expect(spellSchema.safeParse({ ...BASE, critRate: 1 }).success).toBe(false);
  });

  it("refuse un critDamage inversé ou hors bornes", () => {
    expect(spellSchema.safeParse({ ...BASE, critDamage: { min: 12, max: 8 } }).success).toBe(false);
    expect(spellSchema.safeParse({ ...BASE, critDamage: { min: 0, max: 1000 } }).success).toBe(false);
  });

  it("n'exige ni critRate ni critDamage : absent = aucun CC", () => {
    const spell = spellSchema.parse(BASE);
    expect(spell.critRate).toBeUndefined();
    expect(spell.critDamage).toBeUndefined();
  });
});
