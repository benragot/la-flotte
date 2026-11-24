import { create } from "zustand";
import classesYaml from "../../data/classes.yaml";
import itemsYaml from "../../data/items.yaml";
import progressionYaml from "../../data/progression.yaml";
import recipesYaml from "../../data/recipes.yaml";
import setsYaml from "../../data/sets.yaml";
import type { CombatRewards } from "../engine/combatLoop/types";
import type { Hero } from "../engine/createHero";
import { createHero } from "../engine/createHero";
import { craftMany, findRecipe, isRecipeKnown } from "../engine/craft";
import { findItem, creditDrops, emptyInventory, inventoryFromSnapshot, toInventorySnapshot } from "./gameSelectors";
import { gainXp, heroFromSnapshot, heroToSnapshot, spendCapitalPoints } from "../engine/hero";
import { addItem, countItem, equipItem, removeItem, unequipItem, useConsumable } from "../engine/inventory";
import type { EquipmentSlot, InventoryState, ItemLike } from "../engine/inventory";
import {
  MAX_CHARACTERS,
  clearSave,
  createSave,
  exportSaveJson,
  importSaveJson,
  loadFromStorage,
  saveToStorage,
} from "../engine/save";
import type {
  CharacterPosition,
  CharacterSnapshot,
  InventorySnapshot,
  SaveData,
  StorageLike,
} from "../engine/save";
import { classesFileSchema } from "../schemas/classSchema";
import type { ClassDef, StatKey } from "../schemas/classSchema";
import { itemsFileSchema } from "../schemas/itemSchema";
import { progressionFileSchema } from "../schemas/progressionSchema";
import { recipesFileSchema } from "../schemas/recipeSchema";
import { setsFileSchema } from "../schemas/setSchema";

export interface BankMoveInput {
  itemId: string;
  quantity: number;
}

export interface CraftRecipeInput {
  recipeId: string;
  times?: number;
}

/** Budget de capital à investir dans une caractéristique (coût du prochain point). */
export interface AllocateStatInput {
  stat: StatKey;
  points: number;
}

export interface CraftRecipeResult {
  crafted: number;
}

export interface GameStore {
  hero: Hero | null;
  inventory: InventoryState;
  bank: InventoryState;
  flags: Record<string, boolean>;
  /** Roster du compte : le personnage actif y figure aussi, re-snapshoté à la sauvegarde. */
  characters: CharacterSnapshot[];
  activeCharacterId: string | null;
  /** Dernière position connue du personnage actif ; écriture seule en PR A. */
  lastPosition: CharacterPosition | null;
  /** En V1, toutes les recettes du catalogue sont connues ; la découverte viendra en 6B. */
  knownRecipeIds: string[];
  /** Clé de stockage, injectable par les tests via `setState`. */
  saveKey: string;
  createCharacter: (input: { name: string; classId: string }) => void;
  /** Bascule sur un personnage du roster ; `false` si l'id est inconnu ou déjà actif. */
  switchCharacter: (characterId: string) => boolean;
  setLastPosition: (position: CharacterPosition) => void;
  allocateStat: (input: AllocateStatInput) => void;
  equip: (input: { itemId: string }) => void;
  unequip: (input: { slot: EquipmentSlot }) => void;
  drinkConsumable: (input: { itemId: string }) => void;
  creditCombatRewards: (rewards: CombatRewards) => void;
  depositToBank: (input: BankMoveInput) => void;
  withdrawFromBank: (input: BankMoveInput) => void;
  /** Aucun XP de craft en V1 : le métier viendra avec la découverte de recettes. */
  craftRecipe: (input: CraftRecipeInput) => CraftRecipeResult;
  saveGame: (storage?: StorageLike) => boolean;
  loadGame: (storage?: StorageLike) => boolean;
  exportJson: () => string | null;
  importJson: (raw: string) => boolean;
  resetGame: () => void;
  /**
   * NOUVEAU : efface la sauvegarde du slot courant. Utilisé par « Nouvelle
   * partie » pour que le `loadGame` du montage ne ressuscite pas l'ancien héros.
   */
  eraseSave: (storage?: StorageLike) => boolean;
}

interface GameState {
  hero: Hero | null;
  inventory: InventoryState;
  bank: InventoryState;
  flags: Record<string, boolean>;
  characters: CharacterSnapshot[];
  activeCharacterId: string | null;
  lastPosition: CharacterPosition | null;
}

type StoreUpdate = Partial<GameStore> | ((state: GameStore) => Partial<GameStore>);

type StoreSetter = (partial: StoreUpdate) => void;

