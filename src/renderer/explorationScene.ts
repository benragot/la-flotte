import type { AsciiMap, Position } from "../engine/grid";
import type { ViewModel } from "./combatSceneModel";
import type { GridSize, IsoOrigin } from "./gridProjection";
import { sceneOrigin } from "./gridProjection";
import type { GridHighlight, SceneModel } from "./scene";
import { buildSceneModel } from "./scene";
import { groupNameOf } from "./labels";
import type { TokenSprite, TokenView } from "./tokens";
import { STATIC_TOKEN_SPRITE, groupTokenView, playerTokenView } from "./tokens";

export interface ExplorationGroup {
  pos: Position;
  label: string;
  totalLevel: number;
  /** Feuille de sprite du groupe ; `null` = repli géométrique explicite. */
  spriteId?: string | null;
}

/** Données d'exploration fournies par l'appelant : le store de combat ne les expose pas. */
export interface ExplorationView {
  playerPos: Position;
  groups: ExplorationGroup[];
  /** Carte réelle : fige l'origine et permet de dessiner le décor. */
  map?: AsciiMap;
  /** `entityId` de la feuille du héros ; absent, le héros garde un jeton géométrique. */
  heroSpriteId?: string | null;
}

export interface ExplorationModelInput {
  exploration: ExplorationView;
  viewport: GridSize;
}

const NO_HIGHLIGHT: GridHighlight = { move: new Set(), cast: new Set(), hover: null };

function groupsPositions(groups: readonly ExplorationGroup[]): Position[] {
  return groups.map((group) => group.pos);
}

function explorationCells(exploration: ExplorationView): Position[] {
  return [exploration.playerPos, ...groupsPositions(exploration.groups)];
}

function maxCoord(positions: readonly Position[]): Position {
  const start: Position = { x: 0, y: 0 };
  return positions.reduce((acc, pos) => ({ x: Math.max(acc.x, pos.x), y: Math.max(acc.y, pos.y) }), start);
}

/** Carte virtuelle couvrant la case la plus lointaine, au moins 1x1. */
export function explorationMapSize(exploration: ExplorationView): GridSize {
  const max = maxCoord(explorationCells(exploration));
  return { width: max.x + 1, height: max.y + 1 };
}

/** Origine figée sur la carte réelle : ni le survol ni les jetons ne la déplacent. */
function gridSizeOf(exploration: ExplorationView): GridSize {
  if (exploration.map === undefined) return explorationMapSize(exploration);
  return { width: exploration.map.width, height: exploration.map.height };
}

/** Décor complet sans surbrillance : exploration = même grille que le combat, sans PM/PO. */
function explorationScene(exploration: ExplorationView, origin: IsoOrigin): SceneModel {
  if (exploration.map === undefined) return { tiles: [], highlights: [], decor: [], outlines: [] };
  return buildSceneModel({ map: exploration.map, highlight: NO_HIGHLIGHT, origin });
}

/** Le héros respire en exploration : aucun aperçu de chemin ne le fait marcher. */
function heroSprite(exploration: ExplorationView): TokenSprite {
  const spriteId = exploration.heroSpriteId ?? null;
  if (spriteId === null) return STATIC_TOKEN_SPRITE;
  return { spriteId, facing: "right", animation: "idle", animationKey: "idle-explore" };
}

function explorationTokens(exploration: ExplorationView, origin: IsoOrigin): TokenView[] {
  const groups = exploration.groups.map((group) => groupTokenView({ ...group, name: groupNameOf(group.label) }, origin));
  return [playerTokenView(exploration.playerPos, origin, heroSprite(exploration)), ...groups];
}

/** View model d'exploration : décor iso, héros puis groupes badgés, aucun chemin. */
export function buildExplorationViewModel(input: ExplorationModelInput): ViewModel {
  const exploration = input.exploration;
  const origin = sceneOrigin(gridSizeOf(exploration), input.viewport);
  const header = { floats: [], sceneKey: exploration.map ?? null };
  return { ...header, scene: explorationScene(exploration, origin), tokens: explorationTokens(exploration, origin), path: [], lastAction: null };
}
