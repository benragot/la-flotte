import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import type { InventoryState, ItemStack } from "../../src/engine/inventory";
import {
  attemptRoom,
  completeRoom,
  currentRoom,
  dungeonProgress,
  enterDungeon,
  isDungeonComplete,
  roomMonsters,
} from "../../src/engine/dungeon";
import type { DungeonRoom, DungeonRunState } from "../../src/engine/dungeon";

const KEY_ID = "cle_donjon_test";
const JUNK_ID = "caillou_de_cale";

const DUNGEON: DungeonDef = {
  id: "donjon_test",
  name: "Le Donjon des Tests Sans Fin",
  recommendedLevel: 10,
  keyItemId: KEY_ID,
  healBetweenRooms: 0,
  rooms: [
    {
      roomNumber: 1,
      name: "La Cour",
      mapId: "map_cour",
      isBossRoom: false,
      monsters: [
        { monsterId: "monstre_a", count: 2 },
        { monsterId: "monstre_b", count: 1 },
      ],
    },
    {
      roomNumber: 2,
      name: "Le Hangar",
      mapId: "map_hangar",
      isBossRoom: false,
      monsters: [{ monsterId: "monstre_c", count: 3 }],
    },
    {
      roomNumber: 3,
      name: "L'Atelier",
      mapId: "map_atelier",
      isBossRoom: true,
      monsters: [{ monsterId: "monstre_boss", count: 1 }],
    },
  ],
};

function makeInventory(...stacks: ItemStack[]): InventoryState {
  return { stacks, equipment: {} };
}

const WITH_KEY = makeInventory({ itemId: KEY_ID, quantity: 1 }, { itemId: JUNK_ID, quantity: 4 });
const WITHOUT_KEY = makeInventory({ itemId: JUNK_ID, quantity: 2 });

function freshRun(): DungeonRunState {
  return {
    dungeonId: DUNGEON.id,
    roomIndex: 0,
    clearedRoomNumbers: [],
    keysConsumed: 1,
    log: ["Entrée"],
  };
}

function runAt(roomIndex: number): DungeonRunState {
  return {
    ...freshRun(),
    roomIndex,
    clearedRoomNumbers: Array.from({ length: roomIndex }, (_, index) => index + 1),
  };
}

const ROOM_1_IDS = ["monstre_a", "monstre_a", "monstre_b"];
const ROOM_2_IDS = ["monstre_c", "monstre_c", "monstre_c"];
const BOSS_IDS = ["monstre_boss"];

function attempt(run: DungeonRunState, defeatedMonsterIds: readonly string[]) {
  return attemptRoom({ run, dungeon: DUNGEON, defeatedMonsterIds });
}

const REAL_DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const DATA_FILE = join(process.cwd(), "data", "dungeons.yaml");
const REAL = parseDungeonsYaml(readFileSync(DATA_FILE, "utf8")).find(
  (dungeon) => dungeon.id === REAL_DUNGEON_ID,
)!;

function enterReal(): DungeonRunState {
  const inventory = makeInventory({ itemId: REAL.keyItemId, quantity: 1 });
  return enterDungeon({ dungeon: REAL, inventory }).run!;
}

function realAttempt(run: DungeonRunState, defeatedMonsterIds: readonly string[]) {
  return attemptRoom({ run, dungeon: REAL, defeatedMonsterIds });
}

function exactIds(room: DungeonRoom): string[] {
  return room.monsters.flatMap((group) =>
    Array.from({ length: group.count }, () => group.monsterId),
  );
}

function atRealRoom(roomIndex: number): DungeonRunState {
  const clearedRoomNumbers = Array.from({ length: roomIndex }, (_, index) => index + 1);
  return { ...enterReal(), roomIndex, clearedRoomNumbers };
}

