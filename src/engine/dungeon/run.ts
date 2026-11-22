import type { DungeonDef, DungeonMonsterGroup } from "../../schemas/dungeonSchema";
import { countItem, removeItem } from "../inventory";
import { currentRoom } from "./rooms";
import type {
  AttemptRoomInput,
  AttemptRoomResult,
  DungeonRoom,
  DungeonRunState,
  EnterDungeonInput,
  EnterResult,
} from "./types";

function createRun(dungeon: DungeonDef): DungeonRunState {
  return {
    dungeonId: dungeon.id,
    roomIndex: 0,
    clearedRoomNumbers: [],
    keysConsumed: 1,
    log: [`Entrée dans ${dungeon.name}`],
  };
}

/**
 * Ouvre un run si la clé est présente : exactement une unité est consommée et
 * le reste de l'inventaire est préservé. Sans clé, `run` vaut `null`, la
 * raison `no-key` et l'inventaire est rendu par identité.
 */
export function enterDungeon({ dungeon, inventory }: EnterDungeonInput): EnterResult {
  if (countItem(inventory, dungeon.keyItemId) < 1) {
    return { run: null, inventory, reason: "no-key" };
  }
  const paid = removeItem({ inventory, itemId: dungeon.keyItemId, quantity: 1 });
  return { run: createRun(dungeon), inventory: paid, reason: null };
}

function clearedState(run: DungeonRunState, room: DungeonRoom): DungeonRunState {
  const clearedRoomNumbers = [...run.clearedRoomNumbers, room.roomNumber];
  return {
    ...run,
    roomIndex: run.roomIndex + 1,
    clearedRoomNumbers,
    log: [...run.log, `Salle ${room.roomNumber} nettoyée : ${room.name}`],
  };
}

/** Avance d'une salle ; la même référence est rendue si le run est terminé. */
export function completeRoom(run: DungeonRunState, dungeon: DungeonDef): DungeonRunState {
  const room = currentRoom(run, dungeon);
  if (room === null) return run;
  return clearedState(run, room);
}

function countDefeated(ids: readonly string[], monsterId: string): number {
  return ids.filter((candidate) => candidate === monsterId).length;
}

function isGroupDefeated(group: DungeonMonsterGroup, ids: readonly string[]): boolean {
  return countDefeated(ids, group.monsterId) >= group.count;
}

function isRoomCleared(room: DungeonRoom, ids: readonly string[]): boolean {
  return room.monsters.every((group) => isGroupDefeated(group, ids));
}

/**
 * Valide la salle courante si chaque groupe est vaincu au moins `count` fois.
 * Le moteur ne touche **jamais** aux PV : le carry-over entre salles est à la
 * charge de l'appelant, et **aucune régénération ne doit être accordée** entre
 * deux salles.
 */
export function attemptRoom(input: AttemptRoomInput): AttemptRoomResult {
  const room = currentRoom(input.run, input.dungeon);
  if (room === null || !isRoomCleared(room, input.defeatedMonsterIds)) {
    return { run: input.run, cleared: false };
  }
  return { run: completeRoom(input.run, input.dungeon), cleared: true };
}
