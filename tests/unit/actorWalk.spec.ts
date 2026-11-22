import { describe, expect, it, vi } from "vitest";
import type { Position } from "../../src/engine/grid";
import type { FakeNode } from "./support/fakePixi";
import type { TileView } from "../../src/renderer/scene";
import type { TokenView } from "../../src/renderer/tokens";
import { STATIC_TOKEN_SPRITE, playerTokenView } from "../../src/renderer/tokens";
import { WALK_MS_PER_CELL, interpolatedCell } from "../../src/renderer/sprites/walkMotion";
import { gridToIso } from "../../src/renderer/gridProjection";
import { attachTrails, cellCenters } from "../../src/renderer/walkTrail";
import type { TrailBatch } from "../../src/store/trails";

vi.mock("pixi.js", async () => {
  const { FakeAnimatedSprite, FakeGraphics, FakeNode: Node } = await import("./support/fakePixi");
  const Assets = { load: () => new Promise(() => undefined) };
  return { AnimatedSprite: FakeAnimatedSprite, Container: Node, Graphics: FakeGraphics, Assets, Texture: class {}, Rectangle: class {} };
});

const { ActorStage } = await import("../../src/renderer/sprites/actorStage");

const SHEET = "/assets/sprites/iop.svg";
const SHEET_SPEC = {
  entityId: "iop",
  path: SHEET,
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    idle: { row: 0, frames: 4, fps: 6, loop: true },
    walk: { row: 1, frames: 4, fps: 6, loop: true },
    attack: { row: 2, frames: 4, fps: 6, loop: false },
    hit: { row: 3, frames: 4, fps: 6, loop: false },
  },
};
/** Trajet unique en L : (0,0) → (1,0) → (1,1), sans raccourci diagonal possible. */
const FIELD_CELLS: readonly Position[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
];

const ORIGIN = { x: 0, y: 0, scale: 1 };

function centre(cell: Position) {
  return gridToIso({ ...cell, origin: ORIGIN });
}

function centres() {
  return cellCenters(FIELD_CELLS.map((cell) => ({ position: cell, center: centre(cell) }) as unknown as TileView));
}

function token(cell: Position): TokenView {
  return playerTokenView(cell, ORIGIN, { ...STATIC_TOKEN_SPRITE, spriteId: "iop" });
}

function batch(cells: readonly Position[], version: number): TrailBatch {
  return { version, trails: [{ id: "player", cells }] };
}

function stage(): InstanceType<typeof ActorStage> {
  return new ActorStage([SHEET_SPEC]);
}

function nodeOf(carrier: InstanceType<typeof ActorStage>): FakeNode {
  return carrier.container.children[0] as unknown as FakeNode;
}

function sync(carrier: InstanceType<typeof ActorStage>, cell: Position, trails?: TrailBatch): void {
  const tokens = attachTrails([token(cell)], trails ?? null);
  carrier.sync({ tokens, onReady: () => undefined, centers: centres() });
}

describe("ActorStage — le héros glisse le long du trajet reçu", () => {
  it("un spawn sans trajet se pose sur sa case : aucune animation depuis l'origine", () => {
    const carrier = stage();
    sync(carrier, { x: 1, y: 1 });
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 1 }));
    expect(carrier.advance(100)).toBe(false);
  });

  it("après un pas, la position peinte reste au départ jusqu'au tick suivant", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    sync(carrier, { x: 1, y: 0 }, batch([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1));
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 0, y: 0 }));
    carrier.advance(WALK_MS_PER_CELL / 2);
    const middle = interpolatedCell(centre({ x: 0, y: 0 }), centre({ x: 1, y: 0 }), 0.5);
    expect(nodeOf(carrier).position.x).toBeCloseTo(middle.x, 6);
    expect(nodeOf(carrier).position.y).toBeCloseTo(middle.y, 6);
    carrier.advance(WALK_MS_PER_CELL);
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 0 }));
  });

  it("un trajet de plusieurs cases passe par la case intermédiaire, pas en diagonale", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    const cells = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }];
    sync(carrier, { x: 1, y: 1 }, batch(cells, 1));
    carrier.advance(WALK_MS_PER_CELL);
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 0 }));
    carrier.advance(WALK_MS_PER_CELL * 2);
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 1 }));
  });
});

describe("ActorStage — annulation et cas limites", () => {
  it("un second trajet remplace le premier, sans empilement", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    sync(carrier, { x: 1, y: 0 }, batch([{ x: 0, y: 0 }, { x: 1, y: 0 }], 1));
    carrier.advance(50);
    sync(carrier, { x: 1, y: 1 }, batch([{ x: 1, y: 0 }, { x: 1, y: 1 }], 2));
    carrier.advance(WALK_MS_PER_CELL * 3);
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 1 }));
  });

  it("un déplacement de zéro case n'apporte aucun trajet et ne bouge pas", () => {
    const carrier = stage();
    sync(carrier, { x: 1, y: 0 });
    sync(carrier, { x: 1, y: 0 }, batch([{ x: 1, y: 0 }], 1));
    expect(carrier.advance(50)).toBe(false);
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 0 }));
  });

  it("un trajet dont la dernière case n'est pas celle du jeton est ignoré", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    sync(carrier, { x: 0, y: 0 }, batch([{ x: 1, y: 0 }, { x: 1, y: 1 }], 1));
    expect(carrier.advance(50)).toBe(false);
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 0, y: 0 }));
  });
});

describe("ActorStage — changement de scène", () => {
  it("un changement de carte au milieu du glissement repose le héros, sans traînée", () => {
    const carrier = stage();
    const map = { id: "plage" };
    const tokens = attachTrails([token({ x: 0, y: 0 })], batch([{ x: 0, y: 0 }, { x: 1, y: 1 }], 1));
    carrier.sync({ tokens, onReady: () => undefined, centers: centres(), scene: map });
    carrier.advance(75);
    const moved = attachTrails([token({ x: 1, y: 1 })], null);
    carrier.sync({ tokens: moved, onReady: () => undefined, centers: centres(), scene: { id: "donjon" } });
    expect(nodeOf(carrier).position).toMatchObject(centre({ x: 1, y: 1 }));
    expect(carrier.advance(200)).toBe(false);
  });

  it("détruit l'acteur absent : aucun sprite fantôme, aucune exception", () => {
    const carrier = stage();
    sync(carrier, { x: 0, y: 0 });
    carrier.sync({ tokens: [], onReady: () => undefined, centers: centres() });
    expect(carrier.container.children).toHaveLength(0);
    expect(carrier.advance(200)).toBe(false);
  });
});