const classes = classesFileSchema.parse(classesYaml).classes;
const itemDefs = itemsFileSchema.parse(itemsYaml).items;
const items: readonly ItemLike[] = itemDefs;
const recipes = recipesFileSchema.parse(recipesYaml).recipes;
const sets = setsFileSchema.parse(setsYaml).sets;
const progression = progressionFileSchema.parse(progressionYaml);

/** Catalogue validé, partagé avec l'arène (aucune donnée métier en dur). */
export const GAME_CATALOG = { classes, items, recipes, sets, progression } as const;

/** En V1, toutes les recettes du catalogue sont connues ; la découverte viendra en 6B. */
const KNOWN_RECIPE_IDS = recipes.map((recipe) => recipe.id);

export const DEFAULT_SAVE_KEY = "la-flotte-save-slot-1";

/** Kit de départ : tout équipement marqué `starting` dans `data/items.yaml`. */
const STARTING_ITEM_IDS = itemDefs
  .filter((item) => item.category === "equipment" && item.starting)
  .map((item) => item.id);

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
  return { hero: null, inventory: emptyInventory(), bank: emptyInventory(), flags: {}, characters: [], activeCharacterId: null, lastPosition: null };
}

/**
 * Champs qu'une remise à zéro **ne touche pas** : les actions et les deux
 * réglages de session (`saveKey`, catalogue de recettes déjà connu).
 * `emptyStore()` en dérive par `Omit`, donc un champ de données ajouté demain
 * à `GameStore` casse `tsc` tant qu'il n'est pas remis à zéro ici.
 */
type KeptOnReset =
  | "knownRecipeIds"
  | "saveKey"
  | "createCharacter"
  | "switchCharacter"
  | "setLastPosition"
  | "allocateStat"
  | "equip"
  | "unequip"
  | "drinkConsumable"
  | "creditCombatRewards"
  | "depositToBank"
  | "withdrawFromBank"
  | "craftRecipe"
  | "saveGame"
  | "loadGame"
  | "exportJson"
  | "importJson"
  | "resetGame"
  | "eraseSave";

type ResetFields = Omit<GameStore, KeptOnReset>;

/** État complet hors persistance : le roster et la banque repartent vides. */
function emptyStore(): ResetFields {
  return emptyGame();
}

function startingInventory(): InventoryState {
  return STARTING_ITEM_IDS.reduce(
    (inventory, itemId) => addItem({ inventory, itemId, quantity: 1 }),
    emptyInventory(),
  );
}

interface CreateCharacterInput {
  name: string;
  classId: string;
}

function characterSnapshotOf(id: string, hero: Hero, inventory: InventoryState): CharacterSnapshot {
  return { id, hero: heroToSnapshot(hero), inventory: toInventorySnapshot(inventory), position: null };
}

/** Photo du personnage actif, position comprise : le seul état « vivant » du roster. */
function activeSnapshot(state: GameState): CharacterSnapshot | null {
  if (state.hero === null || state.activeCharacterId === null) return null;
  const snapshot = characterSnapshotOf(state.activeCharacterId, state.hero, state.inventory);
  return { ...snapshot, position: state.lastPosition };
}

/** Remplace l'entrée du personnage actif sans jamais dupliquer son id. */
function mergeActive(roster: readonly CharacterSnapshot[], snapshot: CharacterSnapshot | null): CharacterSnapshot[] {
  if (snapshot === null) return [...roster];
  if (!roster.some((entry) => entry.id === snapshot.id)) return [...roster, snapshot];
  return roster.map((entry) => (entry.id === snapshot.id ? snapshot : entry));
}

function nextCharacterId(roster: readonly CharacterSnapshot[]): string {
  const taken = new Set(roster.map((entry) => entry.id));
  let index = roster.length + 1;
  while (taken.has(`char-${index}`)) index += 1;
  return `char-${index}`;
}

/** Cap dur à huit : le neuvième personnage lève, il n'est jamais tronqué. */
function assertRosterRoom(roster: readonly CharacterSnapshot[]): void {
  if (roster.length >= MAX_CHARACTERS) throw new Error(`un compte compte au plus ${MAX_CHARACTERS} personnages`);
}

function newCharacterState(roster: readonly CharacterSnapshot[], input: CreateCharacterInput, classDef: ClassDef): Partial<GameStore> {
  const id = nextCharacterId(roster);
  const hero = createHero(input.name, classDef);
  const inventory = startingInventory();
  const characters = mergeActive(roster, characterSnapshotOf(id, hero, inventory));
  return { hero, inventory, characters, activeCharacterId: id, lastPosition: null };
}

