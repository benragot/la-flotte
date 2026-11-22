import type { DungeonDef, DungeonRoomDef } from "../../schemas/dungeonSchema";
import type { InventoryState } from "../inventory";

/** Salle de donjon issue du schéma `data/dungeons.yaml`. */
export type DungeonRoom = DungeonRoomDef;

export interface DungeonRunState {
  dungeonId: string;
  /** Index 0-based dans `dungeon.rooms`. */
  roomIndex: number;
  clearedRoomNumbers: number[];
  keysConsumed: number;
  log: string[];
}

/**
 * Échecs d'entrée : `unknown-dungeon` et `already-cleared` sont réservés à
 * l'appelant qui résout l'id et l'historique des runs.
 */
export type EnterFailure = "no-key" | "unknown-dungeon" | "already-cleared";

export interface EnterDungeonInput {
  dungeon: DungeonDef;
  inventory: InventoryState;
}

export interface EnterResult {
  run: DungeonRunState | null;
  inventory: InventoryState;
  reason: EnterFailure | null;
}

export interface AttemptRoomInput {
  run: DungeonRunState;
  dungeon: DungeonDef;
  defeatedMonsterIds: readonly string[];
}

export interface AttemptRoomResult {
  run: DungeonRunState;
  cleared: boolean;
}

export interface DungeonProgress {
  roomNumber: number;
  cleared: number;
  total: number;
  isBossRoom: boolean;
}
