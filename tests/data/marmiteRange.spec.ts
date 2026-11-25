import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

const read = (file: string): string => readFileSync(join(process.cwd(), "data", file), "utf8");
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));

const PROJECTION = "fer_spell_projection_de_mazout";
const marmite = monsters.find((monster) => monster.id === "fer_marmite_fuyarde");
const spell = spells.find((entry) => entry.id === PROJECTION);

describe("Projection de Mazout — données", () => {
  it("déclare le sort de la Marmite avec ses bornes exactes", () => {
    expect(spell).toMatchObject({
      id: PROJECTION,
      classId: "monster",
      kind: "damage",
      element: "fire",
      apCost: 3,
      minRange: 4,
      maxRange: 5,
      requiresLos: true,
      cooldown: 2,
      damage: { min: 5, max: 7 },
    });
  });

  it("l'attache en premier à la Marmite et conserve Coup de Couvercle", () => {
    expect(marmite?.spellIds[0]).toBe(PROJECTION);
    expect(marmite?.spellIds).toContain("fer_spell_coup_de_couvercle");
  });
});
