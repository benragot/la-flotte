import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { classesFileSchema } from "../../src/schemas/classSchema";
import { mapsFileSchema } from "../../src/schemas/mapSchema";

const DATA_DIR = join(process.cwd(), "data");
const SCHEMAS: Record<string, { parse: (raw: unknown) => unknown }> = {
  "classes.yaml": classesFileSchema,
  "maps.yaml": mapsFileSchema,
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
