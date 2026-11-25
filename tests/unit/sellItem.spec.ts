import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hero } from "../../src/engine/createHero";
import { sellItem } from "../../src/engine/economy";
import type { SellItemInput, SellItemResult } from "../../src/engine/economy";
import type { InventoryState } from "../../src/engine/inventory";
import type { StorageLike } from "../../src/engine/save";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { useGameStore } from "../../src/store/useGameStore";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");

/** Catalogue réel : le prix de vente vient du YAML, jamais d'un littéral du test. */
const CATALOG = parseItemsYaml(read("items.yaml"));

function catalogItem(itemId: string) {
  const found = CATALOG.find((item) => item.id === itemId);
  if (found === undefined) throw new Error(`${itemId} absent de data/items.yaml`);
  return found;
}

const PRICED_ITEM = catalogItem("plume_mazoutee");
const PRICE = 4;

function stackOf(quantity: number): InventoryState {
  return { stacks: [{ itemId: "sonde", quantity }], equipment: {} };
}

function engineSale(overrides: Partial<SellItemInput> = {}): SellItemInput {
  return {
    inventory: stackOf(5),
    kamas: 100,
    itemId: "sonde",
    price: PRICE,
    quantity: 1,
    ...overrides,
  };
}

/** Refus = identité exacte : mêmes références, aucun kamas, aucune unité vendue. */
function expectRefusal(input: SellItemInput, result: SellItemResult): void {
  expect(result.inventory).toBe(input.inventory);
  expect(result.kamas).toBe(input.kamas);
  expect(result.sold).toBe(0);
  expect(result.earned).toBe(0);
}

function quantityIn(inventory: InventoryState, itemId: string): number {
  return inventory.stacks.find((stack) => stack.itemId === itemId)?.quantity ?? 0;
}

describe("sellItem — montants crédités", () => {
  it("vend une unité : kamas + prix, inventaire − 1", () => {
    const result = sellItem(engineSale());

    expect(result.kamas).toBe(104);
    expect(result.sold).toBe(1);
    expect(result.earned).toBe(PRICE);
    expect(quantityIn(result.inventory, "sonde")).toBe(4);
  });

  it("vend trois unités : kamas + 3 × prix", () => {
    const result = sellItem(engineSale({ quantity: 3 }));

    expect(result.kamas).toBe(100 + 3 * PRICE);
    expect(result.earned).toBe(3 * PRICE);
    expect(quantityIn(result.inventory, "sonde")).toBe(2);
  });

  it("retire la pile entière quand tout le stock est vendu", () => {
    const result = sellItem(engineSale({ quantity: 5 }));

    expect(result.kamas).toBe(100 + 5 * PRICE);
    expect(result.inventory.stacks).toEqual([]);
  });
});

describe("sellItem — refus sans mutation", () => {
  it("refuse un objet absent de l'inventaire", () => {
    const input = engineSale({ itemId: "fantome" });

    expectRefusal(input, sellItem(input));
  });

  it("refuse une quantité supérieure au stock, sans vente partielle", () => {
    const input = engineSale({ quantity: 6 });

    expectRefusal(input, sellItem(input));
  });

  it.each([0, -1, 1.5, Number.NaN])("refuse la quantité invalide %s", (quantity) => {
    const input = engineSale({ quantity });

    expectRefusal(input, sellItem(input));
  });
});

describe("sellItem — prix et bourse", () => {
  it("refuse un objet sans sellPrice (prix inconnu)", () => {
    const input = engineSale({ price: undefined });

    expectRefusal(input, sellItem(input));
  });

  it.each([2.5, -1, Number.NaN])("refuse le prix invalide %s", (price) => {
    const input = engineSale({ price });

    expectRefusal(input, sellItem(input));
  });

  it("refuse un porte-monnaie négatif plutôt que de créditer quand même", () => {
    const input = engineSale({ kamas: -1 });

    expectRefusal(input, sellItem(input));
  });

  it("refuse un total au-delà des entiers sûrs, sans perte silencieuse", () => {
    const input = engineSale({ kamas: Number.MAX_SAFE_INTEGER });

    expectRefusal(input, sellItem(input));
  });
});

