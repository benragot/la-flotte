/** Version du format de sauvegarde (pas une donnée de jeu). */
export const SAVE_VERSION = 2;

/** Un compte porte au plus huit personnages : le schéma lève au neuvième. */
export const MAX_CHARACTERS = 8;

/** Contrat minimal d'un stockage clé/valeur injecté par l'appelant. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface HeroStatsSnapshot {
  vitality: number;
  wisdom: number;
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
}

export interface HeroSnapshot {
  name: string;
  classId: string;
  level: number;
  xp: number;
  kamas: number;
  hp: number;
  maxHp: number;
  ap: number;
  mp: number;
  capitalPoints: number;
  spellPoints: number;
  stats: HeroStatsSnapshot;
}

export interface ItemStackSnapshot {
  itemId: string;
  quantity: number;
}

export interface InventorySnapshot {
  stacks: ItemStackSnapshot[];
  equipment: Record<string, string>;
}

/** Dernière position connue d'un personnage : carte et case, jamais restaurée en PR A. */
export interface CharacterPosition {
  mapId: string;
  x: number;
  y: number;
}

/** Un personnage persistant : son héros, son sac et sa dernière position. */
export interface CharacterSnapshot {
  id: string;
  hero: HeroSnapshot;
  inventory: InventorySnapshot;
  position: CharacterPosition | null;
}

/**
 * Sauvegarde de compte : le roster (0 à `MAX_CHARACTERS`), la banque partagée
 * et les drapeaux de progression communs. `lastPlayedCharacterId` désigne le
 * personnage à recharger en priorité.
 */
export interface SaveData {
  saveVersion: number;
  savedAt: string;
  characters: CharacterSnapshot[];
  bank: InventorySnapshot;
  flags: Record<string, boolean>;
  lastPlayedCharacterId: string | null;
}

/** Sauvegarde fournie par l'application : la version et la date sont imposées. */
export type SaveInput = Omit<SaveData, "saveVersion">;

export interface SaveFailure {
  ok: false;
  reason: string;
}

export type SaveResult = { ok: true; save: SaveData } | SaveFailure;

export type ParsedJson = { ok: true; value: unknown } | SaveFailure;

export interface StorageLocation {
  storage: StorageLike;
  key: string;
}

export interface SaveToStorageInput extends StorageLocation {
  save: SaveData;
}

export const SAVE_ERROR_INVALID_JSON = "JSON invalide";
export const SAVE_ERROR_INVALID_SCHEMA = "schéma de sauvegarde invalide";
export const SAVE_ERROR_UNKNOWN_VERSION = "version de sauvegarde inconnue";
export const SAVE_ERROR_FUTURE_VERSION = "sauvegarde créée par une version plus récente";
export const SAVE_ERROR_MISSING = "aucune sauvegarde enregistrée";
