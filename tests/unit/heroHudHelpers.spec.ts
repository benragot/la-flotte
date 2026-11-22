import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHero } from "../../src/engine/createHero";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import {
  buildStatOptions,
  canAffordAnyStat,
  classSummary,
  formatSoftCapTier,
  isValidCharacterName,
  statCostAt,
} from "../../src/ui/heroHudHelpers";

const classes = parseClassesYaml(readFileSync(join(process.cwd(), "data", "classes.yaml"), "utf8"));

function mustFind(id: string): ClassDef {
  const found = classes.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de classes.yaml`);
  return found;
}

const iop = mustFind("iop");
const sacrieur = mustFind("sacrieur");

function costFor(stat: "strength" | "wisdom" | "vitality", value: number): number {
  return statCostAt({ softCaps: iop.softCaps, stat, value });
}

function iopHero(capitalPoints: number) {
  return { ...createHero("Toto", iop), capitalPoints };
}

describe("statCostAt — paliers multi-seuils (Force Iop)", () => {
  it("coûte 1 point de 0 à 99 puis 2 au palier suivant", () => {
    expect(costFor("strength", 0)).toBe(1);
    expect(costFor("strength", 99)).toBe(1);
    expect(costFor("strength", 100)).toBe(2);
  });

  it("suit chaque frontière de palier sans décalage", () => {
    expect(costFor("strength", 199)).toBe(2);
    expect(costFor("strength", 200)).toBe(3);
    expect(costFor("strength", 300)).toBe(4);
    expect(costFor("strength", 400)).toBe(5);
    expect(costFor("strength", 500)).toBe(5);
  });

  it("lit le palier Sacrieur (100/150) et pas celui du Iop", () => {
    const options = { softCaps: sacrieur.softCaps, stat: "strength" as const };
    expect(statCostAt({ ...options, value: 99 })).toBe(3);
    expect(statCostAt({ ...options, value: 100 })).toBe(4);
    expect(statCostAt({ ...options, value: 150 })).toBe(5);
  });
});

describe("statCostAt — taux fixe (un seul palier)", () => {
  it("coûte 3 en Sagesse quelle que soit la valeur", () => {
    expect(costFor("wisdom", 0)).toBe(3);
    expect(costFor("wisdom", 250)).toBe(3);
  });

  it("coûte 1 en Vitalité quelle que soit la valeur", () => {
    expect(costFor("vitality", 0)).toBe(1);
    expect(costFor("vitality", 999)).toBe(1);
  });
});

describe("buildStatOptions", () => {
  it("retourne les six stats dans un ordre stable", () => {
    const options = buildStatOptions({ hero: iopHero(0), classDef: iop });
    expect(options.map((option) => option.stat)).toEqual([
      "vitality",
      "wisdom",
      "strength",
      "intelligence",
      "chance",
      "agility",
    ]);
    expect(options.map((option) => option.label)).toEqual([
      "Vitalité",
      "Sagesse",
      "Force",
      "Intelligence",
      "Chance",
      "Agilité",
    ]);
  });

  it("aligne current, cost et affordable sur le héros et le capital", () => {
    const hero = { ...iopHero(3), strength: 100 };
    const options = buildStatOptions({ hero, classDef: iop });
    const strength = options.find((option) => option.stat === "strength");
    expect(strength).toEqual({ stat: "strength", label: "Force", current: 100, cost: 2, affordable: true });
    expect(options.find((option) => option.stat === "wisdom")?.cost).toBe(3);
  });

  it("marque affordable=false quand le capital ne couvre pas le coût", () => {
    const options = buildStatOptions({ hero: iopHero(2), classDef: iop });
    expect(options.find((option) => option.stat === "vitality")?.affordable).toBe(true);
    expect(options.find((option) => option.stat === "wisdom")?.affordable).toBe(false);
  });
});

describe("canAffordAnyStat", () => {
  it("est faux sans point de capital et vrai dès 1 point", () => {
    expect(canAffordAnyStat({ hero: iopHero(0), classDef: iop })).toBe(false);
    expect(canAffordAnyStat({ hero: iopHero(1), classDef: iop })).toBe(true);
  });

  it("compte la stat la moins chère, pas la première de la liste", () => {
    const hero = { ...iopHero(1), strength: 100 };
    expect(canAffordAnyStat({ hero, classDef: iop })).toBe(true);
  });
});

describe("formatSoftCapTier", () => {
  it("affiche le palier courant d'une stat à seuils", () => {
    const base = { softCaps: iop.softCaps, stat: "strength" as const };
    expect(formatSoftCapTier({ ...base, value: 0 })).toBe("1→100 : 1 pt");
    expect(formatSoftCapTier({ ...base, value: 100 })).toBe("101→200 : 2 pts");
    expect(formatSoftCapTier({ ...base, value: 450 })).toBe("401+ : 5 pts");
  });

  it("affiche un taux fixe pour la Vitalité et la Sagesse", () => {
    const base = { softCaps: iop.softCaps };
    expect(formatSoftCapTier({ ...base, stat: "vitality", value: 12 })).toBe("Taux fixe : 1 pt");
    expect(formatSoftCapTier({ ...base, stat: "wisdom", value: 3 })).toBe("Taux fixe : 3 pts");
  });
});

describe("classSummary", () => {
  it("extrait l'identité et les quatre stats de base", () => {
    expect(classSummary(iop)).toEqual({
      id: "iop",
      name: "Iop",
      basePa: 6,
      basePm: 3,
      baseHp: 50,
      basePp: 100,
    });
  });
});

describe("isValidCharacterName", () => {
  it("refuse vide et espaces", () => {
    expect(isValidCharacterName("")).toBe(false);
    expect(isValidCharacterName("   ")).toBe(false);
  });

  it("accepte 1 à 20 caractères, accents compris", () => {
    expect(isValidCharacterName("Éli")).toBe(true);
    expect(isValidCharacterName("  Perceval  ")).toBe(true);
    expect(isValidCharacterName("a".repeat(20))).toBe(true);
    expect(isValidCharacterName("a".repeat(21))).toBe(false);
  });
});
