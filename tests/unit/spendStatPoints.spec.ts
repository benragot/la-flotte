import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { spendStatPoints } from "../../src/engine/spendStatPoints";
import { classesFileSchema, parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef, SoftCap, SoftCaps } from "../../src/schemas/classSchema";

const SIMPLE: SoftCap[] = [
  [20, 1],
  [40, 2],
  [60, 3],
  [80, 4],
  [null, 5],
];

const IOP_STRENGTH: SoftCap[] = [
  [100, 1],
  [200, 2],
  [300, 3],
  [400, 4],
  [null, 5],
];

const ENUTROF_STRENGTH: SoftCap[] = [
  [50, 1],
  [150, 2],
  [250, 3],
  [350, 4],
  [null, 5],
];

const VALID_CAPS = {
  vitality: [[1, 1]],
  wisdom: [[3, 1]],
  strength: SIMPLE,
  intelligence: SIMPLE,
  chance: SIMPLE,
  agility: SIMPLE,
};

function makeCaps(overrides: Partial<SoftCaps> = {}): SoftCaps {
  return {
    vitality: [[1, 1]],
    wisdom: [[3, 1]],
    strength: SIMPLE,
    intelligence: SIMPLE,
    chance: SIMPLE,
    agility: SIMPLE,
    ...overrides,
  };
}

function loadClass(id: string): ClassDef {
  const raw = readFileSync(join(process.cwd(), "data", "classes.yaml"), "utf8");
  const found = parseClassesYaml(raw).find((entry) => entry.id === id);
  if (!found) throw new Error(`Classe ${id} absente de classes.yaml`);
  return found;
}

function classWith(softCaps: unknown) {
  const base = { id: "test", name: "Test", basePa: 6, basePm: 3, baseHp: 50, basePp: 100 };
  return { classes: [{ ...base, vitalityGainPerPoint: 1, softCaps }] };
}

function reject(softCaps: unknown, pattern: RegExp): void {
  expect(() => classesFileSchema.parse(classWith(softCaps))).toThrow(pattern);
}

describe("spendStatPoints : soft caps élémentaires", () => {
  it("dépense 1 point sur le palier 1:1 puis 2 sur le palier 2:1 (Iop Force)", () => {
    const softCaps = makeCaps({ strength: IOP_STRENGTH });
    const result = spendStatPoints({ stat: "strength", current: 99, availablePoints: 3, softCaps });
    expect(result).toEqual({ value: 101, gained: 2, spent: 3, remaining: 0 });
  });

  it("utilise le coût du palier suivant dès le franchissement du seuil (Enutrof Force)", () => {
    const softCaps = makeCaps({ strength: ENUTROF_STRENGTH });
    const result = spendStatPoints({ stat: "strength", current: 50, availablePoints: 2, softCaps });
    expect(result).toEqual({ value: 51, gained: 1, spent: 2, remaining: 0 });
  });

  it("traite un seuil null comme une limite infinie au dernier palier", () => {
    const softCaps = makeCaps({ chance: [[80, 4], [null, 5]] });
    const result = spendStatPoints({ stat: "chance", current: 100, availablePoints: 5, softCaps });
    expect(result).toEqual({ value: 101, gained: 1, spent: 5, remaining: 0 });
  });
});

describe("spendStatPoints : taux d'échange fixe (un seul palier)", () => {
  it("applique le gain de vitalité du Sacrieur (2 par point)", () => {
    const result = spendStatPoints({
      stat: "vitality",
      current: 0,
      availablePoints: 1,
      softCaps: makeCaps(),
      gainPerPoint: 2,
    });
    expect(result).toEqual({ value: 2, gained: 2, spent: 1, remaining: 0 });
  });

  it("respecte la sagesse à 3 points pour 1", () => {
    const result = spendStatPoints({ stat: "wisdom", current: 0, availablePoints: 3, softCaps: makeCaps() });
    expect(result).toEqual({ value: 1, gained: 1, spent: 3, remaining: 0 });
  });

  it("applique le gain du palier [[3, 2]] (3 capital ⇒ +2)", () => {
    const softCaps = makeCaps({ wisdom: [[3, 2]] });
    const result = spendStatPoints({ stat: "wisdom", current: 0, availablePoints: 3, softCaps });
    expect(result).toEqual({ value: 2, gained: 2, spent: 3, remaining: 0 });
  });

  it("applique le gain du palier [[1, 3]] (1 capital ⇒ +3)", () => {
    const softCaps = makeCaps({ vitality: [[1, 3]] });
    const result = spendStatPoints({ stat: "vitality", current: 0, availablePoints: 1, softCaps });
    expect(result).toEqual({ value: 3, gained: 3, spent: 1, remaining: 0 });
  });
});

describe("spendStatPoints : capital insuffisant", () => {
  it("ne fait aucun point partiel quand le capital est insuffisant (sagesse)", () => {
    const result = spendStatPoints({ stat: "wisdom", current: 0, availablePoints: 2, softCaps: makeCaps() });
    expect(result).toEqual({ value: 0, gained: 0, spent: 0, remaining: 2 });
  });

  it("retourne un résultat neutre sans aucun point disponible", () => {
    const result = spendStatPoints({ stat: "agility", current: 12, availablePoints: 0, softCaps: makeCaps() });
    expect(result).toEqual({ value: 12, gained: 0, spent: 0, remaining: 0 });
  });
});

describe("spendStatPoints : données réelles de classes.yaml", () => {
  it("alloue la Force du Iop (99 + 3 points ⇒ 101)", () => {
    const result = spendStatPoints({
      stat: "strength",
      current: 99,
      availablePoints: 3,
      softCaps: loadClass("iop").softCaps,
    });
    expect(result).toEqual({ value: 101, gained: 2, spent: 3, remaining: 0 });
  });

  it("alloue la Vitalité du Sacrieur (1 point ⇒ +2)", () => {
    const sacrieur = loadClass("sacrieur");
    const result = spendStatPoints({
      stat: "vitality",
      current: 0,
      availablePoints: 1,
      softCaps: sacrieur.softCaps,
      gainPerPoint: sacrieur.vitalityGainPerPoint,
    });
    expect(result).toEqual({ value: 2, gained: 2, spent: 1, remaining: 0 });
  });
});

describe("softCapsSchema : forme des tables", () => {
  it("accepte les tables conformes des 12 classes", () => {
    expect(() => classesFileSchema.parse(classWith(VALID_CAPS))).not.toThrow();
  });

  it("rejette une vitalité à deux paliers", () => {
    reject({ ...VALID_CAPS, vitality: [[1, 1], [2, 1]] }, /vitality.*exactement un palier/);
  });

  it("rejette une force à un seul palier", () => {
    reject({ ...VALID_CAPS, strength: [[100, 1]] }, /strength.*au moins deux paliers/);
  });

  it("rejette des seuils non strictement croissants", () => {
    reject({ ...VALID_CAPS, strength: [[200, 1], [100, 2], [null, 3]] }, /strength.*strictement croissants/);
  });

  it("rejette un dernier palier qui n'est pas null", () => {
    reject({ ...VALID_CAPS, strength: [[100, 1], [200, 2]] }, /dernier palier de strength.*null/);
  });
});
