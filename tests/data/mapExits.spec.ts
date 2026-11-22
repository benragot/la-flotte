import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MapDef } from "../../src/schemas/mapSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { mapSchema, mapsFileSchema, parseMapsYaml } from "../../src/schemas/mapSchema";

/**
 * Les « soleils » de Dofus : une carte d'extérieur porte des sorties `exits`
 * qui la relient à ses voisines. Ce fichier verrouille la DONNÉE — schéma,
 * bornes, intégrité référentielle — et la chaîne d'accessibilité réelle de
 * `data/maps.yaml`, pas une carte recopiée en dur.
 */
const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
const maps = parseMapsYaml(raw);

const BEACH_ID = "ferraille_plage_01";
/** Carte de test minimale : un `P`, un `M`, 4×4. */
const BASE_MAP = {
  id: "ile_test",
  name: "Île de test",
  width: 4,
  height: 4,
  grid: ["P...", "....", "....", "...M"],
};
const NEIGHBOUR = { ...BASE_MAP, id: "ile_voisine", name: "Île voisine" };

/** Entrée de sortie valide : bord est de `BASE_MAP`. */
const EXIT = { x: 3, y: 2, to: "ile_voisine" };

function fileOf(...entries: unknown[]) {
  return { maps: entries };
}

function mapWithExit(exit: unknown) {
  return { ...BASE_MAP, exits: [exit] };
}

const plage = (): MapDef => {
  const found = maps.find((map) => map.id === BEACH_ID);
  if (found === undefined) throw new Error(`${BEACH_ID} absente de data/maps.yaml`);
  return found;
};

const dungeonRooms = (): MapDef[] => maps.filter((map) => map.id.startsWith("fer_salle_"));

function reachableIds(startId: string): Set<string> {
  const byId = new Map(maps.map((map) => [map.id, map]));
  const seen = new Set<string>([startId]);
  const queue: string[] = [startId];
  while (queue.length > 0) {
    const current = byId.get(queue.shift() ?? "");
    for (const exit of current?.exits ?? []) {
      if (seen.has(exit.to)) continue;
      seen.add(exit.to);
      queue.push(exit.to);
    }
  }
  return seen;
}

function symbolsOf(map: MapDef): string {
  return map.grid.join("");
}

describe("mapSchema — les sorties de carte", () => {
  it("accepte une sortie et sa case d'arrivée optionnelle", () => {
    const parsed = mapsFileSchema.parse(fileOf(mapWithExit({ ...EXIT, at: { x: 1, y: 2 } }), NEIGHBOUR));
    expect(parsed.maps[0]?.exits).toEqual([{ ...EXIT, at: { x: 1, y: 2 } }]);
  });

  it("donne une liste vide par défaut, pour ne casser aucune carte existante", () => {
    expect(mapSchema.parse(BASE_MAP).exits).toEqual([]);
  });

  it("refuse une sortie vers une carte inexistante", () => {
    const broken = fileOf(mapWithExit({ ...EXIT, to: "ile_fantome" }), NEIGHBOUR);
    expect(() => mapsFileSchema.parse(broken)).toThrow(/ile_fantome/);
  });

  it("refuse une sortie hors de la grille", () => {
    expect(mapSchema.safeParse(mapWithExit({ ...EXIT, x: 4 })).success).toBe(false);
    expect(mapSchema.safeParse(mapWithExit({ ...EXIT, y: -1 })).success).toBe(false);
  });

  it("refuse une clé inconnue dans une entrée de sortie (schéma strict)", () => {
    expect(mapSchema.safeParse(mapWithExit({ ...EXIT, dest: "ile_voisine" })).success).toBe(false);
  });

  it("refuse une destination vide", () => {
    expect(mapSchema.safeParse(mapWithExit({ ...EXIT, to: "" })).success).toBe(false);
  });

  it("laisse les quatre salles de donjon sans sortie", () => {
    const rooms = dungeonRooms();
    expect(rooms).toHaveLength(4);
    rooms.forEach((room) => expect(room.exits).toEqual([]));
  });
});

