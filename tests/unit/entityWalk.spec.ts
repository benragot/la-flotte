import { describe, expect, it, vi } from "vitest";
import type { AnimatedLike, FakeNode } from "./support/fakePixi";
import type { SpriteAnimationName, SpriteSheetFrames, SpriteSheetSpec } from "../../src/renderer/sprites/types";
import type { PixelPoint } from "../../src/renderer/gridProjection";
import { WALK_MS_PER_CELL, walkPlan } from "../../src/renderer/sprites/walkMotion";

vi.mock("pixi.js", async () => {
  const { FakeAnimatedSprite, FakeGraphics, FakeNode: Node } = await import("./support/fakePixi");
  return { AnimatedSprite: FakeAnimatedSprite, Container: Node, Graphics: FakeGraphics };
});

const { EntitySprite: Subject } = await import("../../src/renderer/sprites/EntitySprite");

const animation = (row: number, loop: boolean): SpriteSheetSpec["animations"][SpriteAnimationName] => ({
  row,
  frames: 4,
  fps: 6,
  loop,
});

const SPEC: SpriteSheetSpec = {
  entityId: "iop",
  path: "/assets/sprites/iop.svg",
  frameWidth: 64,
  frameHeight: 64,
  animations: { idle: animation(0, true), walk: animation(1, true), attack: animation(2, false), hit: animation(3, false) },
};

const FRAMES = {
  idle: [{ name: "idle" }],
  walk: [{ name: "walk" }],
  attack: [{ name: "attack" }],
  hit: [{ name: "hit" }],
} as unknown as SpriteSheetFrames;

const A: PixelPoint = { x: 0, y: 0 };
const B: PixelPoint = { x: 64, y: 0 };

function plan(points: readonly PixelPoint[]) {
  const built = walkPlan(points);
  if (built === null) throw new Error("plan attendu");
  return built;
}

function placement(animationName: SpriteAnimationName, point: PixelPoint = A) {
  return { point, facing: "right" as const, animation: animationName, signature: `sig-${animationName}` };
}

function spawn(): { actor: InstanceType<typeof Subject>; played: AnimatedLike; node: FakeNode } {
  const actor = new Subject({ spec: SPEC, frames: FRAMES, tint: 0 });
  return { actor, played: actor.node.children[0] as unknown as AnimatedLike, node: actor.node as unknown as FakeNode };
}

describe("EntitySprite — glissement d'une case à l'autre", () => {
  it("joue walk et avance entre les deux centres pendant le trajet", () => {
    const { actor, played, node } = spawn();
    actor.update(placement("idle"));
    actor.walkAlong(plan([A, B]), 1000);
    expect(played.textures).toBe(FRAMES.walk);
    actor.advance(1000 + WALK_MS_PER_CELL / 2);
    expect(node.position.x).toBeCloseTo(32, 6);
    actor.advance(1000 + WALK_MS_PER_CELL);
    expect(node.position).toEqual({ x: 64, y: 0 });
    expect(played.textures).toBe(FRAMES.idle);
  });

  it("ne se téléporte pas à la case d'arrivée tant que le trajet n'est pas fini", () => {
    const { actor, node } = spawn();
    actor.update(placement("idle"));
    actor.walkAlong(plan([A, B]), 0);
    actor.update(placement("idle", B));
    expect(node.position.x).toBe(0);
  });

  it("garde walk pendant le trajet même si la scène redemande idle", () => {
    const { actor, played } = spawn();
    actor.update(placement("idle"));
    actor.walkAlong(plan([A, B]), 0);
    actor.update(placement("idle", B));
    expect(played.textures).toBe(FRAMES.walk);
  });

});

describe("EntitySprite — reprise d'un trajet interrompu", () => {
  const C: PixelPoint = { x: 128, y: 0 };
  /** Position peinte après 70 ms d'une case : 7/15 du segment, jamais une case. */
  const PAINTED = (B.x * 70) / WALK_MS_PER_CELL;

  it("repart du point peint : interrompre ne téléporte pas sur la case logique", () => {
    const { actor, node } = spawn();
    actor.update(placement("idle"));
    actor.walkAlong(plan([A, B]), 0);
    actor.advance(70);
    expect(node.position.x).toBeCloseTo(PAINTED, 6);
    actor.walkAlong(plan([B, C]), 70);
    actor.advance(70);
    expect(node.position.x).toBeCloseTo(PAINTED, 6);
    expect(node.position.y).toBe(0);
  });

  it("finit le segment en cours, puis enchaîne le nouveau chemin sans à-coup", () => {
    const { actor, node } = spawn();
    actor.update(placement("idle"));
    actor.walkAlong(plan([A, B]), 0);
    actor.advance(70);
    actor.walkAlong(plan([B, C]), 70);
    actor.advance(70 + WALK_MS_PER_CELL / 2);
    expect(node.position.x).toBeCloseTo((PAINTED + B.x) / 2, 6);
    actor.advance(70 + WALK_MS_PER_CELL);
    expect(node.position.x).toBeCloseTo(B.x, 6);
    actor.advance(70 + WALK_MS_PER_CELL * 2);
    expect(node.position.x).toBeCloseTo(C.x, 6);
  });
});

describe("EntitySprite — annulation d'un trajet", () => {
  it("un trajet d'une seule case ne fabrique aucun plan", () => {
    expect(walkPlan([A])).toBeNull();
  });
});
