import { create } from "zustand";
import classesYaml from "../../data/classes.yaml";
import itemsYaml from "../../data/items.yaml";
import progressionYaml from "../../data/progression.yaml";
import setsYaml from "../../data/sets.yaml";
import type { CombatRewards } from "../engine/combatLoop/types";
import type { Hero } from "../engine/createHero";
import { createHero } from "../engine/createHero";
import { findItem, creditDrops, emptyInventory, inventoryFromSnapshot, toInventorySnapshot } from "./gameSelectors";
import { gainXp, heroFromSnapshot, heroToSnapshot, spendCapitalPoints } from "../engine/hero";
import { equipItem, unequipItem, useConsumable } from "../engine/inventory";
import type { EquipmentSlot, InventoryState, ItemLike } from "../engine/inventory";
import {
  createSave,
  exportSaveJson,
  importSaveJson,
  loadFromStorage,
  saveToStorage,
} from "../engine/save";
import type { SaveData, StorageLike } from "../engine/save";
import { classesFileSchema } from "../schemas/classSchema";
import type { ClassDef, StatKey } from "../schemas/classSchema";
import { itemsFileSchema } from "../schemas/itemSchema";
import { progressionFileSchema } from "../schemas/progressionSchema";
import { setsFileSchema } from "../schemas/setSchema";

export interface GameStore {
  hero: Hero | null;
  inventory: InventoryState;
  flags: Record<string, boolean>;
  /** Clé de stockage, injectable par les tests via `setState`. */
  saveKey: string;
  createCharacter: (input: { name: string; classId: string }) => void;
  allocateStat: (input: { stat: StatKey; points: number }) => void;
  equip: (input: { itemId: string }) => void;
  unequip: (input: { slot: EquipmentSlot }) => void;
  drinkConsumable: (input: { itemId: string }) => void;
  creditCombatRewards: (rewards: CombatRewards) => void;
  saveGame: (storage?: StorageLike) => boolean;
  loadGame: (storage?: StorageLike) => boolean;
  exportJson: () => string | null;
  importJson: (raw: string) => boolean;
  resetGame: () => void;
}

interface GameState {
  hero: Hero | null;
  inventory: InventoryState;
  flags: Record<string, boolean>;
}

type StoreUpdate = Partial<GameStore> | ((state: GameStore) => Partial<GameStore>);

type StoreSetter = (partial: StoreUpdate) => void;

const classes = classesFileSchema.parse(classesYaml).classes;
const items: readonly ItemLike[] = itemsFileSchema.parse(itemsYaml).items;
const sets = setsFileSchema.parse(setsYaml).sets;
const progression = progressionFileSchema.parse(progressionYaml);

/** Catalogue validé, partagé avec l'arène (aucune donnée métier en dur). */
export const GAME_CATALOG = { classes, items, sets, progression } as const;

export const DEFAULT_SAVE_KEY = "la-flotte-save-slot-1";

function classDefFor(classId: string): ClassDef | undefined {
  return classes.find((entry) => entry.id === classId);
}

/** `localStorage` n'est lu qu'à l'appel : les tests node n'ont pas de `window`. */
function browserStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function emptyGame(): GameState {
  return { hero: null, inventory: emptyInventory(), flags: {} };
}

function createdGame(input: { name: string; classId: string }): Partial<GameState> {
  const classDef = classDefFor(input.classId);
  if (classDef === undefined) return {};
  return { ...emptyGame(), hero: createHero(input.name, classDef) };
}

function allocatedGame(hero: Hero | null, input: { stat: StatKey; points: number }): Partial<GameState> {
  if (hero === null) return {};
  const classDef = classDefFor(hero.classId);
  if (classDef === undefined) return {};
  return { hero: spendCapitalPoints({ hero, ...input, classDef }).hero };
}

function equippedGame(inventory: InventoryState, itemId: string): Partial<GameState> {
  const item = findItem(items, itemId);
  return item === undefined ? {} : { inventory: equipItem({ inventory, item }) };
}

