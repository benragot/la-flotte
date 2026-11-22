import { describe, expect, it } from "vitest";
import {
  addItem,
  computeTotalStats,
  countItem,
  equipItem,
  getActiveSetBonuses,
  removeItem,
  unequipItem,
  useConsumable,
} from "../../src/engine/inventory";
import type { InventoryState, ItemLike, SetLike, StatBlock } from "../../src/engine/inventory";

const SET_ID = "panoplie_des_abysses";

const HAT: ItemLike = {
  id: "casque_corail",
  name: "Casque de corail",
  category: "equipment",
  slot: "hat",
  setId: SET_ID,
  stats: { vitality: 10 },
};

const BOOTS: ItemLike = {
  id: "bottes_corail",
  name: "Bottes de corail",
  category: "equipment",
  slot: "boots",
  setId: SET_ID,
  stats: { agility: 15, mp: 1 },
};

const BELT: ItemLike = {
  id: "ceinture_corail",
  name: "Ceinture de corail",
  category: "equipment",
  slot: "belt",
  setId: SET_ID,
  stats: { wisdom: 8 },
};

const AMULET: ItemLike = {
  id: "amulette_corail",
  name: "Amulette de corail",
  category: "equipment",
  slot: "amulet",
  setId: SET_ID,
  stats: { chance: 12 },
};

const WEAPON: ItemLike = {
  id: "sabre_rouille",
  name: "Sabre rouillé",
  category: "equipment",
  slot: "weapon",
  stats: { strength: 20, percentDmg: 3 },
};

const POTION: ItemLike = {
  id: "potion_ecume",
  name: "Potion d'écume",
  category: "consumable",
  heal: 30,
};

const ALGAE: ItemLike = {
  id: "algue_noire",
  name: "Algue noire",
  category: "resource",
};

const SLOTLESS: ItemLike = {
  id: "chapeau_mysterieux",
  name: "Chapeau mystérieux",
  category: "equipment",
};

const ITEMS: readonly ItemLike[] = [HAT, BOOTS, BELT, AMULET, WEAPON, POTION, ALGAE];

const SETS: readonly SetLike[] = [
  {
    id: SET_ID,
    pieceIds: [HAT.id, BOOTS.id, BELT.id, AMULET.id],
    bonuses: [
      { pieces: 2, stats: { vitality: 20 } },
      { pieces: 3, stats: { strength: 10, ap: 1 } },
    ],
  },
];

const BASE: StatBlock = { vitality: 100, strength: 50, hp: 200 };
const CAPITAL: StatBlock = { strength: 20, agility: 5 };

function emptyInventory(): InventoryState {
  return { stacks: [], equipment: {} };
}

function withStacks(...stacks: { itemId: string; quantity: number }[]): InventoryState {
  return { stacks, equipment: {} };
}

function equipped(...slots: [Parameters<typeof unequipItem>[0]["slot"], string][]): InventoryState {
  const inventory = slots.reduce<InventoryState>(
    (current, [slot, itemId]) => ({ ...current, equipment: { ...current.equipment, [slot]: itemId } }),
    emptyInventory(),
  );
  return inventory;
}

describe("addItem", () => {
  it("ajoute une nouvelle pile", () => {
    const result = addItem({ inventory: emptyInventory(), itemId: ALGAE.id, quantity: 3 });
    expect(result.stacks).toEqual([{ itemId: ALGAE.id, quantity: 3 }]);
    expect(result.equipment).toEqual({});
  });

  it("cumule une pile existante", () => {
    const first = addItem({ inventory: emptyInventory(), itemId: ALGAE.id, quantity: 2 });
    const second = addItem({ inventory: first, itemId: ALGAE.id, quantity: 5 });
    expect(second.stacks).toEqual([{ itemId: ALGAE.id, quantity: 7 }]);
  });

  it("refuse une quantité invalide en rendant l'inventaire à l'identique", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 2 });
    expect(addItem({ inventory, itemId: ALGAE.id, quantity: 0 })).toBe(inventory);
    expect(addItem({ inventory, itemId: ALGAE.id, quantity: -4 })).toBe(inventory);
  });

  it("ne mute pas l'inventaire d'entrée", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 2 });
    const snapshot = structuredClone(inventory);
    addItem({ inventory, itemId: POTION.id, quantity: 1 });
    expect(inventory).toEqual(snapshot);
  });
});