describe("sellItem — cas limites documentés", () => {
  it("accepte un sellPrice nul : la donnée fait foi, kamas inchangés", () => {
    const input = engineSale({ price: 0 });
    const result = sellItem(input);

    expect(result.kamas).toBe(input.kamas);
    expect(result.earned).toBe(0);
    expect(result.sold).toBe(1);
    expect(quantityIn(result.inventory, "sonde")).toBe(4);
  });

  it("n'est pas idempotent : le second appel ne trouve plus l'objet", () => {
    const first = sellItem(engineSale({ quantity: 5 }));
    const retry = engineSale({ inventory: first.inventory, kamas: first.kamas, quantity: 5 });
    const second = sellItem(retry);

    expectRefusal(retry, second);
    expect(second.kamas).toBe(100 + 5 * PRICE);
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

const SAVE_KEY = "la-flotte-sell-slot";

function currentHero(): Hero {
  const hero = useGameStore.getState().hero;
  if (hero === null) throw new Error("héros attendu");
  return hero;
}

/** Partie de test : héros créé, bourse et sac imposés, aucune dépendance à l'UI. */
function gameWith(quantity: number, kamas: number): void {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  const hero = currentHero();
  const inventory = { stacks: [{ itemId: PRICED_ITEM.id, quantity }], equipment: {} };
  useGameStore.setState({ hero: { ...hero, kamas }, inventory });
}

function reloadFrom(storage: StorageLike): void {
  vi.stubGlobal("window", { localStorage: storage });
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().loadGame(storage)).toBe(true);
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.setState({ saveKey: SAVE_KEY });
});

describe("sellItem — action du store : vente", () => {
  it("crédite le sellPrice du catalogue et décrémente le sac", () => {
    gameWith(5, 100);
    useGameStore.getState().sellItem({ itemId: PRICED_ITEM.id, quantity: 1 });

    expect(currentHero().kamas).toBe(100 + PRICED_ITEM.sellPrice);
    expect(quantityIn(useGameStore.getState().inventory, PRICED_ITEM.id)).toBe(4);
  });

  it("crédite trois fois le prix pour une vente de trois unités", () => {
    gameWith(5, 100);
    useGameStore.getState().sellItem({ itemId: PRICED_ITEM.id, quantity: 3 });

    expect(currentHero().kamas).toBe(100 + 3 * PRICED_ITEM.sellPrice);
    expect(quantityIn(useGameStore.getState().inventory, PRICED_ITEM.id)).toBe(2);
  });

  it("persiste kamas et inventaire : après rechargement la vente est acquise", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    gameWith(5, 100);
    useGameStore.getState().sellItem({ itemId: PRICED_ITEM.id, quantity: 2 });

    reloadFrom(storage);

    expect(currentHero().kamas).toBe(100 + 2 * PRICED_ITEM.sellPrice);
    expect(quantityIn(useGameStore.getState().inventory, PRICED_ITEM.id)).toBe(3);
  });
});

describe("sellItem — action du store : refus", () => {
  it("rend l'état identique pour un objet absent", () => {
    gameWith(1, 100);
    const before = useGameStore.getState();
    useGameStore.getState().sellItem({ itemId: "fantome", quantity: 1 });

    expect(useGameStore.getState().inventory).toBe(before.inventory);
    expect(currentHero().kamas).toBe(100);
  });

  it.each([0, -1, 1.5])("rend l'état identique pour la quantité %s", (quantity) => {
    gameWith(5, 100);
    const before = useGameStore.getState();
    useGameStore.getState().sellItem({ itemId: PRICED_ITEM.id, quantity });

    expect(useGameStore.getState().inventory).toBe(before.inventory);
    expect(currentHero().kamas).toBe(100);
  });

  it("le catalogue réel est entièrement vendable : sellPrice requis par Zod", () => {
    const priced = CATALOG.every((item) => Number.isInteger(item.sellPrice) && item.sellPrice >= 0);

    expect(priced).toBe(true);
  });

  it("n'écrit rien quand la vente est refusée", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    gameWith(1, 100);
    useGameStore.getState().sellItem({ itemId: PRICED_ITEM.id, quantity: 99 });

    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(currentHero().kamas).toBe(100);
  });
});
