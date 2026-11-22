import type { AddItemInput, InventoryState, RemoveItemInput } from "./types";

interface QuantityInput {
  inventory: InventoryState;
  itemId: string;
  quantity: number;
}

function withQuantity(input: QuantityInput): InventoryState {
  const stacks = input.inventory.stacks.map((stack) =>
    stack.itemId === input.itemId ? { itemId: stack.itemId, quantity: input.quantity } : stack,
  );
  return { ...input.inventory, stacks };
}

function dropStack(inventory: InventoryState, itemId: string): InventoryState {
  const stacks = inventory.stacks.filter((stack) => stack.itemId !== itemId);
  return { ...inventory, stacks };
}

function appendStack(input: AddItemInput): InventoryState {
  const stack = { itemId: input.itemId, quantity: input.quantity };
  return { ...input.inventory, stacks: [...input.inventory.stacks, stack] };
}

export function countItem(inventory: InventoryState, itemId: string): number {
  const stack = inventory.stacks.find((candidate) => candidate.itemId === itemId);
  return stack?.quantity ?? 0;
}

/**
 * Ajoute `quantity` unités. Une quantité non strictement positive est refusée
 * et l'inventaire d'entrée est rendu par référence (aucune allocation).
 */
export function addItem(input: AddItemInput): InventoryState {
  if (input.quantity <= 0) return input.inventory;
  const owned = countItem(input.inventory, input.itemId);
  if (owned === 0) return appendStack(input);
  return withQuantity({ ...input, quantity: owned + input.quantity });
}

/**
 * Retire `quantity` unités. Choix assumé : pas de clamp silencieux. Un retrait
 * supérieur au stock (ou non strictement positif) est refusé et l'inventaire
 * d'entrée est rendu par référence, pour que l'appelant détecte l'échec par
 * simple comparaison d'identité.
 */
export function removeItem(input: RemoveItemInput): InventoryState {
  const owned = countItem(input.inventory, input.itemId);
  if (input.quantity <= 0 || owned < input.quantity) return input.inventory;
  if (owned === input.quantity) return dropStack(input.inventory, input.itemId);
  return withQuantity({ ...input, quantity: owned - input.quantity });
}
