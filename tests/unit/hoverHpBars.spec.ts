import { describe, expect, it } from "vitest";
import type { Position } from "../../src/engine/grid";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";
import { TILE_H, TILE_W } from "../../src/renderer/gridProjection";
import type { TokenView } from "../../src/renderer/tokens";
import {
  HP_BAR_HEIGHT,
  HP_BAR_LIFT_TILES,
  HP_BAR_WIDTH,
  STATIC_TOKEN_SPRITE,
  hpBarFor,
  hoveredHpBarTokens,
} from "../../src/renderer/tokens";

const VIEWPORT = { width: 1024, height: 768 };

/** Jeton minimal : la barre de survol ne lit que la case logique et le centre. */
function token(id: string, cell: Position, center: { x: number; y: number } = { x: 100, y: 80 }): TokenView {
  return {
    id,
    cell,
    center,
    radius: 12,
    scale: 1,
    fill: 0x3f7fd6,
    hp: 10,
    maxHp: 20,
    hpRatio: 0.5,
    badge: null,
    name: null,
    depth: 0,
    active: false,
    ...STATIC_TOKEN_SPRITE,
  };
}

describe("barre de PV de survol — une seule, sur la case logique survolée (§6 R4)", () => {
  it("ne garde que le jeton dont la case logique est survolée", () => {
    const hovered = token("b", { x: 2, y: 3 });
    const others = [token("a", { x: 1, y: 3 }), token("c", { x: 2, y: 4 })];
    expect(hoveredHpBarTokens([...others, hovered], { x: 2, y: 3 })).toEqual([hovered]);
  });

  it("ne peint aucune barre sans survol", () => {
    expect(hoveredHpBarTokens([token("a", { x: 0, y: 0 })], null)).toEqual([]);
  });

  it("ne peint aucune barre quand la case survolée est vide", () => {
    expect(hoveredHpBarTokens([token("a", { x: 0, y: 0 })], { x: 5, y: 5 })).toEqual([]);
  });

  it("ne retient qu'une barre parmi plusieurs jetons, pas N", () => {
    const tokens = [token("a", { x: 0, y: 0 }), token("b", { x: 1, y: 0 }), token("c", { x: 2, y: 0 })];
    expect(hoveredHpBarTokens(tokens, { x: 1, y: 0 })).toHaveLength(1);
  });
});

describe("géométrie de la barre de survol — valeurs exactes de §5", () => {
  it("mesure 0.55 × TILE_W de large et 4 px de haut", () => {
    expect(HP_BAR_WIDTH).toBe(TILE_W * 0.55);
    expect(HP_BAR_HEIGHT).toBe(4);
    expect(HP_BAR_LIFT_TILES).toBe(2.6);
  });

  it("se pose à -2.6 × TILE_H du centre du losange, centrée sur le jeton", () => {
    const bar = hpBarFor(token("a", { x: 0, y: 0 }, { x: 100, y: 80 }));
    expect(bar.width).toBe(TILE_W * 0.55);
    expect(bar.height).toBe(4);
    expect(bar.x).toBe(100 - (TILE_W * 0.55) / 2);
    expect(bar.y).toBe(80 - TILE_H * 2.6);
  });
});

describe("survol en exploration — aucune barre, même sur le héros", () => {
  it("reste vide quand la case du héros est survolée", () => {
    const exploration = { playerPos: { x: 2, y: 3 }, groups: [] };
    const view = buildExplorationViewModel({ exploration, viewport: VIEWPORT });
    const hero = view.tokens[0];
    if (hero === undefined) throw new Error("jeton du héros attendu");
    expect(view.hpBarTokens).toHaveLength(0);
    expect(hoveredHpBarTokens(view.hpBarTokens, hero.cell)).toEqual([]);
  });
});
