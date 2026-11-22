import { addItem, equippable } from "../engine/inventory";
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
  heroLevel: number,
): InventoryState {
  const inventory = { stacks: knownStacks(snapshot, items), equipment: knownEquipment(snapshot, items) };
  return legalizeEquipment({ inventory, items, heroLevel });
}

interface EquipmentAudit {
  inventory: InventoryState;
  items: readonly ItemLike[];
  heroLevel: number;
}

function equipmentEntries(inventory: InventoryState): [EquipmentSlot, string][] {
  return Object.entries(inventory.equipment) as [EquipmentSlot, string][];
}

/** Slot chargé jugé par le **même** verdict que l'équipement en jeu. */
function isLegalSlot(audit: EquipmentAudit, [slot, itemId]: [EquipmentSlot, string]): boolean {
  const item = findItem(audit.items, itemId);
  if (item === undefined) return false;
  const options = { inventory: audit.inventory, item, slot, heroLevel: audit.heroLevel };
  return equippable(options).refusal === null;
}

function withoutPieces(
  equipment: EquipmentState,
  illegal: readonly [EquipmentSlot, string][],
): EquipmentState {
  const next: EquipmentState = { ...equipment };
  illegal.forEach(([slot]) => delete next[slot]);
  return next;
}

/**
 * Un chargement ne peut pas produire d'équipement illégal : chaque pièce hors
 * niveau est **rendue au sac** (aucune destruction), les pièces légales restent
 * en place et rien d'autre n'est modifié. Pas de capacité de sac dans le
 * modèle, donc le retour est toujours possible.
 */
function legalizeEquipment(audit: EquipmentAudit): InventoryState {
  const illegal = equipmentEntries(audit.inventory).filter((entry) => !isLegalSlot(audit, entry));
  const equipment = withoutPieces(audit.inventory.equipment, illegal);
  const stripped: InventoryState = { ...audit.inventory, equipment };
  return illegal.reduce((inventory, [, itemId]) => addItem({ inventory, itemId, quantity: 1 }), stripped);
}
