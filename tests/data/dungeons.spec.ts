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
const itemIds = new Set(parseItemsYaml(read("items.yaml")).map((item) => item.id));

// D48 (2026-11-22) : `itemSchema` n'a pas de catégorie `key`, donc
// `cle_donjon_ile_de_la_ferraille` ne peut pas encore vivre dans items.yaml.
// Allowlist fail-closed : un seul id, absent des items, et ce test casse
// dès que la clef est réellement livrée (il faudra supprimer l'allowlist).
const PENDING_KEY_ITEM_IDS = ["cle_donjon_ile_de_la_ferraille"];

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

  it("référence une clef de donjon connue ou déclarée en attente", () => {
    dungeons.forEach((dungeon) => {
      const known = itemIds.has(dungeon.keyItemId) || PENDING_KEY_ITEM_IDS.includes(dungeon.keyItemId);
      expect(known, `${dungeon.keyItemId} absent d'items.yaml`).toBe(true);
    });
  });

  it("garde l'allowlist de clefs fail-closed (D48)", () => {
    expect(PENDING_KEY_ITEM_IDS).toHaveLength(1);
    PENDING_KEY_ITEM_IDS.forEach((id) => expect(itemIds.has(id), `${id} est livré : retire l'allowlist`).toBe(false));
  });

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