describe("countItem", () => {
  it("compte la quantité possédée", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 4 }, { itemId: POTION.id, quantity: 1 });
    expect(countItem(inventory, ALGAE.id)).toBe(4);
    expect(countItem(inventory, POTION.id)).toBe(1);
  });

  it("retourne 0 pour un item absent", () => {
    expect(countItem(emptyInventory(), WEAPON.id)).toBe(0);
  });
});

describe("removeItem", () => {
  it("retire une quantité partielle", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 5 });
    const result = removeItem({ inventory, itemId: ALGAE.id, quantity: 2 });
    expect(result.stacks).toEqual([{ itemId: ALGAE.id, quantity: 3 }]);
  });

  it("supprime la pile quand le stock tombe à zéro", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 2 }, { itemId: POTION.id, quantity: 1 });
    const result = removeItem({ inventory, itemId: ALGAE.id, quantity: 2 });
    expect(result.stacks).toEqual([{ itemId: POTION.id, quantity: 1 }]);
  });

  it("refuse un retrait supérieur au stock en rendant l'inventaire à l'identique", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 2 });
    expect(removeItem({ inventory, itemId: ALGAE.id, quantity: 3 })).toBe(inventory);
    expect(removeItem({ inventory, itemId: WEAPON.id, quantity: 1 })).toBe(inventory);
    expect(removeItem({ inventory, itemId: ALGAE.id, quantity: 0 })).toBe(inventory);
  });

  it("ne mute pas l'inventaire d'entrée", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 5 });
    const snapshot = structuredClone(inventory);
    removeItem({ inventory, itemId: ALGAE.id, quantity: 2 });
    expect(inventory).toEqual(snapshot);
  });
});

describe("equipItem", () => {
  it("équipe un item dans son slot par défaut et le sort du sac", () => {
    const inventory = withStacks({ itemId: HAT.id, quantity: 1 });
    const result = equipItem({ inventory, item: HAT });
    expect(result.equipment).toEqual({ hat: HAT.id });
    expect(result.stacks).toEqual([]);
  });

  it("accepte un slot explicite", () => {
    const inventory = withStacks({ itemId: AMULET.id, quantity: 1 });
    const result = equipItem({ inventory, item: AMULET, slot: "ring1" });
    expect(result.equipment).toEqual({ ring1: AMULET.id });
  });

  it("remplace l'occupant et renvoie l'ancien item dans le sac", () => {
    const inventory: InventoryState = {
      stacks: [{ itemId: BOOTS.id, quantity: 1 }],
      equipment: { hat: HAT.id },
    };
    const result = equipItem({ inventory, item: BOOTS, slot: "hat" });
    expect(result.equipment).toEqual({ hat: BOOTS.id });
    expect(result.stacks).toEqual([{ itemId: HAT.id, quantity: 1 }]);
  });

});

describe("equipItem — refus et immuabilité", () => {
  it("refuse un item non équipement", () => {
    const inventory = withStacks({ itemId: ALGAE.id, quantity: 1 });
    expect(equipItem({ inventory, item: ALGAE, slot: "hat" })).toBe(inventory);
  });

  it("refuse un équipement sans slot", () => {
    const inventory = withStacks({ itemId: SLOTLESS.id, quantity: 1 });
    expect(equipItem({ inventory, item: SLOTLESS })).toBe(inventory);
  });

  it("ne mute pas l'inventaire d'entrée", () => {
    const inventory: InventoryState = {
      stacks: [{ itemId: BOOTS.id, quantity: 1 }],
      equipment: { hat: HAT.id },
    };
    const snapshot = structuredClone(inventory);
    equipItem({ inventory, item: BOOTS, slot: "hat" });
    expect(inventory).toEqual(snapshot);
  });
});

