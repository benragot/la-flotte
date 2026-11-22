import { describe, expect, it } from "vitest";
import { initExploration } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { GridSize } from "../../src/renderer/gridProjection";
import { gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
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
