import { describe, expect, it } from "vitest";
import type {
  EquipmentState,
  InventoryState,
  ItemLike,
  ItemStack,
  SetLike,
} from "../../src/engine/inventory";
import { EQUIPMENT_SLOTS } from "../../src/schemas/itemSchema";
import {
  type SetView,
  backpackItems,
  buildSetViews,
  buildSlotViews,
  buildStatLines,
  canUseConsumable,
  formatStatValue,
  invokableConsumables,
} from "../../src/ui/inventoryHudHelpers";

/** Panoplie de test : 4 pièces, paliers à 2 puis 4 (2 paliers minimum exigés). */
const SET_ID = "panoplie_de_la_cale";

const HAT: ItemLike = {
  id: "chapeau_de_cale",
  name: "Chapeau de cale",
  category: "equipment",
  slot: "hat",
  setId: SET_ID,
  stats: { vitality: 5 },
};

const CLOAK: ItemLike = {
  id: "cape_de_cale",
  name: "Cape de cale",
  category: "equipment",
  slot: "cloak",
  setId: SET_ID,
  stats: { wisdom: 2 },
};

const AMULET: ItemLike = {
  id: "amulette_de_cale",
  name: "Amulette de cale",
  category: "equipment",
  slot: "amulet",
  setId: SET_ID,
  stats: { prospection: 4 },
};

const BOOTS: ItemLike = {
  id: "bottes_de_cale",
  name: "Bottes de cale",
  category: "equipment",
  slot: "boots",
  setId: SET_ID,
  stats: { agility: 3 },
};

const WEAPON: ItemLike = {
  id: "gourdin_de_test",
  name: "Gourdin de test",
  category: "equipment",
  slot: "weapon",
  stats: { strength: 3 },
};

const SOUP: ItemLike = {
  id: "soupe_de_test",
  name: "Soupe de test",
  category: "consumable",
  heal: 30,
};

const SCRAP: ItemLike = {
  id: "ferraille_de_test",
  name: "Ferraille de test",
  category: "resource",
};

const ITEMS: readonly ItemLike[] = [HAT, CLOAK, AMULET, BOOTS, WEAPON, SOUP, SCRAP];

const SET: SetLike = {
  id: SET_ID,
  pieceIds: [HAT.id, CLOAK.id, AMULET.id, BOOTS.id],
  bonuses: [
    { pieces: 2, stats: { vitality: 20 } },
    { pieces: 4, stats: { ap: 1, prospection: 10 } },
  ],
};

const INJURED = { hp: 20, maxHp: 60 };
const FULL = { hp: 60, maxHp: 60 };

function inventoryWith(input: { stacks?: ItemStack[]; equipment?: EquipmentState }): InventoryState {
  return { stacks: input.stacks ?? [], equipment: input.equipment ?? {} };
}

function stack(itemId: string, quantity: number): ItemStack {
  return { itemId, quantity };
}

function viewsFor(equipment: EquipmentState) {
  const inventory = inventoryWith({ equipment });
  return buildSetViews({ inventory, items: ITEMS, sets: [SET] });
}

describe("buildSlotViews", () => {
  it("retourne les huit slots dans l'ordre canonique du schéma", () => {
    const views = buildSlotViews({ inventory: inventoryWith({}), items: ITEMS });
    expect(views).toHaveLength(8);
    expect(views.map((view) => view.slot)).toEqual([...EQUIPMENT_SLOTS]);
  });

  it("laisse nom et panoplie vides quand aucun item n'est équipé", () => {
    const views = buildSlotViews({ inventory: inventoryWith({}), items: ITEMS });
    expect(views.every((view) => view.itemName === null)).toBe(true);
    expect(views.every((view) => view.setId === null)).toBe(true);
  });

  it("résout le nom et la panoplie de l'item équipé", () => {
    const inventory = inventoryWith({ equipment: { hat: HAT.id, weapon: WEAPON.id } });
    const views = buildSlotViews({ inventory, items: ITEMS });
    expect(views[0]).toMatchObject({ slot: "hat", itemName: "Chapeau de cale", setId: SET_ID });
    expect(views[2]).toMatchObject({ slot: "weapon", itemName: "Gourdin de test", setId: null });
  });

  it("libelle les slots en français", () => {
    const views = buildSlotViews({ inventory: inventoryWith({}), items: ITEMS });
    expect(views[0]?.label).toBe("Chapeau");
    expect(views[6]?.label).toBe("Ceinture");
  });

  it("ignore un slot qui référence un item inconnu du catalogue", () => {
    const inventory = inventoryWith({ equipment: { hat: "item_fantome" } });
    const views = buildSlotViews({ inventory, items: ITEMS });
    expect(views[0]?.itemName).toBeNull();
  });
});

function expectSetView(equipment: EquipmentState, expected: Partial<SetView>): void {
  expect(viewsFor(equipment)[0]).toMatchObject(expected);
}

