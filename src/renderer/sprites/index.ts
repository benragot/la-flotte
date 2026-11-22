export { ActorStage } from "./actorStage";
export type { ActorSyncInput } from "./actorStage";
export { EntitySprite, FALLBACK_RADIUS, SPRITE_ANCHOR } from "./EntitySprite";
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
export { SPRITE_ANIMATIONS } from "./types";
export type { AnimationSpec, Facing, SpriteAnimationName, SpriteSheetFrames, SpriteSheetSpec } from "./types";
export { WALK_MS_PER_CELL, interpolatedCell, pathAt, sampleWalk, startWalk, stepProgress, walkPlan } from "./walkMotion";
export type { WalkPlan, WalkSample, WalkState } from "./walkMotion";
export { findWalkPath, walkField, walkPlanAlong } from "./walkPath";
export type { WalkField } from "./walkPath";
