import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CellType, MapDef } from "../../src/schemas/mapSchema";
import { decorLayerSchema, decorTypeSchema, mapsFileSchema, parseMapsYaml } from "../../src/schemas/mapSchema";

const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
const maps = parseMapsYaml(raw);

const BEACH_ID = "ferraille_plage_01";
const beach = maps.find((map) => map.id === BEACH_ID);

/** Types explicitement demandés pour la plage : l'épave est le morceau central. */
const REQUIRED_TYPES = [
  "epave",
  "mat",
  "cordages",
  "baril",
  "caisse",
  "ancre",
  "chaine",
  "rocher",
  "algue",
  "debris",
] as const;

function cellAt(map: MapDef, x: number, y: number): CellType | undefined {
  return [...(map.grid[y] ?? "")][x] as CellType | undefined;
}

function beachOrThrow(): MapDef {
  if (beach === undefined) throw new Error(`${BEACH_ID} absente`);
  return beach;
}

describe("data/maps.yaml — décor de la plage de la Ferraille", () => {
  it("expose un champ decor (optionnel, défaut vide)", () => {
    expect(beachOrThrow().decor).toBeDefined();
    expect(Array.isArray(beachOrThrow().decor)).toBe(true);
  });

  it("pose au moins douze objets sur la plage", () => {
    expect(beachOrThrow().decor.length).toBeGreaterThanOrEqual(12);
  });

  it("couvre tous les types demandés par le joueur", () => {
    const types = new Set(beachOrThrow().decor.map((entry) => entry.type));
    REQUIRED_TYPES.forEach((type) => expect(types.has(type), `type absent: ${type}`).toBe(true));
  });

  it("laisse les autres cartes sans décor plutôt que de les casser", () => {
    const others = maps.filter((map) => map.id !== BEACH_ID);
    others.forEach((map) => expect(map.decor).toEqual([]));
  });
});

describe("data/maps.yaml — placement du décor", () => {
  it("ne pose jamais de décor sur un mur ni sur la case de départ du héros", () => {
    const map = beachOrThrow();
    map.decor.forEach((entry) => {
      const cell = cellAt(map, entry.x, entry.y);
      expect(cell, `hors grille: ${entry.type} (${entry.x},${entry.y})`).toBeDefined();
      expect(cell, `mur: ${entry.type} (${entry.x},${entry.y})`).not.toBe("#");
      expect(cell, `héros: ${entry.type} (${entry.x},${entry.y})`).not.toBe("P");
    });
  });

  it("valide les coordonnées et la couche de chaque objet", () => {
    const map = beachOrThrow();
    map.decor.forEach((entry) => {
      expect(decorTypeSchema.safeParse(entry.type).success, `type inconnu: ${entry.type}`).toBe(true);
      expect(decorLayerSchema.safeParse(entry.layer).success, `couche: ${entry.layer}`).toBe(true);
      expect(Number.isInteger(entry.x) && entry.x >= 0 && entry.x < map.width).toBe(true);
      expect(Number.isInteger(entry.y) && entry.y >= 0 && entry.y < map.height).toBe(true);
    });
  });

  it("refuse un décor posé sur un mur", () => {
    const broken = { maps: [{ id: "grille_invalide", name: "Grille invalide", width: 2, height: 1, grid: ["P#"], decor: [{ type: "rocher", x: 1, y: 0 }] }] };
    expect(() => mapsFileSchema.parse(broken)).toThrow();
  });
});
