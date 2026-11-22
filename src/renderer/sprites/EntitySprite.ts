import { AnimatedSprite, Container, Graphics } from "pixi.js";
import type { PixelPoint } from "../gridProjection";
import type { Facing, SpriteAnimationName, SpriteSheetFrames, SpriteSheetSpec } from "./types";

/** Pieds de la cellule : l'ancre tombe sur le centre du losange isométrique. */
export const SPRITE_ANCHOR = { x: 0.5, y: 0.85 } as const;
/** Cadence de référence d'`animationSpeed` chez PixiJS (une frame par tick à 1). */
const REFERENCE_FPS = 60;
/** Rayon du cercle de repli quand la feuille est absente. */
export const FALLBACK_RADIUS = 12;
const FALLBACK_STROKE = 0x101820;

export interface EntitySpriteInput {
  spec: SpriteSheetSpec;
  frames: SpriteSheetFrames | null;
  tint: number;
}

export interface ActorPlacement {
  point: PixelPoint;
  facing: Facing;
  animation: SpriteAnimationName;
  signature: string;
}

/** Cercle coloré de repli : aucune branche spéciale côté scène. */
function createFallback(tint: number): Graphics {
  const node = new Graphics();
  node.circle(0, 0, FALLBACK_RADIUS);
  node.fill({ color: tint, alpha: 1 });
  node.circle(0, 0, FALLBACK_RADIUS);
  node.stroke({ width: 2, color: FALLBACK_STROKE, alpha: 0.9 });
  return node;
}

/**
 * Acteur animé d'une entité : encapsule un `AnimatedSprite` PixiJS v8,
 * ancré aux pieds, retourné selon `facing`, avec repli géométrique.
 */
export class EntitySprite {
  readonly node = new Container();
  private readonly spec: SpriteSheetSpec;
  private frames: SpriteSheetFrames | null = null;
  private animated: AnimatedSprite | null = null;
  private signature = "";

  constructor(input: EntitySpriteInput) {
    this.spec = input.spec;
    this.node.addChild(createFallback(input.tint));
    if (input.frames !== null) this.setFrames(input.frames);
  }

  /** Remplace le cercle de repli par la feuille animée, une seule fois. */
  setFrames(frames: SpriteSheetFrames): void {
    if (this.animated !== null) return;
    this.frames = frames;
    this.animated = new AnimatedSprite({ textures: frames.idle, anchor: SPRITE_ANCHOR, autoPlay: true });
    this.node.removeChildren().forEach((child) => child.destroy());
    this.node.addChild(this.animated);
    this.signature = "";
  }

  /** `attack`/`hit` ne bouclent pas : retour automatique sur `idle` en fin d'animation. */
  private onCompleteFor(animation: SpriteAnimationName, signature: string): (() => void) | undefined {
    if (this.spec.animations[animation].loop) return undefined;
    return () => this.play("idle", `${signature}:end`);
  }

  private applyAnimation(animation: SpriteAnimationName, signature: string): void {
    const { animated, frames } = this;
    if (animated === null || frames === null) return;
    const spec = this.spec.animations[animation];
    animated.textures = frames[animation];
    animated.animationSpeed = spec.fps / REFERENCE_FPS;
    animated.loop = spec.loop;
    animated.onComplete = this.onCompleteFor(animation, signature);
    animated.gotoAndPlay(0);
  }

  /** Joue une animation ; `signature` force le redémarrage quand la même action se répète. */
  play(animation: SpriteAnimationName, signature: string): void {
    if (this.signature === signature) return;
    this.signature = signature;
    this.applyAnimation(animation, signature);
  }

  /** Positionne l'acteur sur le centre du losange et applique le retournement horizontal. */
  update(placement: ActorPlacement): void {
    this.node.position.set(placement.point.x, placement.point.y);
    this.node.scale.x = placement.facing === "left" ? -1 : 1;
    this.play(placement.animation, `${placement.signature}:${placement.animation}`);
  }
}
