import { describe, expect, it, vi } from "vitest";
import type { AnimatedLike } from "./support/fakePixi";
import type { EntitySprite } from "../../src/renderer/sprites/EntitySprite";
import type { SpriteAnimationName, SpriteSheetFrames, SpriteSheetSpec } from "../../src/renderer/sprites/types";

vi.mock("pixi.js", async () => {
  const { FakeAnimatedSprite, FakeGraphics, FakeNode } = await import("./support/fakePixi");
  return { AnimatedSprite: FakeAnimatedSprite, Container: FakeNode, Graphics: FakeGraphics };
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

const textures = (name: string) => [{ name }];

const FRAMES = {
  idle: textures("idle"),
  walk: textures("walk"),
  attack: textures("attack"),
  hit: textures("hit"),
} as unknown as SpriteSheetFrames;

function spawn(): { actor: EntitySprite; played: AnimatedLike } {
  const actor = new Subject({ spec: SPEC, frames: FRAMES });
  return { actor, played: actor.node.children[0] as unknown as AnimatedLike };
}

const placement = (animationName: SpriteAnimationName, signature: string) => ({
  point: { x: 10, y: 20 },
  facing: "right" as const,
  animation: animationName,
  signature,
});

describe("EntitySprite — one-shot", () => {
  it("joue attack en one-shot", () => {
    const { actor, played } = spawn();
    actor.update(placement("attack", "log-2"));
    expect(played.textures).toBe(FRAMES.attack);
    expect(played.loop).toBe(false);
  });

  it("revient sur idle après attack sans réarmer l'attaque", () => {
    const { actor, played } = spawn();
    actor.update(placement("attack", "log-2"));
    played.onComplete?.();
    expect(played.textures).toBe(FRAMES.idle);
    actor.update(placement("attack", "log-2"));
    expect(played.textures).toBe(FRAMES.idle);
  });

  it("revient sur idle après hit sans réarmer la touche", () => {
    const { actor, played } = spawn();
    actor.update(placement("hit", "log-2"));
    played.onComplete?.();
    expect(played.textures).toBe(FRAMES.idle);
    actor.update(placement("hit", "log-2"));
    expect(played.textures).toBe(FRAMES.idle);
  });
});

describe("EntitySprite — rejeu et boucles", () => {
  it("rejoue attack pour une nouvelle demande", () => {
    const { actor, played } = spawn();
    actor.update(placement("attack", "log-2"));
    played.onComplete?.();
    actor.update(placement("attack", "log-4"));
    expect(played.textures).toBe(FRAMES.attack);
    expect(played.loop).toBe(false);
  });

  it("rejoue quand la demande change d'animation", () => {
    const { actor, played } = spawn();
    actor.update(placement("attack", "log-2"));
    actor.update(placement("hit", "log-3"));
    expect(played.textures).toBe(FRAMES.hit);
  });

  it("boucle idle et walk", () => {
    const { actor, played } = spawn();
    actor.update(placement("walk", "explore"));
    expect(played.loop).toBe(true);
    expect(played.textures).toBe(FRAMES.walk);
    actor.update(placement("idle", "static"));
    expect(played.loop).toBe(true);
    expect(played.textures).toBe(FRAMES.idle);
  });
});

describe("EntitySprite — aucun pion plein sous le sprite", () => {
  it("ne pose aucun nœud tant que la feuille manque : l'anneau de scène marque la case", () => {
    const actor = new Subject({ spec: SPEC, frames: null });
    expect(actor.node.children).toHaveLength(0);
  });

  it("garde exactement la feuille animée une fois la feuille prête", () => {
    const actor = new Subject({ spec: SPEC, frames: FRAMES });
    expect(actor.node.children).toHaveLength(1);
  });
});

describe("EntitySprite — feuille tardive et orientation", () => {
  it("rejoue la demande courante quand la feuille arrive après coup", () => {
    const actor = new Subject({ spec: SPEC, frames: null });
    actor.update(placement("attack", "log-2"));
    actor.setFrames(FRAMES);
    actor.update(placement("attack", "log-2"));
    expect((actor.node.children[0] as unknown as AnimatedLike).textures).toBe(FRAMES.attack);
  });

  it("retourne le sprite selon facing", () => {
    const { actor } = spawn();
    actor.update({ ...placement("idle", "static"), facing: "left" });
    expect(actor.node.scale.x).toBe(-1);
    actor.update(placement("idle", "static"));
    expect(actor.node.scale.x).toBe(1);
  });

  it("applique l'échelle du décor sans perdre le retournement", () => {
    const { actor } = spawn();
    actor.update({ ...placement("idle", "static"), facing: "left", scale: 2 });
    expect(actor.node.scale.x).toBe(-2);
    expect(actor.node.scale.y).toBe(2);
    actor.update({ ...placement("idle", "static"), scale: 2 });
    expect(actor.node.scale.x).toBe(2);
  });
});
