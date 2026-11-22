import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { itemsFileSchema, parseItemsYaml } from "../../src/schemas/itemSchema";
import type { ItemDef } from "../../src/schemas/itemSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSetsYaml, setsFileSchema } from "../../src/schemas/setSchema";
import type { SetDef } from "../../src/schemas/setSchema";

const DATA_DIR = join(process.cwd(), "data");
const SNAKE_CASE = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SET_SLOTS = ["hat", "cloak", "amulet", "boots"];

const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");
const loadItems = (): ItemDef[] => parseItemsYaml(read("items.yaml"));
const loadSets = (): SetDef[] => parseSetsYaml(read("sets.yaml"));
const loadMonsterIds = (): string[] => parseMonstersYaml(read("monsters.yaml")).map((m) => m.id);

type Equipment = Extract<ItemDef, { category: "equipment" }>;
const isEquipment = (item: ItemDef): item is Equipment => item.category === "equipment";

const equipmentOf = (items: readonly ItemDef[]): Equipment[] => items.filter(isEquipment);

function findOrphanPieceIds(sets: readonly SetDef[], items: readonly ItemDef[]): string[] {
  const ids = new Set(items.map((item) => item.id));
  return sets.flatMap((set) => set.pieceIds.filter((id) => !ids.has(id)));
}

const baseResource = {
  id: "ferraille_rouillee",
  name: "Ferraille rouillée",
  description: "Une plaque qui rouille plus vite qu'elle ne protège.",
  category: "resource" as const,
  sellPrice: 1,
};

const baseConsumable = {
  id: "soupe_de_baleine_tiede",
  name: "Soupe de baleine tiède",
  description: "Chaude à l'aller, tiède au retour, douteuse au fond.",
  category: "consumable" as const,
  heal: 20,
  sellPrice: 5,
};

const baseEquipment = {
  id: "chapeau_piou_mazoute",
  name: "Chapeau de Piou Mazouté",
  description: "Un chapeau qui sent le port et le regret.",
  category: "equipment" as const,
  slot: "hat" as const,
  level: 1,
  stats: { vitality: 5 },
  sellPrice: 10,
};

const baseSet = {
  id: "panoplie_piou_mazoute",
  name: "Panoplie du Piou Mazouté",
  description: "Quatre pièces graisseuses pour un héroïsme glissant.",
  pieceIds: ["chapeau_piou_mazoute", "bottes_de_fond_de_cale"],
  bonuses: [
    { pieces: 2, stats: { vitality: 20 } },
    { pieces: 3, stats: { strength: 10 } },
    { pieces: 4, stats: { ap: 1 } },
  ],
};

describe("items.yaml", () => {
  it("contient les trois familles avec des ids uniques en snake_case", () => {
    const items = loadItems();
    const categories = new Set(items.map((item) => item.category));
    expect(categories).toEqual(new Set(["resource", "consumable", "equipment"]));
    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(SNAKE_CASE));
  });

  it("déclare au moins six ressources, exactement deux consommables et une arme de départ", () => {
    const items = loadItems();
    expect(items.filter((item) => item.category === "resource").length).toBeGreaterThanOrEqual(6);
    expect(items.filter((item) => item.category === "consumable").length).toBe(2);
    const starter = equipmentOf(items).filter((item) => item.slot === "weapon" && item.setId === undefined);
    expect(starter).toHaveLength(1);
    expect(starter[0]?.level).toBe(1);
  });

  it("ne duplique aucun id de monsters.yaml", () => {
    const monsterIds = new Set(loadMonsterIds());
    loadItems().forEach((item) => expect(monsterIds.has(item.id)).toBe(false));
  });

  it("fait pointer chaque setId d'équipement vers une panoplie existante", () => {
    const setIds = new Set(loadSets().map((set) => set.id));
    equipmentOf(loadItems()).forEach((item) => {
      const setId = item.setId;
      if (setId !== undefined) expect(setIds.has(setId), `${setId} absent de sets.yaml`).toBe(true);
    });
  });
});

describe("sets.yaml", () => {
  it("fait pointer chaque pièce de panoplie vers un équipement existant du bon slot", () => {
    const equipment = equipmentOf(loadItems());
    loadSets().forEach((set) => {
      set.pieceIds.forEach((id) => {
        const piece = equipment.find((item) => item.id === id);
        expect(piece, `${id} absent d'items.yaml`).toBeDefined();
        expect(SET_SLOTS).toContain(piece?.slot);
      });
    });
  });

  it("ne laisse aucun pieceId orphelin", () => {
    expect(findOrphanPieceIds(loadSets(), loadItems())).toEqual([]);
  });

  it("définit des paliers 2/3/4 strictement croissants avec des stats non vides", () => {
    const [set] = loadSets();
    if (set === undefined) throw new Error("aucune panoplie dans sets.yaml");
    expect(set.bonuses.map((bonus) => bonus.pieces)).toEqual([2, 3, 4]);
    set.bonuses.forEach((bonus) => expect(Object.keys(bonus.stats).length).toBeGreaterThan(0));
  });
});

describe("rejets Zod", () => {
  it("refuse un id dupliqué dans items.yaml", () => {
    const duplicated = { ...baseResource, description: "Deux fois la même ferraille." };
    expect(() => itemsFileSchema.parse({ items: [baseResource, duplicated] })).toThrow(/dupliqué/);
  });

  it("refuse un slot inconnu", () => {
    const bad = { ...baseEquipment, slot: "casque" };
    expect(() => itemsFileSchema.parse({ items: [bad] })).toThrow(/slot/);
  });

  it("refuse un consommable sans soin", () => {
    const bad = { ...baseConsumable, heal: 0 };
    expect(() => itemsFileSchema.parse({ items: [bad] })).toThrow(/heal/);
  });

  it("refuse des paliers de panoplie non croissants", () => {
    const bonuses = [baseSet.bonuses[0], { pieces: 2, stats: { vitality: 30 } }, baseSet.bonuses[2]];
    expect(() => setsFileSchema.parse({ sets: [{ ...baseSet, bonuses }] })).toThrow(/croissant/);
  });

  it("détecte un pieceId orphelin", () => {
    const orphaned = { ...baseSet, pieceIds: [...baseSet.pieceIds, "piece_fantome"] };
    expect(findOrphanPieceIds([orphaned], loadItems())).toEqual(["piece_fantome"]);
  });
});
