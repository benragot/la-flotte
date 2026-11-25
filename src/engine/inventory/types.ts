/**
 * Bloc de statistiques partiel : toute clé absente vaut 0 au moment de la
 * somme. Aucun seuil ni valeur métier n'est fixé ici, c'est une enveloppe.
 */
export interface StatBlock {
  vitality?: number;
  wisdom?: number;
  strength?: number;
  intelligence?: number;
  chance?: number;
  agility?: number;
  hp?: number;
  ap?: number;
  mp?: number;
  percentDmg?: number;
  flatRes?: number;
  percentRes?: number;
  prospection?: number;
}

export type StatField = keyof StatBlock;

/** Bloc complet : toutes les clés sont présentes et valent au moins 0. */
export type TotalStats = Record<StatField, number>;

export type EquipmentSlot =
  | "hat"
  | "cloak"
  | "weapon"
  | "amulet"
  | "ring1"
  | "ring2"
  | "belt"
  | "boots";

export type ItemCategory = "resource" | "consumable" | "equipment" | "key";

export interface ItemLike {
  id: string;
  name: string;
  category: ItemCategory;
  slot?: EquipmentSlot;
  setId?: string;
  /** Niveau requis pour porter l'objet, tel que lu dans `data/items.yaml`. */
  level?: number;
  stats?: StatBlock;
  heal?: number;
  /** Prix de revente unitaire (`data/items.yaml`) ; absent ⇒ objet invendable. */
  sellPrice?: number;
}

export interface SetBonusTier {
  pieces: number;
  stats: StatBlock;
}

export interface SetLike {
  id: string;
  pieceIds: string[];
  bonuses: SetBonusTier[];
}

export interface ItemStack {
  itemId: string;
  quantity: number;
}

export type EquipmentState = Partial<Record<EquipmentSlot, string>>;

export interface InventoryState {
  stacks: ItemStack[];
  equipment: EquipmentState;
}

export interface AddItemInput {
  inventory: InventoryState;
  itemId: string;
  quantity: number;
}

export interface RemoveItemInput {
  inventory: InventoryState;
  itemId: string;
  quantity: number;
}

export interface EquipItemInput {
  inventory: InventoryState;
  item: ItemLike;
  /** Slot cible ; par défaut `item.slot`. */
  slot?: EquipmentSlot;
  /**
   * Niveau du héros. Omis = outillage **hors partie** (reconstruction d'un
   * inventaire par un test de données ou le kit de départ d'un walkthrough) :
   * les deux gardes de héros — niveau et possession — sont alors désarmées.
   * Le store de partie fournit toujours `hero.level`, donc le joueur réel
   * passe obligatoirement par les deux gardes.
   */
  heroLevel?: number;
}

/** Un verdict se calcule sur exactement les mêmes entrées que l'équipement. */
export type EquipVerdictInput = EquipItemInput;

export interface UnequipItemInput {
  inventory: InventoryState;
  slot: EquipmentSlot;
}

export interface UseConsumableInput {
  inventory: InventoryState;
  item: ItemLike;
  currentHp: number;
  maxHp: number;
}

export interface UseConsumableResult {
  inventory: InventoryState;
  healed: number;
  hp: number;
}

export interface EquippedItemsInput {
  inventory: InventoryState;
  items: readonly ItemLike[];
}

export interface SetBonusInput extends EquippedItemsInput {
  sets: readonly SetLike[];
}

export interface ActiveSetBonus {
  setId: string;
  activePieces: number;
  bonuses: StatBlock[];
}

export interface TotalStatsInput extends SetBonusInput {
  base: StatBlock;
  capital: StatBlock;
}
