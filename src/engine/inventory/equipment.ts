import { isDefined } from "./guards";
import { addItem, removeItem } from "./stack";
import type {
  EquipmentSlot,
  EquipmentState,
  EquippedItemsInput,
  EquipItemInput,
  InventoryState,
  ItemLike,
  UnequipItemInput,
} from "./types";

interface EquipTarget {
  inventory: InventoryState;
  item: ItemLike;
  slot: EquipmentSlot;
}

function withoutSlot(equipment: EquipmentState, slot: EquipmentSlot): EquipmentState {
  const next: EquipmentState = { ...equipment };
  delete next[slot];
  return next;
}

function withEquipped(target: EquipTarget): InventoryState {
  const equipment = { ...target.inventory.equipment, [target.slot]: target.item.id };
  return { ...target.inventory, equipment };
}

/** Écrit le slot puis renvoie l'ancien occupant dans le sac, s'il y en avait un. */
function swapEquipment(target: EquipTarget): InventoryState {
  const inventory = withEquipped(target);
  const previous = target.inventory.equipment[target.slot];
  if (previous === undefined) return inventory;
  return addItem({ inventory, itemId: previous, quantity: 1 });
}

/** Items réellement équipés, résolus dans le catalogue fourni. */
export function equippedItems(input: EquippedItemsInput): ItemLike[] {
  return Object.values(input.inventory.equipment)
    .filter(isDefined)
    .map((itemId) => input.items.find((item) => item.id === itemId))
    .filter(isDefined);
}

/**
 * Équipe un item dans `slot` (ou `item.slot`). Une unité est retirée du sac si
 * elle y est, l'ancien occupant y retourne. Refusé si l'item n'est pas un
 * équipement ou si aucun slot n'est résoluble.
 */
export function equipItem(input: EquipItemInput): InventoryState {
  const slot = input.slot ?? input.item.slot;
  if (input.item.category !== "equipment" || slot === undefined) return input.inventory;
  const stripped = removeItem({ inventory: input.inventory, itemId: input.item.id, quantity: 1 });
  return swapEquipment({ inventory: stripped, item: input.item, slot });
}

/** Retire l'item du slot et le remet dans le sac ; no-op si le slot est vide. */
export function unequipItem(input: UnequipItemInput): InventoryState {
  const equipped = input.inventory.equipment[input.slot];
  if (equipped === undefined) return input.inventory;
  const equipment = withoutSlot(input.inventory.equipment, input.slot);
  const stripped: InventoryState = { ...input.inventory, equipment };
  return addItem({ inventory: stripped, itemId: equipped, quantity: 1 });
}