describe("buildSetViews", () => {
  it("omet une panoplie dont aucune pièce n'est possédée", () => {
    const inventory = inventoryWith({ stacks: [stack(SCRAP.id, 2)] });
    expect(buildSetViews({ inventory, items: ITEMS, sets: [SET] })).toEqual([]);
  });

  it("affiche une panoplie possédée sans palier atteint", () => {
    expectSetView({ hat: HAT.id }, { setId: SET_ID, setName: SET_ID, pieces: 1, totalPieces: 4, activePieces: [], nextTier: 2 });
  });

  it("compte les pièces équipées même si le reste traîne dans le sac", () => {
    const inventory = inventoryWith({ stacks: [stack(CLOAK.id, 1)], equipment: { hat: HAT.id } });
    const views = buildSetViews({ inventory, items: ITEMS, sets: [SET] });
    expect(views[0]).toMatchObject({ pieces: 1, activePieces: [], nextTier: 2 });
  });

  it("active le premier palier à deux pièces équipées", () => {
    expectSetView({ hat: HAT.id, cloak: CLOAK.id }, { pieces: 2, activePieces: [2], nextTier: 4 });
  });

  it("active les deux paliers quand la panoplie est complète", () => {
    const equipment = { hat: HAT.id, cloak: CLOAK.id, amulet: AMULET.id, boots: BOOTS.id };
    expectSetView(equipment, { pieces: 4, activePieces: [2, 4], nextTier: null });
  });

  it("expose le nom de la panoplie quand le catalogue le fournit", () => {
    const inventory = inventoryWith({ equipment: { hat: HAT.id } });
    const named = { ...SET, name: "Panoplie de la cale" };
    const views = buildSetViews({ inventory, items: ITEMS, sets: [named] });
    expect(views[0]?.setName).toBe("Panoplie de la cale");
  });
});

describe("buildStatLines", () => {
  it("produit les treize clés de StatBlock", () => {
    expect(buildStatLines({})).toHaveLength(13);
  });

  it("place les valeurs non nulles devant les zéros", () => {
    const lines = buildStatLines({ strength: 12, prospection: 5 });
    expect(lines.slice(0, 2).map((line) => line.key)).toEqual(["strength", "prospection"]);
    expect(lines.slice(2).every((line) => line.value === 0)).toBe(true);
  });

  it("libelle les statistiques en français", () => {
    const lines = buildStatLines({});
    expect(lines.find((line) => line.key === "vitality")?.label).toBe("Vitalité");
    expect(lines.find((line) => line.key === "strength")?.label).toBe("Force");
    expect(lines.every((line) => line.label.length > 0)).toBe(true);
  });

  it("conserve les valeurs négatives", () => {
    const lines = buildStatLines({ agility: -3 });
    expect(lines[0]).toMatchObject({ key: "agility", value: -3 });
  });
});

describe("invokableConsumables", () => {
  it("retourne les consommables possédés", () => {
    const inventory = inventoryWith({ stacks: [stack(SOUP.id, 2), stack(SCRAP.id, 4)] });
    const items = invokableConsumables({ inventory, items: ITEMS });
    expect(items.map((item) => item.id)).toEqual([SOUP.id]);
  });

  it("ignore un consommable absent du sac", () => {
    const inventory = inventoryWith({ stacks: [stack(SCRAP.id, 1)] });
    expect(invokableConsumables({ inventory, items: ITEMS })).toEqual([]);
  });

  it("ignore une pile à quantité nulle", () => {
    const inventory = inventoryWith({ stacks: [stack(SOUP.id, 0)] });
    expect(invokableConsumables({ inventory, items: ITEMS })).toEqual([]);
  });
});

describe("canUseConsumable", () => {
  it("refuse un soin quand les PV sont pleins", () => {
    expect(canUseConsumable({ item: SOUP, hero: FULL })).toBe(false);
  });

  it("autorise un soin quand le héros est blessé", () => {
    expect(canUseConsumable({ item: SOUP, hero: INJURED })).toBe(true);
  });

  it("refuse un item sans soin", () => {
    expect(canUseConsumable({ item: { ...SOUP, heal: 0 }, hero: INJURED })).toBe(false);
  });

  it("refuse quand aucun héros n'existe", () => {
    expect(canUseConsumable({ item: SOUP, hero: null })).toBe(false);
  });
});

describe("backpackItems", () => {
  const EXPECTED = [
    { itemId: SOUP.id, name: "Soupe de test", quantity: 2, category: "consumable" },
    { itemId: SCRAP.id, name: "Ferraille de test", quantity: 3, category: "resource" },
  ];

  it("liste les piles possédées avec nom, quantité et catégorie", () => {
    const inventory = inventoryWith({ stacks: [stack(SOUP.id, 2), stack(SCRAP.id, 3)] });
    expect(backpackItems({ inventory, items: ITEMS })).toEqual(EXPECTED);
  });

  it("ignore les piles vides et les items inconnus", () => {
    const stacks = [stack(SOUP.id, 0), stack("item_fantome", 4)];
    const inventory = inventoryWith({ stacks });
    expect(backpackItems({ inventory, items: ITEMS })).toEqual([]);
  });

  it("retourne un sac vide sans pile", () => {
    expect(backpackItems({ inventory: inventoryWith({}), items: ITEMS })).toEqual([]);
  });
});

describe("formatStatValue", () => {
  it("préfixe les valeurs positives et négatives", () => {
    expect(formatStatValue(12)).toBe("+12");
    expect(formatStatValue(-5)).toBe("-5");
  });

  it("affiche zéro sans signe", () => {
    expect(formatStatValue(0)).toBe("0");
  });
});
