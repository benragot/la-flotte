import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { classesFileSchema } from "../../src/schemas/classSchema";
import { itemsFileSchema } from "../../src/schemas/itemSchema";
import { mapsFileSchema } from "../../src/schemas/mapSchema";
import { monstersFileSchema } from "../../src/schemas/monsterSchema";
import { progressionFileSchema } from "../../src/schemas/progressionSchema";
import { setsFileSchema } from "../../src/schemas/setSchema";
import { spellsFileSchema } from "../../src/schemas/spellSchema";
import { spritesFileSchema } from "../../src/schemas/spriteSchema";

const DATA_DIR = join(process.cwd(), "data");
const SCHEMAS: Record<string, { parse: (raw: unknown) => unknown }> = {
  "classes.yaml": classesFileSchema,
  "items.yaml": itemsFileSchema,
  "maps.yaml": mapsFileSchema,
  "monsters.yaml": monstersFileSchema,
  "progression.yaml": progressionFileSchema,
  "sets.yaml": setsFileSchema,
  "spells.yaml": spellsFileSchema,
  "sprites.yaml": spritesFileSchema,
};

const yamlFiles = readdirSync(DATA_DIR).filter((file) => file.endsWith(".yaml"));

const parseFile = (file: string) => {
  const schema = SCHEMAS[file];
  expect(schema, `Aucun schéma Zod enregistré pour ${file}`).toBeDefined();
  const raw = readFileSync(join(DATA_DIR, file), "utf8");
  expect(() => schema?.parse(yaml.load(raw))).not.toThrow();
};

describe("données YAML", () => {
  it("contient au moins un fichier YAML", () => {
    expect(yamlFiles.length).toBeGreaterThan(0);
  });

  it.each(yamlFiles)("valide %s avec Zod", (file) => {
    parseFile(file);
  });
});

describe("manifeste des sprites", () => {
  const sprites = spritesFileSchema.parse(yaml.load(readFileSync(join(DATA_DIR, "sprites.yaml"), "utf8"))).sprites;

  it("décrit les 13 entités animées", () => {
    expect(sprites).toHaveLength(13);
    expect(new Set(sprites.map((sprite) => sprite.entityId)).size).toBe(13);
  });

  it("associe les quatre animations à chaque entité", () => {
    sprites.forEach((sprite) => {
      expect(Object.keys(sprite.animations).sort()).toEqual(["attack", "hit", "idle", "walk"]);
      expect(sprite.frameWidth).toBe(64);
      expect(sprite.frameHeight).toBe(64);
    });
  });

  it("donne une ligne unique par animation", () => {
    sprites.forEach((sprite) => {
      const rows = Object.values(sprite.animations).map((animation) => animation.row);
      expect(new Set(rows).size).toBe(4);
    });
  });

  it("référence les feuilles livrées dans public/assets/sprites", () => {
    sprites.forEach((sprite) => {
      expect(sprite.path).toBe(`/assets/sprites/${sprite.entityId}.svg`);
    });
  });
});
