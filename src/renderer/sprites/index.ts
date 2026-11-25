export { ActorStage } from "./actorStage";
export type { ActorSyncInput } from "./actorStage";
export { SPRITE_ANCHOR } from "./anchor";
export { EntitySprite } from "./EntitySprite";
export type { ActorPlacement, EntitySpriteInput } from "./EntitySprite";
export {
  SPRITE_DISPLAY_SIZE,
  SPRITE_FRAME_SIZE,
  animationFrames,
  animationRects,
  displayScaleFor,
  frameAt,
  frameIndexAt,
  frameRect,
} from "./frameMath";
export type { AnimationCount, AnimationLayout, FrameCell, FrameRect } from "./frameMath";
export { sheetPlan } from "./sheetPlan";
export type { SheetPlan } from "./sheetPlan";
export { ensureSpriteSheet, loadSpriteSheet, peekSpriteSheet } from "./spriteLoader";
export {
  SPRITE_HIT_GEOMETRY,
  TOKEN_BODY_WIDTH_RATIO,
  containsPoint,
  hitTargetOf,
  pickToken,
  tokenHitBox,
} from "./tokenHit";
export type { ScreenPoint, ScreenRect, TokenAnchor, TokenHitGeometry, TokenHitTarget } from "./tokenHit";
export { SPRITE_ANIMATIONS } from "./types";
export type { AnimationSpec, Facing, SpriteAnimationName, SpriteSheetFrames, SpriteSheetSpec } from "./types";
export { WALK_MS_PER_CELL, interpolatedCell, pathAt, sampleWalk, startWalk, stepProgress, walkPlan } from "./walkMotion";
export type { WalkPlan, WalkSample, WalkState } from "./walkMotion";
