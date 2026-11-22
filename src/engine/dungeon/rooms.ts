import type { DungeonDef, DungeonMonsterGroup } from "../../schemas/dungeonSchema";
import type { DungeonProgress, DungeonRoom, DungeonRunState } from "./types";

export function currentRoom(run: DungeonRunState, dungeon: DungeonDef): DungeonRoom | null {
  return dungeon.rooms[run.roomIndex] ?? null;
}

function lastRoom(dungeon: DungeonDef): DungeonRoom | null {
  return dungeon.rooms[dungeon.rooms.length - 1] ?? null;
}

/** Recopie les groupes de monstres pour ne pas exposer le schéma au monde. */
export function roomMonsters(room: DungeonRoom): DungeonMonsterGroup[] {
  return room.monsters.map((group) => ({ monsterId: group.monsterId, count: group.count }));
}

export function isDungeonComplete(run: DungeonRunState, dungeon: DungeonDef): boolean {
  return run.roomIndex >= dungeon.rooms.length;
}

function progressRoom(run: DungeonRunState, dungeon: DungeonDef): DungeonRoom | null {
  return currentRoom(run, dungeon) ?? lastRoom(dungeon);
}

function numberOrZero(room: DungeonRoom | null): number {
  return room?.roomNumber ?? 0;
}

/** Une fois le donjon terminé, la dernière salle visitée (la boss room) est rapportée. */
export function dungeonProgress(run: DungeonRunState, dungeon: DungeonDef): DungeonProgress {
  const room = progressRoom(run, dungeon);
  return {
    roomNumber: numberOrZero(room),
    cleared: run.clearedRoomNumbers.length,
    total: dungeon.rooms.length,
    isBossRoom: room?.isBossRoom ?? false,
  };
}
