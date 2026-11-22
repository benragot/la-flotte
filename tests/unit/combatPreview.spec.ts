import { describe, expect, it } from "vitest";
import { computeDamage, computePushbackDamage } from "../../src/engine/combat";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { parseAsciiMap } from "../../src/engine/grid";
import { gridToIso } from "../../src/renderer/gridProjection";
import { buildPathPreview, pathIsoCenters } from "../../src/renderer/pathPreview";
import type { DamagePreviewInput } from "../../src/renderer/damagePreview";
import { buildDamagePreview, elementStat } from "../../src/renderer/damagePreview";
import type { Element } from "../../src/schemas/spellSchema";

// Fixture locale 12x12 : un mur vertical (x=6, y=1..3) et une flaque (x=4..6, y=5).
const ROWS = [
  "............",
  "......#.....",
  "......#.....",
  "......#.....",
  "............",
  "....~~~.....",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
];

const MAP: AsciiMap = parseAsciiMap(ROWS);
const ORIGIN = { x: 100, y: 50 };

function first<T>(list: readonly T[]): T {
  const [head] = list;
  if (head === undefined) throw new Error("liste vide");
  return head;
}

function previewTo(to: Position, maxPm: number, occupied?: Position[]) {
  return buildPathPreview({ map: MAP, from: { x: 0, y: 0 }, to, maxPm, occupied });
}

describe("buildPathPreview — chemin", () => {
  it("chemin libre : coût = cases parcourues, PM restants cohérents", () => {
    const preview = previewTo({ x: 3, y: 0 }, 6);
    expect(preview.reachable).toBe(true);
    expect(preview.blockedBy).toBeNull();
    expect(preview.cost).toBe(3);
    expect(preview.remainingPm).toBe(3);
    expect(preview.path).toHaveLength(4);
    expect(preview.path).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  });

  it("from === to : chemin d'une case, coût nul, aucun PM consommé", () => {
    const preview = previewTo({ x: 0, y: 0 }, 5);
    expect(preview.reachable).toBe(true);
    expect(preview.cost).toBe(0);
    expect(preview.remainingPm).toBe(5);
    expect(preview.path).toEqual([{ x: 0, y: 0 }]);
  });

  it("cible occupée : refus déterministe pour occupation", () => {
    const preview = previewTo({ x: 2, y: 0 }, 6, [{ x: 2, y: 0 }]);
    expect(preview.reachable).toBe(false);
    expect(preview.blockedBy).toBe("occupied");
    expect(preview.cost).toBe(0);
    expect(preview.path).toEqual([]);
    expect(preview.remainingPm).toBe(6);
  });

  it("contourne le mur quand un détour reste dans les PM", () => {
    const preview = buildPathPreview({ map: MAP, from: { x: 6, y: 0 }, to: { x: 6, y: 4 }, maxPm: 8 });
    expect(preview.reachable).toBe(true);
    // Mesure 8 directions, facture DEC-10 : 6 PM — (6,0)→(7,1) diagonal 2,
    // (7,1)→(7,2) 1, (7,2)→(7,3) 1, (7,3)→(6,4) diagonal 2. L'aperçu facturait
    // `path.length - 1` = 4 PM, donc sous-facturait la diagonale.
    expect(preview.cost).toBe(6);
    expect(preview.path.some((cell) => cell.x === 6 && cell.y > 0 && cell.y < 4)).toBe(false);
  });
});

describe("buildPathPreview — refus", () => {
  it("cible mur : refus pour mur", () => {
    expect(previewTo({ x: 6, y: 2 }, 12).blockedBy).toBe("wall");
  });

  it("cible eau : refus pour eau", () => {
    expect(previewTo({ x: 4, y: 5 }, 12).blockedBy).toBe("water");
  });

  it("cible hors de portée des PM : refus pour portée", () => {
    const preview = previewTo({ x: 5, y: 4 }, 2);
    expect(preview.reachable).toBe(false);
    expect(preview.blockedBy).toBe("range");
    expect(preview.cost).toBe(0);
  });
});