/** Ajoute un personnage au roster du compte : la banque et les drapeaux sont conservés. */
function createdGame(state: GameStore, input: CreateCharacterInput): Partial<GameStore> {
  const classDef = classDefFor(input.classId);
  if (classDef === undefined) return {};
  const roster = mergeActive(state.characters, activeSnapshot(state));
  assertRosterRoom(roster);
  return newCharacterState(roster, input, classDef);
}

function allocatedGame(hero: Hero | null, input: AllocateStatInput): Partial<GameState> {
  if (hero === null) return {};
  const classDef = classDefFor(hero.classId);
  if (classDef === undefined) return {};
  return { hero: spendCapitalPoints({ hero, ...input, classDef }).hero };
}

/**
 * Investir est définitif : l'action persiste, comme la victoire de combat.
 * Sans cela, un rechargement restaure la sauvegarde antérieure et rend les
 * points déjà investis (Bug 5). Un refus rend le héros par identité : on
 * n'écrit alors rien.
 */
function allocateAndSave(set: StoreSetter, get: () => GameStore, input: AllocateStatInput): void {
  const current = get().hero;
  const update = allocatedGame(current, input);
  if (update.hero === undefined || update.hero === current) return;
  set(update);
  get().saveGame();
}

/** Équipe un id du catalogue : le niveau du héros arme les gardes du moteur. */
function equippedGame(
  hero: Hero | null,
  inventory: InventoryState,
  itemId: string,
): Partial<GameState> {
  const item = findItem(items, itemId);
  if (hero === null || item === undefined) return {};
  return { inventory: equipItem({ inventory, item, heroLevel: hero.level }) };
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

interface TransferInput {
  from: InventoryState;
  to: InventoryState;
  itemId: string;
  quantity: number;
}

interface TransferResult {
  from: InventoryState;
  to: InventoryState;
}

/** Refus total : les deux inventaires sont rendus par identité, aucun transfert partiel. */
function refusedTransfer(input: TransferInput): TransferResult {
  return { from: input.from, to: input.to };
}

/** Déplace `quantity` unités, tout-ou-rien : le stock est vérifié avant tout retrait. */
function transferStack(input: TransferInput): TransferResult {
  const owned = countItem(input.from, input.itemId);
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) return refusedTransfer(input);
  if (owned < input.quantity) return refusedTransfer(input);
  const from = removeItem({ inventory: input.from, itemId: input.itemId, quantity: input.quantity });
  const to = addItem({ inventory: input.to, itemId: input.itemId, quantity: input.quantity });
  return { from, to };
}

function depositedGame(state: GameStore, input: BankMoveInput): Partial<GameStore> {
  const result = transferStack({ from: state.inventory, to: state.bank, ...input });
  return { inventory: result.from, bank: result.to };
}

function withdrawnGame(state: GameStore, input: BankMoveInput): Partial<GameStore> {
  const result = transferStack({ from: state.bank, to: state.inventory, ...input });
  return { inventory: result.to, bank: result.from };
}

interface CraftOutcome {
  inventory: InventoryState;
  crafted: number;
}

function failedCraft(inventory: InventoryState): CraftOutcome {
  return { inventory, crafted: 0 };
}

/** Délègue au moteur de craft ; recette absente ou inconnue ⇒ aucun changement. */
function craftInStore(state: GameStore, input: CraftRecipeInput): CraftOutcome {
  const recipe = findRecipe(recipes, input.recipeId);
  if (recipe === null) return failedCraft(state.inventory);
  if (!isRecipeKnown({ recipe, knownRecipeIds: state.knownRecipeIds })) return failedCraft(state.inventory);
  const options = { recipe, inventory: state.inventory, times: input.times ?? 1 };
  const result = craftMany(options);
  return { inventory: result.inventory, crafted: result.craftedCount };
}

function rosterForSave(state: GameState): CharacterSnapshot[] {
  return mergeActive(state.characters, activeSnapshot(state));
}

