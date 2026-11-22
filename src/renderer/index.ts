export { CombatCanvas } from "./CombatCanvas";
export type { ArenaMode, CombatCanvasProps } from "./CombatCanvas";
export {
  TILE_H,
  TILE_W,
  arenaScale,
  centeredOrigin,
  cornerSafeScale,
  coverScale,
  gridDiamond,
  gridToIso,
  isoMapSize,
  isoToGrid,
  originScale,
  sceneOrigin,
} from "./gridProjection";
export type { CenteredOriginInput, Diamond, GridSize, IsoCellInput, IsoOrigin, IsoPickInput, PixelPoint } from "./gridProjection";
export {
  CAST_HIGHLIGHT,
  GRID_LINE,
  GRID_LINE_ALPHA,
  HOVER_STROKE,
  MOVE_HIGHLIGHT,
  PATH_HIGHLIGHT,
  PATH_STYLE,
  TILE_COLORS,
  WALL_HEIGHT,
  WALL_SIDE,
  WALL_TOP,
  getTileColor,
  resolveTileStyle,
} from "./tileStyle";
export type { TileStyle, TileStyleInput } from "./tileStyle";
export { FALLBACK_GRID, SCENE_BACKGROUND, combatCanvasSize } from "./combatCanvasConfig";
export { buildExplorationViewModel, explorationMapSize } from "./explorationScene";
export type { ExplorationGroup, ExplorationView } from "./explorationScene";
export { buildViewModel, lastActionFrom } from "./combatSceneModel";
export type { CombatSceneInput, LastAction, ViewModel } from "./combatSceneModel";
export { battleViewModel, colorForId, shouldRenderBattle } from "./battleViewModel";
export type { BattleCombatantView } from "./battleViewModel";
export { SPRITE_SHEETS } from "./spriteManifest";
export {
  ActorStage,
  EntitySprite,
  SPRITE_ANCHOR,
  SPRITE_ANIMATIONS,
  SPRITE_DISPLAY_SIZE,
  SPRITE_FRAME_SIZE,
  animationFrames,
  animationRects,
  displayScaleFor,
  ensureSpriteSheet,
  frameAt,
  frameIndexAt,
  frameRect,
  loadSpriteSheet,
  peekSpriteSheet,
  sheetPlan,
} from "./sprites";
export type {
  ActorPlacement,
  AnimationCount,
  AnimationLayout,
  AnimationSpec,
  Facing,
  FrameCell,
  FrameRect,
  SheetPlan,
  SpriteAnimationName,
  SpriteSheetFrames,
  SpriteSheetSpec,
} from "./sprites";
export {
  BADGE_RADIUS,
  STATIC_TOKEN_SPRITE,
  facingToward,
  groupTokenView,
  hpBarFor,
  hpRatio,
  playerTokenView,
  tokenBadge,
  tokenView,
} from "./tokens";
export type { HpBar, TokenBadge, TokenSprite, TokenView } from "./tokens";
export { depthOf, painterOrder } from "./scene";
export type { GridHighlight, SceneModel, TileView } from "./scene";
export { hashInt, hashUnit } from "./cellHash";
export { MATERIAL_COLORS, MATERIAL_KINDS, materialAt, shiftColor, waterTone } from "./tileMaterials";
export type { TileMaterial } from "./tileMaterials";
export { groundShapes, waterEdges } from "./tileTexture";
export type { Edge, GroundShapeInput, NeighbourLand } from "./tileTexture";
export { decorShapes } from "./decor";
export type { DecorView } from "./decor";
export { mapDecorSpecs } from "./mapDecor";
export { paintShapes } from "./paintShapes";
export { drawDecor } from "./decorPaint";
export type { EllipseShape, LineShape, PolyShape, RingShape, Shape } from "./shapes";
export { buildPathPreview, pathIsoCenters } from "./pathPreview";
export type { BlockReason, PathCentersInput, PathPreview, PathPreviewInput } from "./pathPreview";
export { buildDamagePreview, elementStat } from "./damagePreview";
export type { AttackerStats, DamagePreview, DamagePreviewInput, ElementResistances } from "./damagePreview";