describe("buildPathPreview — priorité de blockedBy", () => {
  it("cible occupée ET mur : l'occupation prime sur le relief", () => {
    expect(previewTo({ x: 6, y: 2 }, 12, [{ x: 6, y: 2 }]).blockedBy).toBe("occupied");
  });

  it("cible occupée ET eau : l'occupation prime sur l'eau", () => {
    expect(previewTo({ x: 4, y: 5 }, 12, [{ x: 4, y: 5 }]).blockedBy).toBe("occupied");
  });
});

describe("buildPathPreview — départ invalide", () => {
  it("from hors carte : refus sans throw, aucun PM consommé", () => {
    const preview = buildPathPreview({ map: MAP, from: { x: -1, y: 0 }, to: { x: 3, y: 0 }, maxPm: 6 });
    expect(preview.reachable).toBe(false);
    expect(preview.cost).toBe(0);
    expect(preview.remainingPm).toBe(6);
    expect(preview.path).toEqual([]);
  });

  it("from sur un mur : refus symétrique", () => {
    const preview = buildPathPreview({ map: MAP, from: { x: 6, y: 1 }, to: { x: 7, y: 2 }, maxPm: 4 });
    expect(preview.reachable).toBe(false);
    expect(preview.cost).toBe(0);
    expect(preview.remainingPm).toBe(4);
  });

  it("chemin long : les PM restants ne deviennent jamais négatifs", () => {
    const preview = buildPathPreview({ map: MAP, from: { x: 0, y: 0 }, to: { x: 11, y: 11 }, maxPm: 22 });
    expect(preview.reachable).toBe(true);
    // Mesure 8 directions, facture DEC-10 : 22 PM — onze pas à 2 PM, le chemin
    // glisse en diagonale pour contourner la flaque x=4..6,y=5. L'aperçu
    // facturait `path.length - 1` = 13 PM, donc sous-facturait chaque diagonale.
    expect(preview.cost).toBe(22);
    expect(preview.remainingPm).toBeGreaterThanOrEqual(0);
  });
});