function unequippedGame(inventory: InventoryState, slot: EquipmentSlot): Partial<GameState> {
  return { inventory: unequipItem({ inventory, slot }) };
}

function drunkGame(hero: Hero | null, inventory: InventoryState, itemId: string): Partial<GameState> {
  if (hero === null) return {};
  const item = findItem(items, itemId);
  if (item === undefined) return {};
  const result = useConsumable({ inventory, item, currentHp: hero.hp, maxHp: hero.maxHp });
  if (result.healed === 0) return {};
  return { hero: { ...hero, hp: result.hp }, inventory: result.inventory };
}

function creditedGame(
  hero: Hero | null,
  inventory: InventoryState,
  rewards: CombatRewards,
): Partial<GameState> {
  if (hero === null) return {};
  const options = { hero, amount: rewards.xpGained, apRules: progression.apRules };
  const leveled = gainXp({ ...options, tiers: progression.xpThresholds, gainRules: progression.gainRules });
  return { hero: leveled.hero, inventory: creditDrops({ inventory, drops: rewards.drops, items }) };
}

function currentSave(game: GameState): SaveData | null {
  if (game.hero === null) return null;
  const savedAt = new Date().toISOString();
  const options = { savedAt, flags: game.flags, hero: heroToSnapshot(game.hero) };
  return createSave({ ...options, inventory: toInventorySnapshot(game.inventory) });
}

function persist(game: GameState, storage: StorageLike | undefined, key: string): boolean {
  const save = currentSave(game);
  const target = storage ?? browserStorage();
  if (save === null || target === undefined) return false;
  return saveToStorage({ storage: target, key, save });
}

function readSave(storage: StorageLike | undefined, key: string): SaveData | null {
  const target = storage ?? browserStorage();
  if (target === undefined) return null;
  const result = loadFromStorage({ storage: target, key });
  return result.ok ? result.save : null;
}

function gameFromSave(save: SaveData): GameState | null {
  const classDef = classDefFor(save.hero.classId);
  if (classDef === undefined) return null;
  const hero = heroFromSnapshot(save.hero, classDef);
  return { hero, inventory: inventoryFromSnapshot(save.inventory, items), flags: { ...save.flags } };
}

function applySave(setState: StoreSetter, save: SaveData | null): boolean {
  const game = save === null ? null : gameFromSave(save);
  if (game === null) return false;
  setState(game);
  return true;
}

function exportState(game: GameState): string | null {
  const save = currentSave(game);
  return save === null ? null : exportSaveJson(save);
}

function importState(setState: StoreSetter, raw: string): boolean {
  const result = importSaveJson(raw);
  return result.ok ? applySave(setState, result.save) : false;
}

type CharacterActions = Pick<
  GameStore,
  "createCharacter" | "allocateStat" | "equip" | "unequip" | "drinkConsumable" | "creditCombatRewards"
>;

function characterActions(set: StoreSetter): CharacterActions {
  return {
    createCharacter: (input) => set(createdGame(input)),
    allocateStat: (input) => set((state) => allocatedGame(state.hero, input)),
    equip: (input) => set((state) => equippedGame(state.inventory, input.itemId)),
    unequip: (input) => set((state) => unequippedGame(state.inventory, input.slot)),
    drinkConsumable: (input) => set((state) => drunkGame(state.hero, state.inventory, input.itemId)),
    creditCombatRewards: (rewards) => set((state) => creditedGame(state.hero, state.inventory, rewards)),
  };
}

type SaveActions = Pick<GameStore, "saveGame" | "loadGame" | "exportJson" | "importJson" | "resetGame">;

function saveActions(set: StoreSetter, get: () => GameStore): SaveActions {
  return {
    saveGame: (storage) => persist(get(), storage, get().saveKey),
    loadGame: (storage) => applySave(set, readSave(storage, get().saveKey)),
    exportJson: () => exportState(get()),
    importJson: (raw) => importState(set, raw),
    resetGame: () => set(emptyGame()),
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...emptyGame(),
  saveKey: DEFAULT_SAVE_KEY,
  ...characterActions(set),
  ...saveActions(set, get),
}));
