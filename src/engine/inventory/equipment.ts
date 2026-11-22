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

/** Slot résoluble : refusé si l'item n'est pas un équipement. */
function resolveSlot(input: EquipItemInput): EquipmentSlot | undefined {
  if (input.item.category !== "equipment") return undefined;
  return input.slot ?? input.item.slot;
}

/** Slot occupé par `itemId`, quel qu'il soit. */
function wornSlot(equipment: EquipmentState, itemId: string): EquipmentSlot | undefined {
  const entries = Object.entries(equipment) as [EquipmentSlot, string][];
  return entries.find(([, id]) => id === itemId)?.[0];
}

function withoutSlot(equipment: EquipmentState, slot: EquipmentSlot): EquipmentState {
  const next: EquipmentState = { ...equipment };
  delete next[slot];
  return next;
}

/** Libère l'ancien slot si l'item y est déjà porté (déplacement sans duplication). */
function clearOtherSlot(target: EquipTarget): InventoryState {
  const other = wornSlot(target.inventory.equipment, target.item.id);
  if (other === undefined || other === target.slot) return target.inventory;
  return { ...target.inventory, equipment: withoutSlot(target.inventory.equipment, other) };
}

/** L'ancien occupant ne retourne au sac que s'il est différent de l'item équipé. */
function returnsToBag(previous: string | undefined, itemId: string): previous is string {
  return previous !== undefined && previous !== itemId;
}

function withEquipped(target: EquipTarget): InventoryState {
  const equipment = { ...target.inventory.equipment, [target.slot]: target.item.id };
  return { ...target.inventory, equipment };
}

function swapEquipment(target: EquipTarget): InventoryState {
  const cleared = clearOtherSlot(target);
  const previous = cleared.equipment[target.slot];
  const inventory = withEquipped({ ...target, inventory: cleared });
  if (!returnsToBag(previous, target.item.id)) return inventory;
  return addItem({ inventory, itemId: previous, quantity: 1 });
}

/** Une unité sort du sac uniquement si l'item n'est pas déjà porté ailleurs. */
function takeFromBag(inventory: InventoryState, itemId: string): InventoryState {
  if (wornSlot(inventory.equipment, itemId) !== undefined) return inventory;
  return removeItem({ inventory, itemId, quantity: 1 });
}

/** Items réellement équipés, résolus dans le catalogue fourni. */
export function equippedItems(input: EquippedItemsInput): ItemLike[] {
  return Object.values(input.inventory.equipment)
    .filter(isDefined)
    .map((itemId) => input.items.find((item) => item.id === itemId))
    .filter(isDefined);
}

/**
 * Équipe un item dans `slot` (ou `item.slot`) sans jamais le dupliquer :
 * - déjà équipé dans le slot cible : no-op (même référence) ;
 * - déjà porté ailleurs : l'ancien slot est libéré, le sac est préservé ;
 * - slot occupé par un autre item : celui-ci retourne au sac ;
 * - sinon une unité est retirée du sac si elle y est.
 * Refusé si l'item n'est pas un équipement ou si aucun slot n'est résoluble.
 */
export function equipItem(input: EquipItemInput): InventoryState {
  const slot = resolveSlot(input);
  if (slot === undefined) return input.inventory;
  if (input.inventory.equipment[slot] === input.item.id) return input.inventory;
  const inventory = takeFromBag(input.inventory, input.item.id);
  return swapEquipment({ inventory, item: input.item, slot });
}

/** Retire l'item du slot et le remet dans le sac ; no-op si le slot est vide. */
export function unequipItem(input: UnequipItemInput): InventoryState {
  const equipped = input.inventory.equipment[input.slot];
  if (equipped === undefined) return input.inventory;
  const equipment = withoutSlot(input.inventory.equipment, input.slot);
  const stripped: InventoryState = { ...input.inventory, equipment };
  return addItem({ inventory: stripped, itemId: equipped, quantity: 1 });
}