describe("enterDungeon", () => {
  it("refuse sans clé et rend l'inventaire par identité", () => {
    const result = enterDungeon({ dungeon: DUNGEON, inventory: WITHOUT_KEY });
    expect(result.run).toBeNull();
    expect(result.reason).toBe("no-key");
    expect(result.inventory).toBe(WITHOUT_KEY);
  });

  it("consomme une clé sans toucher au reste de l'inventaire", () => {
    const result = enterDungeon({ dungeon: DUNGEON, inventory: WITH_KEY });
    expect(result.reason).toBeNull();
    expect(result.run?.dungeonId).toBe(DUNGEON.id);
    expect(result.run?.roomIndex).toBe(0);
    expect(result.run?.clearedRoomNumbers).toEqual([]);
    expect(result.run?.keysConsumed).toBe(1);
    expect(result.inventory.stacks).toEqual([{ itemId: JUNK_ID, quantity: 4 }]);
    expect(WITH_KEY.stacks).toHaveLength(2);
  });

  it("laisse une clé quand l'inventaire en contient deux", () => {
    const inventory = makeInventory({ itemId: KEY_ID, quantity: 2 });
    const result = enterDungeon({ dungeon: DUNGEON, inventory });
    expect(result.inventory.stacks).toEqual([{ itemId: KEY_ID, quantity: 1 }]);
  });
});

describe("lecture de la salle courante", () => {
  it("expose la salle 1 et ses groupes de monstres", () => {
    const room = currentRoom(freshRun(), DUNGEON);
    expect(room?.roomNumber).toBe(1);
    expect(roomMonsters(room!)).toEqual([
      { monsterId: "monstre_a", count: 2 },
      { monsterId: "monstre_b", count: 1 },
    ]);
  });

  it("expose la boss room en fin de parcours", () => {
    const progress = dungeonProgress(runAt(2), DUNGEON);
    expect(progress).toEqual({ roomNumber: 3, cleared: 2, total: 3, isBossRoom: true });
  });

  it("rend null et rapporte la dernière salle quand le donjon est terminé", () => {
    const done = runAt(3);
    expect(currentRoom(done, DUNGEON)).toBeNull();
    expect(dungeonProgress(done, DUNGEON)).toEqual({
      roomNumber: 3,
      cleared: 3,
      total: 3,
      isBossRoom: true,
    });
  });
});

describe("completeRoom et isDungeonComplete", () => {
  it("avance d'une salle, journalise et n'altère pas le run d'entrée", () => {
    const run = freshRun();
    const next = completeRoom(run, DUNGEON);
    expect(next.roomIndex).toBe(1);
    expect(next.clearedRoomNumbers).toEqual([1]);
    expect(next.log.length).toBeGreaterThan(run.log.length);
    expect(run.roomIndex).toBe(0);
  });

  it("rend la même référence quand le donjon est déjà terminé", () => {
    const done = runAt(3);
    expect(completeRoom(done, DUNGEON)).toBe(done);
  });

  it("passe de faux à vrai après la troisième salle", () => {
    expect(isDungeonComplete(freshRun(), DUNGEON)).toBe(false);
    expect(isDungeonComplete(runAt(2), DUNGEON)).toBe(false);
    expect(isDungeonComplete(runAt(3), DUNGEON)).toBe(true);
  });
});

describe("attemptRoom", () => {
  it("rend le même run si un monstre manque", () => {
    const run = freshRun();
    const result = attempt(run, ["monstre_a", "monstre_a"]);
    expect(result.run).toBe(run);
    expect(result.cleared).toBe(false);
  });

  it("avance quand tous les comptes sont atteints", () => {
    const result = attempt(freshRun(), ROOM_1_IDS);
    expect(result.cleared).toBe(true);
    expect(result.run.roomIndex).toBe(1);
    expect(result.run.clearedRoomNumbers).toEqual([1]);
  });

  it("refuse un compte insuffisant (un monstre sur deux)", () => {
    const run = freshRun();
    const result = attempt(run, ["monstre_a", "monstre_b"]);
    expect(result.run).toBe(run);
    expect(result.cleared).toBe(false);
  });
});

describe("attemptRoom en séquence", () => {
  it("enchaîne les trois salles jusqu'à la complétion", () => {
    const first = attempt(freshRun(), ROOM_1_IDS);
    const second = attempt(first.run, ROOM_2_IDS);
    const third = attempt(second.run, BOSS_IDS);
    expect(third.cleared).toBe(true);
    expect(isDungeonComplete(third.run, DUNGEON)).toBe(true);
    expect(third.run.keysConsumed).toBe(1);
  });
});

