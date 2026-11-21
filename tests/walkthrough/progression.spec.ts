import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHero } from "../../src/engine/createHero";
import { parseClassesYaml } from "../../src/schemas/classSchema";

const CLASSES_PATH = join(process.cwd(), "data", "classes.yaml");
const loadIop = () => {
  const classes = parseClassesYaml(readFileSync(CLASSES_PATH, "utf8"));
  return classes.find((entry) => entry.id === "iop");
};

describe("walkthrough : progression", () => {
  it("charge classes.yaml et trouve la classe Iop", () => {
    expect(loadIop()).toBeDefined();
  });

  it("crée un personnage Iop niveau 1 avec ses stats de départ", () => {
    const iop = loadIop();
    if (!iop) throw new Error("Classe iop absente de classes.yaml");
    const hero = createHero("Balthazar", iop);
    expect(hero.level).toBe(1);
    expect(hero.ap).toBe(6);
    expect(hero.mp).toBe(3);
    expect(hero.hp).toBe(50);
    expect(hero.pp).toBe(100);
  });
});