describe("mapSchema — la case d'arrivée `at`", () => {
  it("accepte une arrivée dans la grille de destination", () => {
    const parsed = mapsFileSchema.parse(fileOf(mapWithExit({ ...EXIT, at: { x: 1, y: 2 } }), NEIGHBOUR));
    expect(parsed.maps[0]?.exits[0]?.at).toEqual({ x: 1, y: 2 });
  });

  it("refuse une case d'arrivée hors de la grille d'arrivée", () => {
    const huge = fileOf(mapWithExit({ ...EXIT, at: { x: 4999, y: 4999 } }), NEIGHBOUR);
    expect(() => mapsFileSchema.parse(huge)).toThrow(/arrivée/);
    const justOutside = fileOf(mapWithExit({ ...EXIT, at: { x: 4, y: 0 } }), NEIGHBOUR);
    expect(() => mapsFileSchema.parse(justOutside)).toThrow(/arrivée/);
  });

  it("borne l'arrivée sur la carte de destination, pas sur celle de départ", () => {
    const big = { ...NEIGHBOUR, width: 6, height: 6, grid: ["P.....", "......", "......", "......", "......", ".....M"] };
    const parsed = mapsFileSchema.parse(fileOf(mapWithExit({ ...EXIT, at: { x: 5, y: 5 } }), big));
    expect(parsed.maps[0]?.exits[0]?.at).toEqual({ x: 5, y: 5 });
  });
});

function outdoorMaps(): MapDef[] {
  const reached = reachableIds(BEACH_ID);
  return maps.filter((map) => reached.has(map.id) && map.id !== BEACH_ID && !map.id.startsWith("fer_salle_"));
}

function expectOutdoor(map: MapDef): void {
  expect(map.width, `${map.id} trop étroite`).toBeGreaterThanOrEqual(10);
  expect(map.height, `${map.id} trop courte`).toBeGreaterThanOrEqual(10);
  expect(map.id.startsWith("ferraille_"), `${map.id} mal préfixée`).toBe(true);
  expect(symbolsOf(map).includes("M"), `${map.id} porte un M`).toBe(false);
  expect(symbolsOf(map).split("P"), `${map.id} n'a pas exactement un P`).toHaveLength(2);
}

describe("data/maps.yaml — les cartes d'extérieur reliées", () => {
  it("la plage propose au moins une sortie", () => {
    expect(plage().exits.length).toBeGreaterThanOrEqual(1);
  });

  it("la grille et le décor de la plage n'ont pas bougé", () => {
    expect(plage().width).toBe(12);
    expect(plage().height).toBe(12);
    expect(plage().grid[3]?.[3]).toBe("P");
    expect(plage().grid[0]?.[0]).toBe("~");
  });

  it("mène à deux cartes d'extérieur de 10×10 au moins, sans monstre", () => {
    const outdoors = outdoorMaps();
    expect(outdoors.length).toBeGreaterThanOrEqual(2);
    outdoors.forEach(expectOutdoor);
  });

  it("les deux cartes se répondent (aller-retour par les sorties)", () => {
    const [first, second] = outdoorMaps();
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) return;
    expect(reachableIds(first.id).has(second.id), `${first.id} ne rejoint pas ${second.id}`).toBe(true);
    expect(reachableIds(second.id).has(first.id), `${second.id} ne rejoint pas ${first.id}`).toBe(true);
  });

  it("chaque sortie tombe sur une case praticable de sa propre carte", () => {
    maps.forEach((map) => {
      map.exits.forEach((exit) => {
        const cell = map.grid[exit.y]?.[exit.x];
        expect(cell, `${map.id}: sortie (${exit.x},${exit.y}) hors grille`).toBeDefined();
        expect(cell, `${map.id}: sortie (${exit.x},${exit.y}) impraticable`).not.toBe("#");
        expect(cell, `${map.id}: sortie (${exit.x},${exit.y}) dans l'eau`).not.toBe("~");
      });
    });
  });
});

describe("data/maps.yaml — les salles de donjon gardent leurs monstres", () => {
  /**
   * `initExploration` tolère désormais une carte sans `M` (cartes d'extérieur).
   * Sans ce garde-fou de DONNÉES, une salle de donjon qui perdrait tous ses `M`
   * se chargerait vide, en silence. Les salles sont lues dans `dungeons.yaml`.
   */
  const roomMapIds = parseDungeonsYaml(readFileSync(join(process.cwd(), "data", "dungeons.yaml"), "utf8"))
    .flatMap((dungeon) => dungeon.rooms.map((room) => room.mapId));

  it("lit bien quatre salles de donjon dans dungeons.yaml", () => {
    expect(roomMapIds).toHaveLength(4);
  });

  it.each(roomMapIds)("la salle %s contient au moins un M", (mapId) => {
    const room = maps.find((map) => map.id === mapId);
    expect(room, `${mapId} est absente de maps.yaml`).toBeDefined();
    if (room === undefined) return;
    expect(symbolsOf(room).includes("M"), `${mapId} n'a aucun M : la salle se chargerait vide`).toBe(true);
  });
});
