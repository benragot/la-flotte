import { describe, expect, it } from "vitest";
import { initExploration } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { GridSize } from "../../src/renderer/gridProjection";
import { TILE_H, TILE_W, gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import { cellFromPointer } from "../../src/renderer/pointer";
import { cellAtPoint } from "../../src/ui/explorationView";

/**
 * L'échelle « cover » vit dans l'origine : ces tests prouvent que le clic est
 * bien divisé par elle, sur les **deux** chemins pointeur (combat PixiJS et
 * exploration DOM). Un clic qui partirait ailleurs que la case visée serait
 * plus grave que le décalage visuel corrigé ici.
 */
const MAP_SIZE: GridSize = { width: 12, height: 12 };
const ARENA: GridSize = { width: 1024, height: 570 };
const LARGE: GridSize = { width: 1920, height: 1080 };
const VIEWPORTS = [ARENA, LARGE];

/** Carte 12x12 minimale : héros `P` au centre, groupe `M` en bas à droite. */
const ROWS = [
  "............",
  "............",
  "............",
  "............",
  "............",
  ".....P......",
  "............",
  "............",
  "............",
  "............",
  "..........M.",
  "............",
];

const SPAWN = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };

function cellsOf(map: GridSize): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function screenCenter(cell: { x: number; y: number }, viewport: GridSize) {
  return gridToIso({ ...cell, origin: sceneOrigin(MAP_SIZE, viewport) });
}

function explorationState() {
  return initExploration({ map: parseAsciiMap(ROWS), ...SPAWN });
}

describe("pointeur combat — clic → case malgré l'échelle cover", () => {
  it("retombe sur la case cliquée, pour toutes les cases et deux arènes", () => {
    VIEWPORTS.forEach((viewport) => {
      const layout = { ...MAP_SIZE, origin: sceneOrigin(MAP_SIZE, viewport) };
      cellsOf(MAP_SIZE).forEach((cell) => {
        expect(cellFromPointer(screenCenter(cell, viewport), layout)).toEqual(cell);
      });
    });
  });

  it("trouve une case au centre de l'arène, jamais le vide", () => {
    VIEWPORTS.forEach((viewport) => {
      const layout = { ...MAP_SIZE, origin: sceneOrigin(MAP_SIZE, viewport) };
      const center = { x: viewport.width / 2, y: viewport.height / 2 };
      expect(cellFromPointer(center, layout)).not.toBeNull();
    });
  });
});

describe("pointeur exploration — clic DOM → case malgré l'échelle cover", () => {
  it("retombe sur la case cliquée, pour toutes les cases et deux arènes", () => {
    const exploration = explorationState();
    VIEWPORTS.forEach((viewport) => {
      cellsOf(MAP_SIZE).forEach((cell) => {
        const point = screenCenter(cell, viewport);
        expect(cellAtPoint({ exploration, point, viewport })).toEqual(cell);
      });
    });
  });

  it("trouve la case du héros au centre de l'arène", () => {
    const exploration = explorationState();
    const point = { x: ARENA.width / 2, y: ARENA.height / 2 };
    expect(cellAtPoint({ exploration, point, viewport: ARENA })).not.toBeNull();
  });
});

/**
 * Les trois arènes **réellement mesurées en jeu** après #68 : le facteur
 * `arenaScale = min(coverScale, cornerSafeScale)` y vaut ×1,33, ×1,45 et ×2,19.
 * Un joueur ne vise pas le centre exact du losange : le clic doit tolérer une
 * imprécision à l'intérieur de la case, et refuser le vide hors de la carte.
 */
interface RealArena {
  viewport: GridSize;
  scale: number;
}

const REAL_ARENAS: readonly RealArena[] = [
  { viewport: { width: 1024, height: 480 }, scale: 4 / 3 },
  { viewport: { width: 1024, height: 570 }, scale: 16 / 11 },
  { viewport: { width: 1664, height: 840 }, scale: 2.1875 },
];

/** Demi-tuile écran de l'origine, pour viser le centre du losange d'une case. */
function halfTile(origin: { scale?: number }): { x: number; y: number } {
  const scale = origin.scale ?? 1;
  return { x: (TILE_W / 2) * scale, y: (TILE_H / 2) * scale };
}

function clickNear(cell: { x: number; y: number }, viewport: GridSize, ratio: number) {
  const origin = sceneOrigin(MAP_SIZE, viewport);
  const center = gridToIso({ ...cell, origin });
  const half = halfTile(origin);
  return { x: center.x + half.x * ratio, y: center.y + half.y * ratio };
}

describe("pointeur exploration — clic réel aux trois échelles de #68", () => {
  it("applique bien ×1,33 / ×1,45 / ×2,19 : l'échelle testée est celle du jeu", () => {
    REAL_ARENAS.forEach(({ viewport, scale }) => {
      expect(sceneOrigin(MAP_SIZE, viewport).scale).toBeCloseTo(scale, 4);
    });
  });

  it("retombe sur la case visée depuis le centre de chacune des 144 cases", () => {
    const exploration = explorationState();
    REAL_ARENAS.forEach(({ viewport }) => {
      cellsOf(MAP_SIZE).forEach((cell) => {
        expect(cellAtPoint({ exploration, point: screenCenter(cell, viewport), viewport })).toEqual(cell);
      });
    });
  });

  it("tolère un clic décalé dans le losange, sur les bords et les coins de la carte", () => {
    const exploration = explorationState();
    const borders = [{ x: 0, y: 0 }, { x: 11, y: 0 }, { x: 0, y: 11 }, { x: 11, y: 11 }, { x: 6, y: 6 }];
    REAL_ARENAS.forEach(({ viewport }) => {
      borders.forEach((cell) => {
        [0.25, -0.25].forEach((ratio) => {
          expect(cellAtPoint({ exploration, point: clickNear(cell, viewport, ratio), viewport })).toEqual(cell);
        });
      });
    });
  });

  it("refuse le clic hors du losange, au-dessus du sommet de la carte", () => {
    const exploration = explorationState();
    REAL_ARENAS.forEach(({ viewport }) => {
      const origin = sceneOrigin(MAP_SIZE, viewport);
      const point = { x: origin.x, y: origin.y - 40 };
      expect(cellAtPoint({ exploration, point, viewport })).toBeNull();
    });
  });
});
