import type { DungeonDef, DungeonRoomDef } from "../../schemas/dungeonSchema";
import type { InventoryState } from "../inventory";

/** Salle de donjon issue du schéma `data/dungeons.yaml`. */
export type DungeonRoom = DungeonRoomDef;

/**
 * État d'un run de donjon. **Aucun champ de PV** : le moteur ne touche jamais
 * aux points de vie, le carry-over entre salles est à la charge de l'appelant,
 * et **aucune régénération ne doit être accordée** entre deux salles.
 */
export interface DungeonRunState {
  dungeonId: string;
  /** Index 0-based dans `dungeon.rooms`. */
  roomIndex: number;
  clearedRoomNumbers: number[];
  keysConsumed: number;
  log: string[];
}

/**
 * Seul échec produit par `enterDungeon` : la clé `keyItemId` est absente.
 */
export type EnterFailure = "no-key";

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
