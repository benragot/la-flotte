import { describe, expect, it } from "vitest";
import { createHero } from "../../src/engine/createHero";
import type { ClassDef } from "../../src/schemas/classSchema";

const IOP: ClassDef = {
  id: "iop",
  name: "Iop",
  basePa: 6,
  basePm: 3,
  baseHp: 50,
  basePp: 100,
  vitalityGainPerPoint: 1,
  softCaps: {
    vitality: [[1, 1]],
    wisdom: [[3, 1]],
    strength: [
      [100, 1],
      [200, 2],
      [300, 3],
      [400, 4],
      [null, 5],
    ],
    intelligence: [[20, 1], [40, 2], [60, 3], [80, 4], [null, 5]],
    chance: [[20, 1], [40, 2], [60, 3], [80, 4], [null, 5]],
    agility: [[20, 1], [40, 2], [60, 3], [80, 4], [null, 5]],
  },
};

describe("createHero", () => {
  it("crée un héros de niveau 1 avec les stats de départ", () => {
    const hero = createHero("Balthazar", IOP);
    expect(hero.level).toBe(1);
    expect(hero.ap).toBe(6);
    expect(hero.mp).toBe(3);
    expect(hero.hp).toBe(50);
    expect(hero.pp).toBe(100);
  });

  it("conserve le nom et l'identité de la classe", () => {
    const hero = createHero("Balthazar", IOP);
    expect(hero.name).toBe("Balthazar");
    expect(hero.classId).toBe("iop");
    expect(hero.className).toBe("Iop");
  });

  it("remplit les points de vie au maximum", () => {
    const hero = createHero("Balthazar", IOP);
    expect(hero.hp).toBe(hero.maxHp);
  });
});