describe("unequipItem", () => {
  it("retire l'item du slot et le remet dans le sac", () => {
    const inventory = equipped(["hat", HAT.id]);
    const result = unequipItem({ inventory, slot: "hat" });
    expect(result.equipment).toEqual({});
    expect(result.stacks).toEqual([{ itemId: HAT.id, quantity: 1 }]);
  });

  it("cumule avec une pile déjà présente", () => {
    const inventory: InventoryState = {
      stacks: [{ itemId: HAT.id, quantity: 2 }],
      equipment: { hat: HAT.id },
    };
    const result = unequipItem({ inventory, slot: "hat" });
    expect(result.stacks).toEqual([{ itemId: HAT.id, quantity: 3 }]);
  });

  it("ne fait rien quand le slot est vide", () => {
    const inventory = equipped(["hat", HAT.id]);
    expect(unequipItem({ inventory, slot: "weapon" })).toBe(inventory);
  });

  it("ne mute pas l'inventaire d'entrée", () => {
    const inventory = equipped(["hat", HAT.id]);
    const snapshot = structuredClone(inventory);
    unequipItem({ inventory, slot: "hat" });
    expect(inventory).toEqual(snapshot);
  });
});

describe("useConsumable", () => {
  it("ne consomme rien à PV plein", () => {
    const inventory = withStacks({ itemId: POTION.id, quantity: 2 });
    const result = useConsumable({ inventory, item: POTION, currentHp: 100, maxHp: 100 });
    expect(result).toEqual({ inventory, healed: 0, hp: 100 });
    expect(result.inventory).toBe(inventory);
  });

  it("borne le soin au maximum de PV", () => {
    const inventory = withStacks({ itemId: POTION.id, quantity: 1 });
    const result = useConsumable({ inventory, item: POTION, currentHp: 85, maxHp: 100 });
    expect(result.healed).toBe(15);
    expect(result.hp).toBe(100);
    expect(countItem(result.inventory, POTION.id)).toBe(0);
  });

  it("soigne complètement quand la marge est suffisante", () => {
    const inventory = withStacks({ itemId: POTION.id, quantity: 2 });
    const result = useConsumable({ inventory, item: POTION, currentHp: 40, maxHp: 100 });
    expect(result.healed).toBe(30);
    expect(result.hp).toBe(70);
    expect(countItem(result.inventory, POTION.id)).toBe(1);
  });

  it("ne consomme rien sans potion en sac", () => {
    const inventory = emptyInventory();
    const result = useConsumable({ inventory, item: POTION, currentHp: 10, maxHp: 100 });
    expect(result).toEqual({ inventory, healed: 0, hp: 10 });
  });

  it("ne mute pas l'inventaire d'entrée", () => {
    const inventory = withStacks({ itemId: POTION.id, quantity: 2 });
    const snapshot = structuredClone(inventory);
    useConsumable({ inventory, item: POTION, currentHp: 10, maxHp: 100 });
    expect(inventory).toEqual(snapshot);
  });
});

describe("getActiveSetBonuses", () => {
  it("ne retourne rien sans pièce équipée", () => {
    const result = getActiveSetBonuses({ inventory: emptyInventory(), items: ITEMS, sets: SETS });
    expect(result).toEqual([]);
  });

  it("ignore les pièces possédées mais non équipées", () => {
    const inventory = withStacks({ itemId: HAT.id, quantity: 1 }, { itemId: BOOTS.id, quantity: 1 });
    const result = getActiveSetBonuses({ inventory, items: ITEMS, sets: SETS });
    expect(result).toEqual([]);
  });
});

