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
  /** Signature de la dernière demande du jeu : elle seule décide d'un rejeu. */
  private requested = "";

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
    this.requested = "";
  }

  /**
   * Démarre visuellement une animation sans toucher à la demande courante :
   * `attack`/`hit` ne bouclent pas et retombent sur `idle` en fin de course.
   */
  private start(animation: SpriteAnimationName): void {
    const { animated, frames } = this;
    if (animated === null || frames === null) return;
    const spec = this.spec.animations[animation];
    animated.textures = frames[animation];
    animated.animationSpeed = spec.fps / REFERENCE_FPS;
    animated.loop = spec.loop;
    animated.onComplete = spec.loop ? undefined : () => this.start("idle");
    animated.gotoAndPlay(0);
  }

  /**
   * Joue la demande du jeu : seule une **nouvelle** signature rejoue, ce qui
   * garde les one-shots stables à travers les re-rendus (survol, resize…).
   */
  play(animation: SpriteAnimationName, signature: string): void {
    if (this.requested === signature) return;
    this.requested = signature;
    this.start(animation);
  }

  /** Positionne l'acteur sur le centre du losange et applique le retournement horizontal. */
  update(placement: ActorPlacement): void {
    this.node.position.set(placement.point.x, placement.point.y);
    this.node.scale.x = placement.facing === "left" ? -1 : 1;
    this.play(placement.animation, `${placement.signature}:${placement.animation}`);
  }
}
