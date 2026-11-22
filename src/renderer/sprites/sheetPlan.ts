import type { FrameRect } from "./frameMath";
import { animationRects } from "./frameMath";
import type { SpriteAnimationName, SpriteSheetSpec } from "./types";
import { SPRITE_ANIMATIONS } from "./types";

/** Rectangles sources de chaque animation, prêts pour la découpe en textures. */
export type SheetPlan = Record<SpriteAnimationName, FrameRect[]>;

function rectsFor(spec: SpriteSheetSpec, name: SpriteAnimationName): FrameRect[] {
  const { row, frames } = spec.animations[name];
  return animationRects({ row, frames, frameWidth: spec.frameWidth, frameHeight: spec.frameHeight });
}

/**
 * Plan de découpe lu **dans le manifeste** : `row`, `frames`, `frameWidth` et
 * `frameHeight` viennent du YAML, jamais de constantes de rendu. Permuter deux
 * lignes du manifeste change donc réellement les rectangles produits.
 */
export function sheetPlan(spec: SpriteSheetSpec): SheetPlan {
  const entries = SPRITE_ANIMATIONS.map((name) => [name, rectsFor(spec, name)] as const);
  return Object.fromEntries(entries) as SheetPlan;
}