describe("bornes du run", () => {
  it("rend null et roomNumber 0 avant le début (roomIndex -1)", () => {
    const before = { ...freshRun(), roomIndex: -1 };
    expect(currentRoom(before, DUNGEON)).toBeNull();
    expect(dungeonProgress(before, DUNGEON)).toEqual({
      roomNumber: 0,
      cleared: 0,
      total: 3,
      isBossRoom: false,
    });
  });
});

describe("fer_donjon_casse_vis_sans_fin — entrée et salles 1 à 3", () => {
  it("démarre à la salle 1 et débite la clé réelle", () => {
    const inventory = makeInventory({ itemId: REAL.keyItemId, quantity: 1 });
    const result = enterDungeon({ dungeon: REAL, inventory });
    expect(result.run?.roomIndex).toBe(0);
    expect(result.run?.keysConsumed).toBe(1);
    expect(result.inventory.stacks.some((stack) => stack.itemId === REAL.keyItemId)).toBe(false);
  });

  it("joue les salles 1 à 3 avec les comptes exacts et avance le curseur", () => {
    let run = enterReal();
    for (const index of [0, 1, 2]) {
      const room = REAL.rooms[index]!;
      const expected = {
        roomNumber: room.roomNumber,
        cleared: index,
        total: 4,
        isBossRoom: false,
      };
      expect(dungeonProgress(run, REAL)).toEqual(expected);
      const step = realAttempt(run, exactIds(room));
      expect(step.cleared).toBe(true);
      run = step.run;
    }
    expect(dungeonProgress(run, REAL)).toEqual({
      roomNumber: 4,
      cleared: 3,
      total: 4,
      isBossRoom: true,
    });
  });
});

describe("fer_donjon_casse_vis_sans_fin — boss room et complétion", () => {
  it("refuse la boss room si un seul des quatre groupes est vaincu", () => {
    const run = atRealRoom(3);
    const [first] = REAL.rooms[3]!.monsters;
    const partial = Array.from({ length: first!.count }, () => first!.monsterId);
    const result = realAttempt(run, partial);
    expect(result.cleared).toBe(false);
    expect(result.run).toBe(run);
  });

  it("valide la boss room quand les quatre groupes y sont", () => {
    const result = realAttempt(atRealRoom(3), exactIds(REAL.rooms[3]!));
    expect(result.cleared).toBe(true);
    expect(isDungeonComplete(result.run, REAL)).toBe(true);
  });

  it("ne complète qu'après la quatrième salle", () => {
    let run = enterReal();
    const flags: boolean[] = [];
    for (const index of [0, 1, 2, 3]) {
      flags.push(isDungeonComplete(run, REAL));
      run = realAttempt(run, exactIds(REAL.rooms[index]!)).run;
    }
    expect(flags).toEqual([false, false, false, false]);
    expect(isDungeonComplete(run, REAL)).toBe(true);
  });
});

describe("attemptRoom sur un run terminé", () => {
  it("rend la même référence et ne valide rien", () => {
    const done = runAt(3);
    const result = attempt(done, BOSS_IDS);
    expect(result.run).toBe(done);
    expect(result.cleared).toBe(false);
  });
});

describe("immuabilité et PV", () => {
  it("ne mute ni la définition du donjon ni l'inventaire ni le run", () => {
    const inventory = WITH_KEY;
    const run = freshRun();
    const snapshot = structuredClone({ dungeon: DUNGEON, inventory, run });
    enterDungeon({ dungeon: DUNGEON, inventory });
    completeRoom(run, DUNGEON);
    attemptRoom({ run, dungeon: DUNGEON, defeatedMonsterIds: ROOM_1_IDS });
    expect(structuredClone({ dungeon: DUNGEON, inventory, run })).toEqual(snapshot);
  });

  it("ne porte ni ne touche aucun PV : le carry-over appartient à l'appelant", () => {
    const carryOver = { hp: 12, maxHp: 40 };
    const snapshot = structuredClone(carryOver);
    const entered = enterDungeon({ dungeon: DUNGEON, inventory: WITH_KEY });
    const done = completeRoom(entered.run!, DUNGEON);
    expect("hp" in done).toBe(false);
    expect("maxHp" in done).toBe(false);
    expect(carryOver).toEqual(snapshot);
    expect(done).not.toBe(entered.run);
  });
});