function currentSave(game: GameState): SaveData | null {
  const characters = rosterForSave(game);
  if (characters.length === 0) return null;
  const savedAt = new Date().toISOString();
  const bank = toInventorySnapshot(game.bank);
  return createSave({ savedAt, characters, bank, flags: game.flags, lastPlayedCharacterId: game.activeCharacterId });
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

/** Efface le slot courant ; `false` si le stockage manque ou refuse (mode privé). */
function eraseStoredSave(storage: StorageLike | undefined, key: string): boolean {
  const target = storage ?? browserStorage();
  if (target === undefined) return false;
  try {
    clearSave({ storage: target, key });
    return true;
  } catch {
    return false;
  }
}

interface CharacterGameInput {
  character: CharacterSnapshot;
  bank: InventorySnapshot;
  flags: Record<string, boolean>;
  roster: CharacterSnapshot[];
}

/** Reconstruit l'état vivant depuis un personnage du roster et la banque du compte. */
function characterGame(input: CharacterGameInput): GameState | null {
  const classDef = classDefFor(input.character.hero.classId);
  if (classDef === undefined) return null;
  const hero = heroFromSnapshot(input.character.hero, classDef);
  const inventory = inventoryFromSnapshot(input.character.inventory, items, hero.level);
  const bank = inventoryFromSnapshot(input.bank, items, hero.level);
  const flags = { ...input.flags };
  return { hero, inventory, bank, flags, characters: input.roster, activeCharacterId: input.character.id, lastPosition: input.character.position };
}

function activeCharacterOf(save: SaveData): CharacterSnapshot | null {
  const lastPlayed = save.characters.find((entry) => entry.id === save.lastPlayedCharacterId);
  return lastPlayed ?? save.characters[0] ?? null;
}

/**
 * Applique une sauvegarde : le roster entier et la banque partagée sont
 * restaurés tels quels, puis le dernier personnage joué devient actif.
 */
function applySave(setState: StoreSetter, save: SaveData | null): boolean {
  if (save === null) return false;
  const character = activeCharacterOf(save);
  if (character === null) return false;
  const options = { character, bank: save.bank, flags: save.flags, roster: save.characters };
  const game = characterGame(options);
  if (game === null) return false;
  setState(game);
  return true;
}

function switchedGame(state: GameStore, characterId: string): GameState | null {
  if (characterId === state.activeCharacterId) return null;
  const target = state.characters.find((entry) => entry.id === characterId);
  if (target === undefined) return null;
  const roster = mergeActive(state.characters, activeSnapshot(state));
  return characterGame({ character: target, bank: state.bank, flags: state.flags, roster });
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

function characterActions(set: StoreSetter, get: () => GameStore): CharacterActions {
  return {
    createCharacter: (input) => set((state) => createdGame(state, input)),
    allocateStat: (input) => allocateAndSave(set, get, input),
    equip: (input) => set((state) => equippedGame(state.hero, state.inventory, input.itemId)),
    unequip: (input) => set((state) => unequippedGame(state.inventory, input.slot)),
    drinkConsumable: (input) => set((state) => drunkGame(state.hero, state.inventory, input.itemId)),
    creditCombatRewards: (rewards) => set((state) => creditedGame(state.hero, state.inventory, rewards)),
  };
}

type SaveActions = Pick<
  GameStore,
  "saveGame" | "loadGame" | "exportJson" | "importJson" | "resetGame" | "eraseSave"
>;

function saveActions(set: StoreSetter, get: () => GameStore): SaveActions {
  return {
    saveGame: (storage) => persist(get(), storage, get().saveKey),
    loadGame: (storage) => applySave(set, readSave(storage, get().saveKey)),
    exportJson: () => exportState(get()),
    importJson: (raw) => importState(set, raw),
    resetGame: () => set(emptyStore()),
    eraseSave: (storage) => eraseStoredSave(storage, get().saveKey),
  };
}

type BankActions = Pick<GameStore, "depositToBank" | "withdrawFromBank">;

function bankActions(set: StoreSetter): BankActions {
  return {
    depositToBank: (input) => set((state) => depositedGame(state, input)),
    withdrawFromBank: (input) => set((state) => withdrawnGame(state, input)),
  };
}

type RosterActions = Pick<GameStore, "switchCharacter" | "setLastPosition">;

function switchAction(set: StoreSetter, get: () => GameStore): (characterId: string) => boolean {
  return (characterId) => {
    const next = switchedGame(get(), characterId);
    if (next === null) return false;
    set(next);
    return true;
  };
}

/** Sélection d'un personnage du roster et écriture de sa position : aucune restauration. */
function rosterActions(set: StoreSetter, get: () => GameStore): RosterActions {
  return { switchCharacter: switchAction(set, get), setLastPosition: (position) => set({ lastPosition: position }) };
}

type CraftActions = Pick<GameStore, "craftRecipe">;

function craftActions(set: StoreSetter, get: () => GameStore): CraftActions {
  return {
    craftRecipe: (input) => {
      const outcome = craftInStore(get(), input);
      if (outcome.crafted > 0) set({ inventory: outcome.inventory });
      return { crafted: outcome.crafted };
    },
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...emptyStore(),
  knownRecipeIds: KNOWN_RECIPE_IDS,
  saveKey: DEFAULT_SAVE_KEY,
  ...characterActions(set, get),
  ...rosterActions(set, get),
  ...bankActions(set),
  ...craftActions(set, get),
  ...saveActions(set, get),
}));
