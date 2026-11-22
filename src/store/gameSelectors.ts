import { addItem } from "../engine/inventory";
import type { EquipmentSlot, EquipmentState, InventoryState, ItemLike } from "../engine/inventory";
import type { InventorySnapshot } from "../engine/save";
import { EQUIPMENT_SLOTS } from "../schemas/itemSchema";

export interface CreditDropsInput {
  inventory: InventoryState;
  drops: readonly string[];
  items: readonly ItemLike[];
}

export function emptyInventory(): InventoryState {
  return { stacks: [], equipment: {} };
}

export function findItem(items: readonly ItemLike[], itemId: string): ItemLike | undefined {
  return items.find((item) => item.id === itemId);
}

function isKnownItem(items: readonly ItemLike[], itemId: string): boolean {
  return findItem(items, itemId) !== undefined;
}

/** Crédite un butin par unité ; les ids absents du catalogue sont ignorés. */
export function creditDrops(input: CreditDropsInput): InventoryState {
  const known = input.drops.filter((itemId) => isKnownItem(input.items, itemId));
  return known.reduce((inventory, itemId) => addItem({ inventory, itemId, quantity: 1 }), input.inventory);
}

export function toInventorySnapshot(inventory: InventoryState): InventorySnapshot {
  const stacks = inventory.stacks.map(({ itemId, quantity }) => ({ itemId, quantity }));
  return { stacks, equipment: { ...inventory.equipment } };
}

/** Tuple canonique du schéma : un slot ajouté côté schéma est accepté ici. */
function isEquipmentSlot(value: string): value is EquipmentSlot {
  return (EQUIPMENT_SLOTS as readonly string[]).includes(value);
}

function knownStacks(snapshot: InventorySnapshot, items: readonly ItemLike[]) {
  return snapshot.stacks.filter((stack) => isKnownItem(items, stack.itemId));
}

function knownEquipment(snapshot: InventorySnapshot, items: readonly ItemLike[]): EquipmentState {
  const entries = Object.entries(snapshot.equipment);
  const kept = entries.filter(([slot, itemId]) => isEquipmentSlot(slot) && isKnownItem(items, itemId));
  return Object.fromEntries(kept);
}

/** Reconstruit le sac ; tout id d'item ou slot inconnu est écarté. */
export function inventoryFromSnapshot(
  snapshot: InventorySnapshot,
  items: readonly ItemLike[],
): InventoryState {
  return { stacks: knownStacks(snapshot, items), equipment: knownEquipment(snapshot, items) };
}