describe("pathIsoCenters", () => {
  it("un centre par case, projeté par gridToIso (aucune formule recopiée)", () => {
    const path: Position[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    const centers = pathIsoCenters({ path, origin: ORIGIN });
    expect(centers).toHaveLength(path.length);
    expect(first(centers)).toEqual(gridToIso({ x: 0, y: 0, origin: ORIGIN }));
    expect(centers[2]).toEqual(gridToIso({ x: 1, y: 1, origin: ORIGIN }));
  });

  it("suit la longueur d'un chemin produit par l'aperçu", () => {
    const preview = previewTo({ x: 2, y: 2 }, 6);
    const centers = pathIsoCenters({ path: preview.path, origin: ORIGIN });
    expect(centers).toHaveLength(preview.path.length);
    expect(first(centers)).toEqual(gridToIso({ x: 0, y: 0, origin: ORIGIN }));
  });
});

const ZERO_RES: Record<Element, number> = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function damageInput(overrides: Partial<DamagePreviewInput> = {}): DamagePreviewInput {
  return {
    spell: { base: { min: 10, max: 18 }, element: "earth" },
    attackerStats: { strength: 120, intelligence: 0, chance: 0, agility: 0 },
    target: { resistances: { flat: { ...ZERO_RES, earth: 5 }, percent: { ...ZERO_RES, earth: 20 } } },
    casterLevel: 30,
    ...overrides,
  };
}

describe("buildDamagePreview — aucun écart avec computeDamage", () => {
  it("min et max égaux à computeDamage sur les mêmes entrées", () => {
    const input = damageInput();
    const preview = buildDamagePreview(input);
    const direct = { base: 0, stat: 120, flatRes: 5, pctRes: 20, isPlayer: false };
    expect(preview.min).toBe(computeDamage({ ...direct, base: 10 }));
    expect(preview.max).toBe(computeDamage({ ...direct, base: 18 }));
    expect(preview.critical).toBe(computeDamage({ ...direct, base: 18 }));
  });

  it("le bonus de critique passe par percentDmg, comme dans strike.ts", () => {
    const preview = buildDamagePreview(damageInput({ critDamagePct: 50 }));
    const direct = { base: 18, stat: 120, flatRes: 5, pctRes: 20, percentDmg: 50, isPlayer: false };
    expect(preview.critical).toBe(computeDamage(direct));
    expect(preview.critical).toBeGreaterThan(preview.max);
  });
});

describe("buildDamagePreview — armure de la cible", () => {
  const ARMOR_TARGET = {
    resistances: { flat: { ...ZERO_RES, earth: 5 }, percent: { ...ZERO_RES, earth: 20 } },
    armor: 10,
  };

  it("armor réduit min et max, à l'identique de computeDamage", () => {
    const plain = buildDamagePreview(damageInput());
    const armored = buildDamagePreview(damageInput({ target: ARMOR_TARGET }));
    const direct = { stat: 120, flatRes: 5, pctRes: 20, armor: 10, isPlayer: false };
    expect(armored.min).toBeLessThan(plain.min);
    expect(armored.max).toBeLessThan(plain.max);
    expect(armored.min).toBe(computeDamage({ ...direct, base: 10 }));
    expect(armored.max).toBe(computeDamage({ ...direct, base: 18 }));
  });
});

describe("buildDamagePreview — résistances de la cible", () => {
  function resisted(pctRes: number, isTargetPlayer: boolean) {
    return buildDamagePreview({
      spell: { base: { min: 100, max: 100 }, element: "fire" },
      attackerStats: { strength: 0, intelligence: 0, chance: 0, agility: 0 },
      target: { resistances: { flat: ZERO_RES, percent: { ...ZERO_RES, fire: pctRes } } },
      casterLevel: 1,
      isTargetPlayer,
    });
  }

  it("un monstre à 80 % encaisse 80 % de réduction", () => {
    expect(resisted(80, false).min).toBe(20);
  });

  it("un joueur cible est plafonné à 50 % par computeDamage", () => {
    expect(resisted(80, true).min).toBe(50);
  });

  it("une faiblesse négative augmente les dégâts", () => {
    const preview = buildDamagePreview({
      spell: { base: { min: 10, max: 10 }, element: "water" },
      attackerStats: { strength: 0, intelligence: 0, chance: 0, agility: 0 },
      target: { resistances: { flat: { ...ZERO_RES, water: -15 }, percent: ZERO_RES } },
      casterLevel: 1,
    });
    expect(preview.min).toBe(25);
    expect(preview.min).toBeGreaterThan(10);
  });
});

describe("buildDamagePreview — poussée et critique", () => {
  it("poussée : dégâts de collision calculés par computePushbackDamage", () => {
    const preview = buildDamagePreview(damageInput({ casterLevel: 50, pushCells: 2 }));
    const direct = computePushbackDamage({ casterLevel: 50, roll: 8, remainingCells: 2, isSecondaryTarget: false });
    expect(preview.pushDamage).toBe(direct);
    expect(preview.pushDamage).toBe(32);
  });

  it("sans poussée : pushDamage nul", () => {
    expect(buildDamagePreview(damageInput()).pushDamage).toBe(0);
    expect(buildDamagePreview(damageInput({ pushCells: 0 })).pushDamage).toBe(0);
  });

  it("critRate vient de computeCritRate (plancher moteur)", () => {
    const preview = buildDamagePreview(damageInput());
    expect(preview.critRate).toBe(2);
    expect(buildDamagePreview(damageInput({ baseCrit: 60, bonusCrit: 0, attackerStats: { strength: 0, intelligence: 0, chance: 0, agility: 200 } })).critRate).toBeGreaterThan(2);
  });
});

describe("elementStat", () => {
  const stats = { strength: 10, intelligence: 20, chance: 30, agility: 40 };

  it("mappe les 5 éléments sur la bonne caractéristique", () => {
    expect(elementStat({ element: "earth", stats })).toBe(10);
    expect(elementStat({ element: "neutral", stats })).toBe(10);
    expect(elementStat({ element: "fire", stats })).toBe(20);
    expect(elementStat({ element: "water", stats })).toBe(30);
    expect(elementStat({ element: "air", stats })).toBe(40);
  });
});
