import { describe, expect, it } from "vitest";
import { spendStatPoints } from "../../src/engine/spendStatPoints";
import type { SoftCap, SoftCaps } from "../../src/schemas/classSchema";

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

describe("spendStatPoints : soft caps élémentaires", () => {
  it("dépense 1 point sur le palier 1:1 puis 2 sur le palier 2:1 (Iop Force)", () => {
    const result = spendStatPoints({
      stat: "strength",
      current: 99,
      availablePoints: 3,
      softCaps: makeCaps({ strength: IOP_STRENGTH }),
    });
    expect(result).toEqual({ value: 101, gained: 2, spent: 3, remaining: 0 });
  });

  it("utilise le coût du palier suivant dès le franchissement du seuil (Enutrof Force)", () => {
    const result = spendStatPoints({
      stat: "strength",
      current: 50,
      availablePoints: 2,
      softCaps: makeCaps({ strength: ENUTROF_STRENGTH }),
    });
    expect(result).toEqual({ value: 51, gained: 1, spent: 2, remaining: 0 });
  });

  it("traite un seuil null comme une limite infinie au dernier palier", () => {
    const result = spendStatPoints({
      stat: "chance",
      current: 100,
      availablePoints: 5,
      softCaps: makeCaps({ chance: [[80, 4], [null, 5]] }),
    });
    expect(result).toEqual({ value: 101, gained: 1, spent: 5, remaining: 0 });
  });
});

describe("spendStatPoints : taux fixes", () => {
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

  it("respecte la sagesse à 3 points pour 1 (capital suffisant)", () => {
    const result = spendStatPoints({
      stat: "wisdom",
      current: 0,
      availablePoints: 3,
      softCaps: makeCaps(),
    });
    expect(result).toEqual({ value: 1, gained: 1, spent: 3, remaining: 0 });
  });
});

describe("spendStatPoints : capital insuffisant", () => {
  it("ne fait aucun point partiel quand le capital est insuffisant (sagesse)", () => {
    const result = spendStatPoints({
      stat: "wisdom",
      current: 0,
      availablePoints: 2,
      softCaps: makeCaps(),
    });
    expect(result).toEqual({ value: 0, gained: 0, spent: 0, remaining: 2 });
  });

  it("retourne un résultat neutre sans aucun point disponible", () => {
    const result = spendStatPoints({
      stat: "agility",
      current: 12,
      availablePoints: 0,
      softCaps: makeCaps(),
    });
    expect(result).toEqual({ value: 12, gained: 0, spent: 0, remaining: 0 });
  });
});
