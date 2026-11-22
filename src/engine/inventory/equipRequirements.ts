import { countItem } from "./stack";
import type {
  EquipmentSlot,
  EquipmentState,
  EquipVerdictInput,
  InventoryState,
  ItemLike,
} from "./types";

/** Raison typée d'un refus : l'interface en dérive un texte lisible. */
export type EquipRefusal = "notEquipment" | "noSlot" | "level" | "missing";

/** Verdict d'équipement : slot résolu, refus éventuel, niveau exigé si refus de niveau. */
export interface EquipVerdict {
  slot: EquipmentSlot | null;
  refusal: EquipRefusal | null;
  requiredLevel: number | null;
}

/** Slot occupé par `itemId`, quel qu'il soit. */
export function wornSlot(equipment: EquipmentState, itemId: string): EquipmentSlot | undefined {
  const entries = Object.entries(equipment) as [EquipmentSlot, string][];
  return entries.find(([, id]) => id === itemId)?.[0];
}

/** Slot résoluble : explicite d'abord, puis `item.slot` ; `null` si non équipement. */
export function slotOf(item: ItemLike, slot: EquipmentSlot | undefined): EquipmentSlot | null {
  if (item.category !== "equipment") return null;
  return slot ?? item.slot ?? null;
}

/** Niveau exigé : 1 quand l'objet n'en déclare pas (catalogue partiel de test). */
export function itemLevel(item: ItemLike): number {
  return item.level ?? 1;
}

/** Possédé = une unité dans le sac ou l'objet déjà porté (déplacement de slot). */
function isPossessed(inventory: InventoryState, itemId: string): boolean {
  if (countItem(inventory, itemId) > 0) return true;
  return wornSlot(inventory.equipment, itemId) !== undefined;
}

/** Gardes de héros : désarmées sans `heroLevel`, sinon possession puis niveau. */
function heroRefusal(input: EquipVerdictInput): EquipRefusal | null {
  if (input.heroLevel === undefined) return null;
  if (!isPossessed(input.inventory, input.item.id)) return "missing";
  return itemLevel(input.item) > input.heroLevel ? "level" : null;
}

function shapeRefusal(input: EquipVerdictInput): EquipRefusal | null {
  if (input.item.category !== "equipment") return "notEquipment";
  return slotOf(input.item, input.slot) === null ? "noSlot" : null;
}

/**
 * Verdict pur d'un équipement : seul point de vérité, partagé par `equipItem`
 * (qui refuse alors par identité) et par l'inventaire (qui affiche la raison).
 */
export function equippable(input: EquipVerdictInput): EquipVerdict {
  const slot = slotOf(input.item, input.slot);
  const refusal = shapeRefusal(input) ?? heroRefusal(input);
  if (refusal !== "level") return { slot, refusal, requiredLevel: null };
  return { slot, refusal, requiredLevel: itemLevel(input.item) };
}
