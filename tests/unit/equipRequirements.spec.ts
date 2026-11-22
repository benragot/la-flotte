import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { addItem, countItem, equipItem, equippable } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import type { EquipmentDef, ItemDef } from "../../src/schemas/itemSchema";
import { useGameStore } from "../../src/store/useGameStore";
import { equipRefusalLabel } from "../../src/ui/inventoryHudHelpers";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");

/** Catalogue réel : les niveaux des exigences viennent du YAML, jamais d'un littéral. */
const ITEMS = parseItemsYaml(read("items.yaml"));

function catalogItem(itemId: string): ItemDef {
  const found = ITEMS.find((item) => item.id === itemId);
  if (found === undefined) throw new Error(`${itemId} absent de data/items.yaml`);
  return found;
}

function bagWith(...itemIds: readonly string[]): InventoryState {
  return itemIds.reduce(
    (inventory, itemId) => addItem({ inventory, itemId, quantity: 1 }),
    { stacks: [], equipment: {} },
  );
}

const LEVEL_18_HAT = "fer_casque_chantier_cabosse";
const LEVEL_17_WEAPON = "fer_pelle_a_gravats";
const LEVEL_1_HAT = "chapeau_piou_mazoute";

describe("equipItem — exigence de niveau", () => {
  it("refuse un objet de niveau 18 à un héros de niveau 1, sans muter l'inventaire", () => {
    const item = catalogItem(LEVEL_18_HAT);
    const inventory = bagWith(item.id);
    expect(equipItem({ inventory, item, heroLevel: 1 })).toBe(inventory);
  });

  it("accepte la borne inclusive : objet niveau 1 sur héros niveau 1", () => {
    const item = catalogItem(LEVEL_1_HAT);
    const inventory = bagWith(item.id);
    const result = equipItem({ inventory, item, heroLevel: 1 });
    expect(result.equipment.hat).toBe(item.id);
    expect(countItem(result, item.id)).toBe(0);
  });

  it("refuse une arme de niveau 17 à un héros de niveau 16 et l'accepte au niveau 17", () => {
    const item = catalogItem(LEVEL_17_WEAPON);
    const inventory = bagWith(item.id);
    expect(item.category === "equipment" ? item.level : 0).toBe(17);
    expect(equipItem({ inventory, item, heroLevel: 16 })).toBe(inventory);
    expect(equipItem({ inventory, item, heroLevel: 17 }).equipment.weapon).toBe(item.id);
  });
});

describe("equipItem — exigence de possession", () => {
  it("refuse un id valide du catalogue absent du sac, sans créer l'objet", () => {
    const item = catalogItem(LEVEL_18_HAT);
    const inventory: InventoryState = { stacks: [], equipment: {} };
    const result = equipItem({ inventory, item, heroLevel: 18 });
    expect(result).toBe(inventory);
    expect(result.equipment).toEqual({});
    expect(countItem(result, item.id)).toBe(0);
  });

  it("laisse un item déjà porté changer de slot (il est possédé par l'équipement)", () => {
    const item = catalogItem("fer_anneau_mazoute");
    const inventory: InventoryState = { stacks: [], equipment: { ring1: item.id } };
    const result = equipItem({ inventory, item, slot: "ring2", heroLevel: 7 });
    expect(result.equipment).toEqual({ ring2: item.id });
  });
});

describe("equippable — raison du refus", () => {
  it("nomme le niveau manquant avec la valeur exigée", () => {
    const item = catalogItem(LEVEL_18_HAT);
    const verdict = equippable({ inventory: bagWith(item.id), item, heroLevel: 1 });
    expect(verdict).toEqual({ slot: "hat", refusal: "level", requiredLevel: 18 });
    expect(equipRefusalLabel(verdict)).toBe("Niveau 18 requis");
  });

  it("nomme l'absence du sac", () => {
    const item = catalogItem(LEVEL_17_WEAPON);
    const verdict = equippable({ inventory: bagWith(), item, heroLevel: 17 });
    expect(verdict).toEqual({ slot: "weapon", refusal: "missing", requiredLevel: null });
    expect(equipRefusalLabel(verdict)).toBe("Objet absent du sac");
  });

  it("ne produit aucun libellé quand l'objet est équipable", () => {
    const item = catalogItem(LEVEL_1_HAT);
    const verdict = equippable({ inventory: bagWith(item.id), item, heroLevel: 1 });
    expect(verdict.refusal).toBeNull();
    expect(equipRefusalLabel(verdict)).toBeNull();
  });
});

describe("kit de départ — non-régression", () => {
  function isStartingEquipment(item: ItemDef): item is EquipmentDef {
    return item.category === "equipment" && item.starting;
  }

  it("garde les deux pièces du kit équipables par un héros de niveau 1", () => {
    const starting = ITEMS.filter(isStartingEquipment);
    expect(starting).toHaveLength(2);
    starting.forEach((item) => {
      expect(item.level, item.id).toBeLessThanOrEqual(1);
      const result = equipItem({ inventory: bagWith(item.id), item, heroLevel: 1 });
      expect(result.equipment[item.slot], item.id).toBe(item.id);
    });
  });

  it("laisse l'outillage hors partie (sans heroLevel) reconstruire un kit sans sac", () => {
    const item = catalogItem(LEVEL_1_HAT);
    expect(equipItem({ inventory: bagWith(), item }).equipment.hat).toBe(item.id);
  });
});

describe("useGameStore.equip — garde de partie", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  });

  it("ne crée pas un objet absent du sac", () => {
    const before = useGameStore.getState().inventory;
    useGameStore.getState().equip({ itemId: LEVEL_18_HAT });
    const after = useGameStore.getState().inventory;
    expect(after).toBe(before);
    expect(countItem(after, LEVEL_18_HAT)).toBe(0);
  });

  it("refuse un objet de niveau 18 au héros de niveau 1", () => {
    const options = { inventory: useGameStore.getState().inventory, itemId: LEVEL_18_HAT, quantity: 1 };
    useGameStore.setState({ inventory: addItem(options) });
    const before = useGameStore.getState().inventory;
    useGameStore.getState().equip({ itemId: LEVEL_18_HAT });
    expect(useGameStore.getState().inventory).toBe(before);
    expect(useGameStore.getState().hero?.level).toBe(1);
  });
});
