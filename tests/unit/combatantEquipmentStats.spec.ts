import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createHero } from "../../src/engine/createHero";
import { combatantFromHero } from "../../src/engine/hero";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import type { TotalStats } from "../../src/engine/inventory";
import type { EquipmentState } from "../../src/engine/inventory";
import { zeroStats } from "../../src/engine/inventory";
import type { Element } from "../../src/schemas/spellSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { EquipmentDef } from "../../src/schemas/itemSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";

/**
 * ITEM-01 — l'équipement doit peser en combat. `combatantFromHero` est la seule
 * projection héros → `CombatantState` : les résistances (fixes et %) et le
 * `% Dégâts` y entrent, sinon le stuff affiché ne sert à rien.
 *
 * La donnée ne distingue pas les éléments : `data/items.yaml` ne connaît que
 * `flatRes` / `percentRes` globaux, donc chaque élément reçoit la même valeur.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const sets = parseSetsYaml(read("sets.yaml"));

const IOP: ClassDef = mustFind(classes, "iop");
const ELEMENTS: readonly Element[] = ["earth", "fire", "water", "air", "neutral"];

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function statsWith(patch: Partial<TotalStats>): TotalStats {
  return { ...zeroStats(), ...patch };
}

function combatantOf(stats: TotalStats) {
  const hero = createHero("Anselme", IOP);
  return combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds: [] });
}

function equipmentOf(id: string): EquipmentDef {
  const found = items.find((item) => item.id === id && item.category === "equipment");
  if (found === undefined || found.category !== "equipment") throw new Error(`${id} n'est pas un équipement de data/`);
  return found;
}

function worn(pieces: readonly EquipmentDef[]): EquipmentState {
  return pieces.reduce<EquipmentState>((state, piece) => ({ ...state, [piece.slot]: piece.id }), {});
}

describe("combatantFromHero — résistance fixe", () => {
  it("projette la résistance fixe sur les cinq éléments", () => {
    const combatant = combatantOf(statsWith({ flatRes: 12 }));
    const flats = ELEMENTS.map((element) => combatant.resistances.flat[element]);
    expect(flats).toEqual(ELEMENTS.map(() => 12));
  });

  it("ne convertit pas la résistance fixe en pourcentage", () => {
    const combatant = combatantOf(statsWith({ flatRes: 12 }));
    const percents = ELEMENTS.map((element) => combatant.resistances.percent[element]);
    expect(percents).toEqual(ELEMENTS.map(() => 0));
  });
});

describe("combatantFromHero — % Résistance", () => {
  it("projette le pourcentage de résistance sur les cinq éléments", () => {
    const combatant = combatantOf(statsWith({ percentRes: 8 }));
    const percents = ELEMENTS.map((element) => combatant.resistances.percent[element]);
    expect(percents).toEqual(ELEMENTS.map(() => 8));
  });

  it("garde la résistance fixe nulle quand seul le % est porté", () => {
    const combatant = combatantOf(statsWith({ percentRes: 8 }));
    expect(combatant.resistances.flat.fire).toBe(0);
  });
});

describe("combatantFromHero — % Dégâts", () => {
  it("transporte le % Dégâts de l'équipement", () => {
    expect(combatantOf(statsWith({ percentDmg: 20 })).percentDmg).toBe(20);
  });

  it("vaut 0 sans équipement (non-régression)", () => {
    const combatant = combatantOf(zeroStats());
    expect(combatant.percentDmg).toBe(0);
    expect(ELEMENTS.map((element) => combatant.resistances.flat[element])).toEqual(ELEMENTS.map(() => 0));
    expect(ELEMENTS.map((element) => combatant.resistances.percent[element])).toEqual(ELEMENTS.map(() => 0));
  });
});

describe("combatantFromHero — valeurs lues dans data/", () => {
  it("reprend le % Dégâts de l'objet équipé, sans constante recopiée", () => {
    const cape = mustFind(items, "fer_cape_bache_trouee");
    const inventory = { stacks: [], equipment: { cloak: cape.id } };
    const stats = totalStatsFor({ hero: createHero("Anselme", IOP), inventory, items, sets });
    expect(stats.percentDmg).toBeGreaterThan(0);
    expect(combatantOf(stats).percentDmg).toBe(stats.percentDmg);
  });

  it("reprend la résistance fixe de la panoplie active", () => {
    const pieces = ["chapeau_piou_mazoute", "cape_graisseuse", "amulette_de_la_coupure"].map(equipmentOf);
    const inventory = { stacks: [], equipment: worn(pieces) };
    const stats = totalStatsFor({ hero: createHero("Anselme", IOP), inventory, items, sets });
    expect(stats.flatRes).toBeGreaterThan(0);
    expect(combatantOf(stats).resistances.flat.earth).toBe(stats.flatRes);
  });
});
