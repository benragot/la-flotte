import dungeonsYaml from "../../data/dungeons.yaml";
import type { EnterResult } from "../engine/dungeon";
import { enterDungeon } from "../engine/dungeon";
import type { InventoryState, ItemLike } from "../engine/inventory";
import { countItem } from "../engine/inventory";
import type { BattleState } from "../engine/multiCombat";
import type { DungeonDef } from "../schemas/dungeonSchema";
import { dungeonsFileSchema } from "../schemas/dungeonSchema";

/**
 * Catalogue de donjons validé par Zod, comme `GAME_CATALOG` le fait pour les
 * objets : **aucun nom de donjon ni id de clef n'est écrit dans `src/`**.
 */
export const DUNGEON_CATALOG: readonly DungeonDef[] = dungeonsFileSchema.parse(dungeonsYaml).dungeons;

/** Vue d'une entrée de donjon : tout ce que le panneau affiche. */
export interface DungeonEntryView {
  id: string;
  name: string;
  recommendedLevel: number;
  keyItemId: string;
  keyName: string;
  keyCount: number;
  hasKey: boolean;
}

export interface DungeonEntriesInput {
  dungeons: readonly DungeonDef[];
  items: readonly ItemLike[];
  inventory: InventoryState;
}

export interface DungeonEntryInput {
  dungeonId: string;
  inventory: InventoryState;
}

export interface DungeonEntryOutcome {
  dungeon: DungeonDef;
  result: EnterResult;
}

export interface LevelWarningInput {
  recommendedLevel: number;
  heroLevel: number;
}

export interface EntryAvailabilityInput {
  hasHero: boolean;
  runActive: boolean;
  dungeonCount: number;
}

/** Retrouve un donjon par id, `null` si le catalogue ne le connaît pas. */
export function dungeonById(id: string): DungeonDef | null {
  return DUNGEON_CATALOG.find((entry) => entry.id === id) ?? null;
}

/**
 * Entrée de donjon par le chemin de production : catalogue → moteur
 * `enterDungeon`. `null` seulement si l'id est inconnu ; le refus sans clef est
 * porté par `result.reason`. L'inventaire n'est jamais muté.
 */
export function dungeonEntry(input: DungeonEntryInput): DungeonEntryOutcome | null {
  const dungeon = dungeonById(input.dungeonId);
  if (dungeon === null) return null;
  return { dungeon, result: enterDungeon({ dungeon, inventory: input.inventory }) };
}

function entryView(dungeon: DungeonDef, input: DungeonEntriesInput): DungeonEntryView {
  const key = input.items.find((item) => item.id === dungeon.keyItemId);
  const keyCount = countItem(input.inventory, dungeon.keyItemId);
  const identity = { id: dungeon.id, name: dungeon.name, recommendedLevel: dungeon.recommendedLevel };
  return { ...identity, keyItemId: dungeon.keyItemId, keyName: key?.name ?? dungeon.keyItemId, keyCount, hasKey: keyCount > 0 };
}

/** Une ligne par donjon du catalogue, avec l'état de sa clef dans le sac. */
export function dungeonEntries(input: DungeonEntriesInput): DungeonEntryView[] {
  return input.dungeons.map((dungeon) => entryView(dungeon, input));
}

/**
 * D67 : avertissement de niveau, **jamais** un blocage. `null` au niveau ou
 * au-dessus du recommandé.
 */
export function levelWarning(input: LevelWarningInput): string | null {
  if (input.heroLevel >= input.recommendedLevel) return null;
  const level = `niveau recommandé ${input.recommendedLevel}`;
  return `${level} : ton héros (niveau ${input.heroLevel}) est en dessous. L'entrée reste possible.`;
}

/**
 * Ids des monstres vaincus **lus dans l'état de bataille** (`<id>-<index>`),
 * jamais reconstruits depuis le YAML : c'est le défaut corrigé en #40.
 */
export function fallenMonsterIds(state: BattleState): string[] {
  const fallen = state.combatants.filter((entry) => entry.side === "enemy" && entry.hp <= 0);
  return fallen.map((entry) => entry.id.replace(/-\d+$/, ""));
}

/** Le panneau ne rend rien hors contexte : pas de héros, run en cours, catalogue vide. */
export function canEnterDungeon(input: EntryAvailabilityInput): boolean {
  return input.hasHero && !input.runActive && input.dungeonCount > 0;
}
