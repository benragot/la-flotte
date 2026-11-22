import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { addItem, countItem, equipItem, equippable } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import type { CharacterSnapshot, SaveData, StorageLike } from "../../src/engine/save";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import type { EquipmentDef, ItemDef } from "../../src/schemas/itemSchema";
import { useGameStore } from "../../src/store/useGameStore";
import { BagRow } from "../../src/ui/components/inventory/BackpackList";
import { bagEquipHints, equipRefusalLabel } from "../../src/ui/inventoryHudHelpers";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");

/** Catalogue réel : les niveaux des exigences viennent du YAML, jamais d'un littéral. */
const ITEMS = parseItemsYaml(read("items.yaml"));

function catalogItem(itemId: string): ItemDef {
  const found = ITEMS.find((item) => item.id === itemId);
  if (found === undefined) throw new Error(`${itemId} absent de data/items.yaml`);
  return found;
}

function emptyBag(): InventoryState {
  return { stacks: [], equipment: {} };
}

function bagWith(...itemIds: readonly string[]): InventoryState {
  const options = (inventory: InventoryState, itemId: string) => ({ inventory, itemId, quantity: 1 });
  return itemIds.reduce<InventoryState>((inventory, itemId) => addItem(options(inventory, itemId)), emptyBag());
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

describe("inventaire — refus visible dans le sac", () => {
  const LEVEL_18_NAME = "Casque de chantier cabossé";

  it("affiche « Niveau 18 requis » et désactive l'action", () => {
    const hints = bagEquipHints({ inventory: bagWith(LEVEL_18_HAT), items: ITEMS, heroLevel: 1 });
    expect(hints[LEVEL_18_HAT]).toBe("Niveau 18 requis");
    const entry = { itemId: LEVEL_18_HAT, name: LEVEL_18_NAME, quantity: 1, category: "equipment" as const };
    const props = { entry, selected: false, onSelect: () => undefined, hint: hints[LEVEL_18_HAT] ?? null };
    const html = renderToStaticMarkup(createElement(BagRow, props));
    expect(html).toContain("Niveau 18 requis");
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-describedby="equip-hint-fer_casque_chantier_cabosse"');
  });

  it("laisse l'action active et sans badge pour un objet équipable", () => {
    const hints = bagEquipHints({ inventory: bagWith(LEVEL_1_HAT), items: ITEMS, heroLevel: 1 });
    expect(hints[LEVEL_1_HAT]).toBeUndefined();
    const entry = { itemId: LEVEL_1_HAT, name: "Chapeau piou mazouté", quantity: 1, category: "equipment" as const };
    const html = renderToStaticMarkup(createElement(BagRow, { entry, selected: false, onSelect: () => undefined }));
    expect(html).toContain("Équiper");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain("aria-describedby");
  });
});

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

/** Sauvegarde exportée par le store puis éditée à la main : le cas de l'attaque. */
function editedSave(edit: (save: SaveData) => void): string {
  const raw = useGameStore.getState().exportJson();
  if (raw === null) throw new Error("sauvegarde attendue pour un héros créé");
  const save = JSON.parse(raw) as SaveData;
  edit(save);
  return JSON.stringify(save);
}

/** Le personnage actif du v2 : l'inventaire vit désormais sous le roster. */
function activeCharacter(save: SaveData): CharacterSnapshot {
  const [character] = save.characters;
  if (character === undefined) throw new Error("personnage actif attendu");
  return character;
}

function equipHighLevelHat(): string {
  return editedSave((save) => {
    activeCharacter(save).inventory.equipment = { hat: LEVEL_18_HAT };
  });
}

describe("chargement — re-validation de l'équipement", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  });

  it("déséquipe une pièce de niveau 18 et la rend au sac, sans rien détruire", () => {
    expect(useGameStore.getState().importJson(equipHighLevelHat())).toBe(true);
    const { inventory } = useGameStore.getState();
    expect(inventory.equipment.hat).toBeUndefined();
    expect(countItem(inventory, LEVEL_18_HAT)).toBe(1);
  });

  it("ne touche ni aux PV, ni à l'XP, ni aux kamas, ni aux autres objets", () => {
    const { hero, inventory } = useGameStore.getState();
    expect(useGameStore.getState().importJson(equipHighLevelHat())).toBe(true);
    const after = useGameStore.getState();
    expect(after.hero).toEqual(hero);
    const others = after.inventory.stacks.filter((stack) => stack.itemId !== LEVEL_18_HAT);
    expect(others).toEqual(inventory.stacks);
  });

  it("conserve un équipement légal tel quel", () => {
    const raw = editedSave((save) => {
      activeCharacter(save).inventory.equipment = { hat: LEVEL_1_HAT, weapon: "gourdin_du_matelot" };
    });
    expect(useGameStore.getState().importJson(raw)).toBe(true);
    const equipment = useGameStore.getState().inventory.equipment;
    expect(equipment).toEqual({ hat: LEVEL_1_HAT, weapon: "gourdin_du_matelot" });
  });

  it("applique la même règle via loadGame : un seul chemin d'application", () => {
    const storage = new MemoryStorage();
    storage.setItem(useGameStore.getState().saveKey, equipHighLevelHat());
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(useGameStore.getState().inventory.equipment.hat).toBeUndefined();
    expect(countItem(useGameStore.getState().inventory, LEVEL_18_HAT)).toBe(1);
  });
});
