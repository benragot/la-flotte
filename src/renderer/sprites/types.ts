import type { Texture } from "pixi.js";

/** Les quatre animations d'une feuille, dans l'ordre des lignes du SVG généré. */
export const SPRITE_ANIMATIONS = ["idle", "walk", "attack", "hit"] as const;

export type SpriteAnimationName = (typeof SPRITE_ANIMATIONS)[number];

/** Sens du regard : `left` retourne le sprite horizontalement. */
export type Facing = "left" | "right";

/** Réglage d'une animation dans le manifeste. */
export interface AnimationSpec {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}

/** Une feuille décrite par `data/sprites.yaml`, telle que consommée par le rendu. */
export interface SpriteSheetSpec {
  entityId: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  animations: Record<SpriteAnimationName, AnimationSpec>;
}

/** Feuille chargée : quatre tableaux de textures, un par animation. */
export type SpriteSheetFrames = Record<SpriteAnimationName, Texture[]>;
