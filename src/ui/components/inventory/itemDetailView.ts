import type { ItemDef } from "../../../schemas/itemSchema";
import type { StatField } from "../../../engine/inventory";
import { SLOT_LABELS, STAT_LABELS, formatStatValue } from "../../inventoryHudHelpers";

/** Ligne prête à afficher : libellé lisible et valeur déjà signée (`+3`, `-1`). */
export interface ItemDetailRow {
  key: string;
  label: string;
  value: string;
}

/** Panoplie à laquelle l'objet appartient : nom et nombre de pièces de l'ensemble. */
export interface ItemDetailSet {
  name: string;
  pieces: number;
}

/**
 * Modèle de vue **exhaustif** d'un objet : chaque champ de `ItemDef` atterrit
 * dans un de ces champs, sauf `starting` (indicateur interne de kit de départ).
 * Pur : aucune mutation de l'item, aucune lecture du DOM.
 */
export interface ItemDetailView {
  id: string;
  title: string;
  category: string;
  slot: string | null;
  level: number | null;
  rows: ItemDetailRow[];
  effects: ItemDetailRow[];
  resistances: ItemDetailRow[];
  set: ItemDetailSet | null;
  sellPrice: number;
  buyPrice: number | null;
  description: string;
}

export interface ItemDetailSetLike {
  id: string;
  name: string;
  pieceIds: readonly string[];
}

export interface ItemDetailContext {
  sets: readonly ItemDetailSetLike[];
}

const CATEGORY_LABELS: Record<ItemDef["category"], string> = {
  resource: "Ressource",
  consumable: "Consommable",
  equipment: "Équipement",
  key: "Clé",
};

const RESISTANCE_LABELS: Record<string, string> = {
  flatRes: "Résistance",
  percentRes: "% Résistance",
};

function isResistanceKey(key: string): boolean {
  return key in RESISTANCE_LABELS;
}

function statsEntries(item: ItemDef, keep: (key: string) => boolean): [string, number][] {
  if (item.category !== "equipment") return [];
  const entries = Object.entries(item.stats).filter(([key, value]) => keep(key) && value !== undefined);
  return entries.map(([key, value]) => [key, value ?? 0]);
}

function labelOf(key: string): string {
  return STAT_LABELS[key as StatField] ?? key;
}

function statRows(item: ItemDef): ItemDetailRow[] {
  return statsEntries(item, (key) => !isResistanceKey(key)).map(([key, value]) => ({
    key,
    label: labelOf(key),
    value: formatStatValue(value),
  }));
}

function resistanceRows(item: ItemDef): ItemDetailRow[] {
  return statsEntries(item, isResistanceKey).map(([key, value]) => ({
    key,
    label: RESISTANCE_LABELS[key] ?? key,
    value: formatStatValue(value),
  }));
}

/** Consommable : soin ; clef : donjon visé. Rien d'autre n'a d'effet à décrire. */
function effectRows(item: ItemDef): ItemDetailRow[] {
  if (item.category === "consumable") return [{ key: "heal", label: "Soin", value: `+${item.heal} PV` }];
  if (item.category !== "key") return [];
  return [{ key: "targetDungeonId", label: "Donjon ciblé", value: item.targetDungeonId }];
}

function slotLabelOf(item: ItemDef): string | null {
  return item.category === "equipment" ? SLOT_LABELS[item.slot] : null;
}

function levelOf(item: ItemDef): number | null {
  return item.category === "equipment" ? item.level : null;
}

function buyPriceOf(item: ItemDef): number | null {
  if (item.category !== "consumable") return null;
  return item.price ?? null;
}

function setOf(item: ItemDef, sets: readonly ItemDetailSetLike[]): ItemDetailSet | null {
  if (item.category !== "equipment") return null;
  if (item.setId === undefined) return null;
  const found = sets.find((set) => set.id === item.setId);
  if (found === undefined) return { name: item.setId, pieces: 0 };
  return { name: found.name, pieces: found.pieceIds.length };
}

type DetailIdentity = Omit<ItemDetailView, "rows" | "effects" | "resistances" | "set">;

function namingOf(item: ItemDef): Pick<DetailIdentity, "id" | "title" | "description"> {
  return { id: item.id, title: item.name, description: item.description };
}

function placementOf(item: ItemDef): Pick<DetailIdentity, "category" | "slot" | "level"> {
  return { category: CATEGORY_LABELS[item.category], slot: slotLabelOf(item), level: levelOf(item) };
}

function pricesOf(item: ItemDef): Pick<DetailIdentity, "sellPrice" | "buyPrice"> {
  return { sellPrice: item.sellPrice, buyPrice: buyPriceOf(item) };
}

function identityOf(item: ItemDef): DetailIdentity {
  return { ...namingOf(item), ...placementOf(item), ...pricesOf(item) };
}

/** Modèle de vue complet d'un objet, sans dépendance au DOM ni au store. */
export function itemDetailView(item: ItemDef, context: ItemDetailContext): ItemDetailView {
  return {
    ...identityOf(item),
    rows: statRows(item),
    effects: effectRows(item),
    resistances: resistanceRows(item),
    set: setOf(item, context.sets),
  };
}