describe("getActiveSetBonuses — paliers", () => {
  it("n'accorde aucun bonus avec une seule pièce équipée", () => {
    const inventory = equipped(["hat", HAT.id]);
    const result = getActiveSetBonuses({ inventory, items: ITEMS, sets: SETS });
    expect(result).toEqual([]);
  });

  it("accorde le palier 2 avec deux pièces équipées", () => {
    const inventory = equipped(["hat", HAT.id], ["boots", BOOTS.id]);
    const result = getActiveSetBonuses({ inventory, items: ITEMS, sets: SETS });
    expect(result).toEqual([{ setId: SET_ID, activePieces: 2, bonuses: [{ vitality: 20 }] }]);
  });

  it("accorde tous les paliers atteints avec quatre pièces équipées", () => {
    const inventory = equipped(
      ["hat", HAT.id],
      ["boots", BOOTS.id],
      ["belt", BELT.id],
      ["amulet", AMULET.id],
    );
    const result = getActiveSetBonuses({ inventory, items: ITEMS, sets: SETS });
    expect(result).toEqual([
      {
        setId: SET_ID,
        activePieces: 4,
        bonuses: [{ vitality: 20 }, { strength: 10, ap: 1 }],
      },
    ]);
  });

  it("ignore les pièces équipées inconnues de la liste d'items", () => {
    const inventory = equipped(["hat", "item_inconnu"]);
    const result = getActiveSetBonuses({ inventory, items: ITEMS, sets: SETS });
    expect(result).toEqual([]);
  });
});

describe("computeTotalStats", () => {
  it("retourne les stats de base avec toutes les clés présentes", () => {
    const total = computeTotalStats({
      base: BASE,
      capital: {},
      items: ITEMS,
      sets: SETS,
      inventory: emptyInventory(),
    });
    expect(total).toEqual({
      vitality: 100,
      wisdom: 0,
      strength: 50,
      intelligence: 0,
      chance: 0,
      agility: 0,
      hp: 200,
      ap: 0,
      mp: 0,
      percentDmg: 0,
      flatRes: 0,
      percentRes: 0,
      prospection: 0,
    });
  });
});

describe("computeTotalStats — capital", () => {
  it("ajoute le capital investi", () => {
    const total = computeTotalStats({
      base: BASE,
      capital: CAPITAL,
      items: ITEMS,
      sets: SETS,
      inventory: emptyInventory(),
    });
    expect(total.strength).toBe(70);
    expect(total.agility).toBe(5);
    expect(total.vitality).toBe(100);
  });
});

describe("computeTotalStats — équipement et panoplies", () => {
  it("ajoute les stats des items équipés et les bonus de panoplie", () => {
    const inventory: InventoryState = {
      stacks: [],
      equipment: { hat: HAT.id, boots: BOOTS.id, weapon: WEAPON.id },
    };
    const total = computeTotalStats({ base: BASE, capital: CAPITAL, items: ITEMS, sets: SETS, inventory });
    expect(total.vitality).toBe(130);
    expect(total.strength).toBe(90);
    expect(total.agility).toBe(20);
    expect(total.mp).toBe(1);
    expect(total.percentDmg).toBe(3);
    expect(total.hp).toBe(200);
    expect(total.prospection).toBe(0);
  });
});

describe("computeTotalStats — commutativité et immuabilité", () => {
  it("est commutative sur l'ordre des items et de base/capital", () => {
    const inventory: InventoryState = {
      stacks: [],
      equipment: { hat: HAT.id, boots: BOOTS.id, weapon: WEAPON.id },
    };
    const forward = computeTotalStats({
      base: BASE,
      capital: CAPITAL,
      items: ITEMS,
      sets: SETS,
      inventory,
    });
    const reversed = computeTotalStats({
      base: CAPITAL,
      capital: BASE,
      items: [...ITEMS].reverse(),
      sets: SETS,
      inventory,
    });
    expect(reversed).toEqual(forward);
  });

  it("ne mute ni l'inventaire ni les stats d'entrée", () => {
    const inventory: InventoryState = {
      stacks: [],
      equipment: { hat: HAT.id, boots: BOOTS.id },
    };
    const snapshot = { inventory: structuredClone(inventory), base: structuredClone(BASE) };
    computeTotalStats({ base: BASE, capital: CAPITAL, items: ITEMS, sets: SETS, inventory });
    expect(inventory).toEqual(snapshot.inventory);
    expect(BASE).toEqual(snapshot.base);
  });
});
