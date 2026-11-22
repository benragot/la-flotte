import { describe, expect, it, vi } from "vitest";
import type { Position } from "../../src/engine/grid";
import type { FakeNode } from "./support/fakePixi";
import type { GridOutline, TileView } from "../../src/renderer/scene";
import type { TokenView } from "../../src/renderer/tokens";
import { STATIC_TOKEN_SPRITE } from "../../src/renderer/tokens";
import { walkField } from "../../src/renderer/sprites/walkPath";
import { WALK_MS_PER_CELL } from "../../src/renderer/sprites/walkMotion";

vi.mock("pixi.js", async () => {
  const { FakeAnimatedSprite, FakeGraphics, FakeNode: Node } = await import("./support/fakePixi");
  const Assets = { load: () => new Promise(() => undefined) };
  return {
    AnimatedSprite: FakeAnimatedSprite,
    Container: Node,
    Graphics: FakeGraphics,
    Assets,
    Texture: class {},
    Rectangle: class {},
  };
});

const { ActorStage } = await import("../../src/renderer/sprites/actorStage");

const SHEET = "/assets/sprites/iop.svg";
/** Trajet unique en L : (0,0) → (1,0) → (1,1), sans raccourci diagonal possible. */
const FIELD_CELLS: readonly Position[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
];
const SHEET_SPEC = {
  entityId: "iop",
  path: SHEET,
  frameWidth: 64,
  frameHeight: 64,
  animations: { idle: { row: 0, frames: 4, fps: 6, loop: true }, walk: { row: 1, frames: 4, fps: 6, loop: true }, attack: { row: 2, frames: 4, fps: 6, loop: false }, hit: { row: 3, frames: 4, fps: 6, loop: false } },
};

function centre(cell: Position) {
  return { x: cell.x * 64, y: cell.y * 32 };
}

function field() {
  const tiles = FIELD_CELLS.map((cell) => ({ position: cell, center: centre(cell) }) as unknown as TileView);
  const outlines = FIELD_CELLS.map((cell) => ({ cell }) as unknown as GridOutline);
  return walkField(tiles, outlines);
}

function token(cell: Position): TokenView {
  return { id: "player", cell, center: centre(cell), radius: 12, scale: 1, fill: 0, hp: 1, maxHp: 1, hpRatio: 1, badge: null, name: null, depth: cell.x + cell.y, active: false, ...STATIC_TOKEN_SPRITE, spriteId: "iop" };
}

function stage(): InstanceType<typeof ActorStage> {
  return new ActorStage([SHEET_SPEC]);
}

function nodeOf(carrier: InstanceType<typeof ActorStage>): FakeNode {
  return carrier.container.children[0] as unknown as FakeNode;
}

function sync(carrier: InstanceType<typeof ActorStage>, cell: Position): void {
  carrier.sync({ tokens: [token(cell)], onReady: () => undefined, field: field() });
}

describe("ActorStage — le hero glisse, le moteur reste instantané", () => {
  it("un spawn se pose sur sa case : aucune animation depuis l'origine", () => {
    const carrier = stage();
    sync(carrier, { x: 1, y: 1 });
    expect(nodeOf(carrier).position).toMatchObject({ x: 64, y: 32 });
  });

  it("après un pas, la position peinte reste au départ jusqu'au tick suivant", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    sync(carrier, { x: 1, y: 0 });
    expect(nodeOf(carrier).position.x).toBe(0);
    carrier.advance(WALK_MS_PER_CELL / 2);
    expect(nodeOf(carrier).position.x).toBeCloseTo(32, 6);
    carrier.advance(WALK_MS_PER_CELL);
    expect(nodeOf(carrier).position.x).toBe(64);
  });

});

describe("ActorStage — annulation et cas limites", () => {
  it("un second déplacement pendant l'animation remplace le premier, sans empilement", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    sync(carrier, { x: 1, y: 0 });
    carrier.advance(50);
    sync(carrier, { x: 1, y: 1 });
    carrier.advance(WALK_MS_PER_CELL * 2);
    expect(nodeOf(carrier).position).toMatchObject({ x: 64, y: 32 });
  });

  it("un déplacement de zéro case ne déclenche aucune animation", () => {
    const carrier = stage();
    sync(carrier, { x: 1, y: 0 });
    sync(carrier, { x: 1, y: 0 });
    expect(carrier.advance(50)).toBe(false);
    expect(nodeOf(carrier).position.x).toBe(64);
  });

  it("un trajet de plusieurs cases passe par la case intermédiaire, pas en diagonale", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    sync(carrier, { x: 1, y: 1 });
    carrier.advance(WALK_MS_PER_CELL);
    expect(nodeOf(carrier).position).toMatchObject({ x: 64, y: 0 });
    carrier.advance(WALK_MS_PER_CELL * 2);
    expect(nodeOf(carrier).position).toMatchObject({ x: 64, y: 32 });
  });

  it("sans chemin connu dans la scène, l'acteur se pose au lieu de glisser", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    carrier.sync({ tokens: [token({ x: 9, y: 9 })], onReady: () => undefined, field: field() });
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 9, y: 9 }));
    expect(carrier.advance(50)).toBe(false);
  });

});

describe("ActorStage — changement de scène", () => {
  it("un changement de carte pose le héros : aucun trajet ne traverse la nouvelle scène", () => {
    const carrier = stage();
    const fieldOf = field();
    carrier.sync({ tokens: [token({ x: 0, y: 0 })], onReady: () => undefined, field: fieldOf, scene: { id: "plage" } });
    carrier.sync({ tokens: [token({ x: 1, y: 1 })], onReady: () => undefined, field: fieldOf, scene: { id: "donjon" } });
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 1 }));
    expect(carrier.advance(200)).toBe(false);
  });

  it("sur la même carte, la case mémorisée déclenche bien le glissement", () => {
    const carrier = stage();
    const fieldOf = field();
    const scene = { id: "plage" };
    carrier.sync({ tokens: [token({ x: 0, y: 0 })], onReady: () => undefined, field: fieldOf, scene });
    carrier.sync({ tokens: [token({ x: 1, y: 1 })], onReady: () => undefined, field: fieldOf, scene });
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 0, y: 0 }));
    expect(carrier.advance(75)).toBe(true);
  });

  it("détruit l'acteur absent : aucun glissement fantôme, aucune exception", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    carrier.sync({ tokens: [], onReady: () => undefined, field: field() });
    expect(carrier.container.children).toHaveLength(0);
    sync(carrier, { x: 1, y: 1 });
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 1 }));
    expect(carrier.advance(200)).toBe(false);
  });
});
