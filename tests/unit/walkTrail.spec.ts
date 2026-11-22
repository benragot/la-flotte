import { describe, expect, it } from "vitest";
import type { Position } from "../../src/engine/grid";
import type { TileView } from "../../src/renderer/scene";
import type { TokenView } from "../../src/renderer/tokens";
import { STATIC_TOKEN_SPRITE, playerTokenView } from "../../src/renderer/tokens";
import { WALK_MS_PER_CELL } from "../../src/renderer/sprites/walkMotion";
import { attachTrails, cellCenters, trailPlan } from "../../src/renderer/walkTrail";
import type { TrailBatch } from "../../src/store/trails";

/**
 * Séparation nette : `ViewModel.path` reste l'**aperçu de survol** peint par
 * `drawPath` ; le trajet réel voyage sur le jeton (`TokenView.trail`) et ne
 * pilote que le glissement du sprite. Aucun des deux ne lit l'autre.
 */
const ORIGIN = { x: 0, y: 0, scale: 1 };
const CELLS: readonly Position[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 2, y: 1 },
];

function tile(cell: Position): TileView {
  return { position: cell, center: { x: cell.x * 64, y: cell.y * 32 } } as unknown as TileView;
}

function centres() {
  return cellCenters(CELLS.map(tile));
}

function token(cell: Position, id = "player"): TokenView {
  return { ...playerTokenView(cell, ORIGIN, { ...STATIC_TOKEN_SPRITE, spriteId: "iop" }), id };
}

function batch(cells: readonly Position[], version = 1): TrailBatch {
  return { version, trails: [{ id: "player", cells }] };
}

describe("attachTrails — le trajet réel, distinct de l'aperçu", () => {
  it("attache le trajet qui se termine sur la case du jeton", () => {
    const trail = attachTrails([token({ x: 2, y: 1 })], batch([{ x: 1, y: 1 }, { x: 2, y: 1 }]))[0]?.trail;
    expect(trail?.cells).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    expect(trail?.signature).toBe("player-1");
  });

  it("ignore un trajet périmé qui ne finit pas sur la case du jeton", () => {
    const tokens = attachTrails([token({ x: 0, y: 0 })], batch([{ x: 1, y: 1 }, { x: 2, y: 1 }]));
    expect(tokens[0]?.trail).toBeNull();
  });

  it("ne touche à rien sans lot de trajets", () => {
    const tokens = attachTrails([token({ x: 0, y: 0 })], null);
    expect(tokens[0]?.trail).toBeUndefined();
  });

  it("change de signature à chaque version, même trajet identique", () => {
    const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const first = attachTrails([token({ x: 1, y: 0 })], batch(cells, 1))[0]?.trail;
    const second = attachTrails([token({ x: 1, y: 0 })], batch(cells, 2))[0]?.trail;
    expect(first?.signature).not.toBe(second?.signature);
  });
});

describe("trailPlan — le nombre de segments est celui du moteur", () => {
  it("une diagonale du moteur ne coûte qu'un segment, donc 150 ms", () => {
    const diagonal = trailsOf([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    const plan = trailPlan(diagonal, centres());
    expect(plan?.points).toHaveLength(2);
    expect(plan?.durationMs).toBe(WALK_MS_PER_CELL);
  });

  it("un chemin 8 directions garde exactement ses cases", () => {
    const path = trailsOf([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);
    const plan = trailPlan(path, centres());
    expect(plan?.points).toEqual([
      { x: 0, y: 0 },
      { x: 64, y: 0 },
      { x: 64, y: 32 },
      { x: 128, y: 32 },
    ]);
    expect(plan?.durationMs).toBe(3 * WALK_MS_PER_CELL);
  });

  it("refuse de raccourcir un trajet dont une case n'a pas de centre connu", () => {
    const path = trailsOf([{ x: 0, y: 0 }, { x: 7, y: 7 }]);
    expect(trailPlan(path, centres())).toBeNull();
  });
});

function trailsOf(cells: readonly Position[]) {
  const trail = attachTrails([token(cells.at(-1) ?? { x: 0, y: 0 })], batch(cells))[0]?.trail;
  if (trail === null || trail === undefined) throw new Error("trajet attendu");
  return trail;
}

/** Le champ des centres ignore les contours : ici, c'est de la projection, pas du pathfinding. */
describe("cellCenters — projection seule", () => {
  it("indexe chaque case peinte par sa coordonnée", () => {
    const map = cellCenters(CELLS.map(tile));
    expect(map.get("2:1")).toEqual({ x: 128, y: 32 });
  });
});
