import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findPath, parseAsciiMap } from "../../src/engine/grid";
import { dungeonSchema, parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";

const DATA_DIR = join(process.cwd(), "data");
const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");

const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const mapIds = new Set(maps.map((map) => map.id));
const monsterIds = new Set(parseMonstersYaml(read("monsters.yaml")).map((monster) => monster.id));
const items = parseItemsYaml(read("items.yaml"));
const itemIds = new Set(items.map((item) => item.id));

const baseRoom = {
  roomNumber: 1,
  name: "Salle de test",
  mapId: "ferraille_plage_01",
  isBossRoom: false,
  monsters: [{ monsterId: "piou_mazoute", count: 1 }],
};

const baseDungeon = {
  id: "donjon_de_test",
  name: "Donjon de test",
  recommendedLevel: 1,
  keyItemId: "plume_mazoutee",
  rooms: [{ ...baseRoom, isBossRoom: true }],
};

const allRooms = () => dungeons.flatMap((dungeon) => dungeon.rooms);
const monsterTotal = (roomNumber: number) => {
  const room = allRooms().find((entry) => entry.roomNumber === roomNumber);
  return room?.monsters.reduce((total, group) => total + group.count, 0) ?? 0;
};

const pathsBetweenSpawns = (grid: string[]): boolean => {
  const map = parseAsciiMap(grid);
  const maxPm = map.width * map.height;
  const reachable = (from: { x: number; y: number }) =>
    map.monsterSpawns.every((to) => findPath({ map, from, to, maxPm }) !== null);
  return map.playerSpawns.every(reachable);
};

describe("dungeons.yaml — structure", () => {
  it("décrit la Casse aux Vis-Sans-Fin et ses quatre salles", () => {
    expect(dungeons).toHaveLength(1);
    const [dungeon] = dungeons;
    expect(dungeon?.id).toBe("fer_donjon_casse_vis_sans_fin");
    expect(dungeon?.name).toBe("La Casse aux Vis-Sans-Fin");
    expect(dungeon?.recommendedLevel).toBe(16);
    expect(dungeon?.rooms.map((room) => room.roomNumber)).toEqual([1, 2, 3, 4]);
  });

  it("place exactement une boss room, en dernière position", () => {
    const rooms = allRooms();
    const bossRooms = rooms.filter((room) => room.isBossRoom);
    expect(bossRooms).toHaveLength(1);
    expect(bossRooms[0]).toBe(rooms[rooms.length - 1]);
    expect(bossRooms[0]?.mapId).toBe("fer_salle_atelier_yvon");
  });

  it("respecte les effectifs de la fiche : 3, 4, 4 puis 4 monstres", () => {
    allRooms().forEach((room) => {
      room.monsters.forEach((group) => expect(group.count).toBeGreaterThanOrEqual(1));
    });
    expect([1, 2, 3, 4].map(monsterTotal)).toEqual([3, 4, 4, 4]);
  });
});

describe("dungeons.yaml — références et praticabilité", () => {
  it("ne référence que des monstres et des salles existants", () => {
    allRooms().forEach((room) => {
      expect(mapIds.has(room.mapId), `${room.mapId} absent de maps.yaml`).toBe(true);
      room.monsters.forEach((group) => {
        expect(monsterIds.has(group.monsterId), `${group.monsterId} absent de monsters.yaml`).toBe(true);
      });
    });
  });

  it("référence une clef de donjon réellement présente dans items.yaml", () => {
    dungeons.forEach((dungeon) => {
      const known = itemIds.has(dungeon.keyItemId);
      expect(known, `${dungeon.keyItemId} absent d'items.yaml`).toBe(true);
    });
  });
});

describe("dungeons.yaml — cohérence de la clef", () => {
  const keyOf = (dungeon: (typeof dungeons)[number]) => {
    const key = items.find((item) => item.id === dungeon.keyItemId);
    expect(key, `${dungeon.keyItemId} absent d'items.yaml`).toBeDefined();
    if (key?.category !== "key") throw new Error(`${dungeon.keyItemId} n'est pas une clef`);
    return key;
  };

  it("donne à la clef la catégorie key et le donjon ciblé", () => {
    dungeons.forEach((dungeon) => {
      expect(keyOf(dungeon).targetDungeonId).toBe(dungeon.id);
    });
  });

  it("relie la clef et son donjon dans les deux sens", () => {
    dungeons.forEach((dungeon) => {
      const key = keyOf(dungeon);
      const target = dungeons.find((entry) => entry.id === key.targetDungeonId);
      expect(target?.keyItemId, `${key.targetDungeonId} ne référence pas ${key.id}`).toBe(key.id);
    });
  });
});

describe("dungeons.yaml — praticabilité", () => {
  it("garde chaque salle praticable du placement joueur au placement monstre", () => {
    allRooms().forEach((room) => {
      const map = maps.find((entry) => entry.id === room.mapId);
      if (map === undefined) throw new Error(`introuvable: ${room.mapId}`);
      expect(pathsBetweenSpawns(map.grid), room.mapId).toBe(true);
    });
  });
});

describe("rejets Zod du dungeonSchema", () => {
  it("refuse des numéros de salle non consécutifs", () => {
    const rooms = [baseRoom, { ...baseRoom, roomNumber: 3, isBossRoom: true }];
    expect(() => dungeonSchema.parse({ ...baseDungeon, rooms })).toThrow(/consécutif/);
  });

  it("refuse deux boss rooms", () => {
    const bossRoom = { ...baseRoom, isBossRoom: true };
    const rooms = [bossRoom, { ...bossRoom, roomNumber: 2 }];
    expect(() => dungeonSchema.parse({ ...baseDungeon, rooms })).toThrow(/boss room/);
  });

  it("refuse une dernière salle qui n'est pas la boss room", () => {
    const rooms = [{ ...baseRoom, isBossRoom: true }, { ...baseRoom, roomNumber: 2 }];
    expect(() => dungeonSchema.parse({ ...baseDungeon, rooms })).toThrow(/dernière salle/);
  });

  it("refuse un groupe de zéro monstre", () => {
    const monstrous = { ...baseRoom, monsters: [{ monsterId: "piou_mazoute", count: 0 }] };
    expect(() => dungeonSchema.parse({ ...baseDungeon, rooms: [monstrous] })).toThrow(/count/);
  });

  it("refuse une clef vide", () => {
    expect(() => dungeonSchema.parse({ ...baseDungeon, keyItemId: "" })).toThrow(/keyItemId/);
  });

  it("refuse `quantity` au lieu de `count`", () => {
    const monsters = [{ monsterId: "piou_mazoute", quantity: 2 }];
    expect(() => dungeonSchema.parse({ ...baseDungeon, rooms: [{ ...baseRoom, monsters }] })).toThrow(/count/);
  });

  it("refuse une clé inconnue à la racine d'un donjon", () => {
    expect(() => dungeonSchema.parse({ ...baseDungeon, drops: [] })).toThrow(/drops/);
  });
});
