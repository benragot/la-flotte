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
