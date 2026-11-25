import { describe, expect, it, vi } from "vitest";
import type { AnimatedLike } from "./support/fakePixi";
import type { CombatantLike } from "../../src/engine/multiCombat";
import type { GridSize } from "../../src/renderer/gridProjection";
import { sceneOrigin } from "../../src/renderer/gridProjection";
import type { TokenView } from "../../src/renderer/tokens";
import { combatantTokenView } from "../../src/renderer/tokens";

vi.mock("pixi.js", async () => {
  const { FakeAnimatedSprite, FakeGraphics, FakeNode } = await import("./support/fakePixi");
  return { AnimatedSprite: FakeAnimatedSprite, Container: FakeNode, Graphics: FakeGraphics };
});

vi.mock("../../src/renderer/sprites/spriteLoader", () => {
  const textures = (name: string) => [{ name }];
  const frames = { idle: textures("idle"), walk: textures("walk"), attack: textures("attack"), hit: textures("hit") };
  const ready = (): typeof frames => frames;
  return { ensureSpriteSheet: ready, loadSpriteSheet: async () => frames, peekSpriteSheet: ready };
});

const { ActorStage } = await import("../../src/renderer/sprites/actorStage");
const { NEUTRAL_TINT } = await import("../../src/renderer/sprites/actionEffect");

const ATTACK_TINT = 0xf2d64b;
const VIEWPORT: GridSize = { width: 1024, height: 768 };
const ORIGIN = sceneOrigin({ width: 12, height: 12 }, VIEWPORT);
const SPEC = {
  entityId: "piou_mazoute",
  path: "/assets/sprites/piou_mazoute.svg",
  frameWidth: 64,
  frameHeight: 64,
  animations: {
    idle: { row: 0, frames: 4, fps: 6, loop: true },
    walk: { row: 1, frames: 4, fps: 8, loop: true },
    attack: { row: 2, frames: 4, fps: 10, loop: false },
    hit: { row: 3, frames: 4, fps: 10, loop: false },
  },
};

function combatant(id: string, x: number): CombatantLike {
  const stats = { strength: 1, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
  const zeros = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
  const base = { side: "enemy" as const, name: "Piou Mazouté", level: 1, hp: 35, maxHp: 35, ap: 6 };
  const pools = { maxAp: 6, mp: 3, maxMp: 3 };
  const body = { ...base, ...pools, stats, resistances: { flat: zeros, percent: zeros }, position: { x, y: 0 } };
  return { ...body, id, initiative: 10 };
}

/** Jeton en pleine frappe : sa clé ne changera plus, seul un changement de scène peut l'éteindre. */
function strikingToken(): TokenView {
  const sprite = { spriteId: "piou_mazoute", facing: "left" as const, animation: "attack" as const, animationKey: "log-1:attack" };
  return combatantTokenView({ combatant: combatant("piou_mazoute-0", 2), sprite, active: false }, ORIGIN);
}

function tintOf(stage: InstanceType<typeof ActorStage>, index = 0): number {
  const node = stage.container.children[index];
  if (node === undefined) throw new Error("acteur absent de la couche");
  const sprite = node.children[0] as unknown as AnimatedLike | undefined;
  if (sprite === undefined) throw new Error("feuille absente de l'acteur");
  return sprite.tint;
}

describe("couche d'acteurs — le flash ne survit pas à un changement de scène", () => {
  it("éteint la teinte d'attaque quand `sync` reçoit une autre carte", () => {
    const stage = new ActorStage([SPEC]);
    const token = strikingToken();
    const firstMap = { id: "salle-1" };
    stage.sync({ tokens: [token], onReady: () => undefined, scene: firstMap });
    expect(tintOf(stage)).toBe(ATTACK_TINT);
    stage.sync({ tokens: [token], onReady: () => undefined, scene: { id: "salle-2" } });
    expect(tintOf(stage)).toBe(NEUTRAL_TINT);
  });

  it("garde l'acteur sur place : la scène change, pas la case", () => {
    const stage = new ActorStage([SPEC]);
    const token = strikingToken();
    stage.sync({ tokens: [token], onReady: () => undefined, scene: { id: "salle-1" } });
    stage.sync({ tokens: [token], onReady: () => undefined, scene: { id: "salle-2" } });
    expect(stage.container.children).toHaveLength(1);
    expect(stage.container.children[0]?.position).toMatchObject({ x: token.center.x, y: token.center.y });
  });
});
