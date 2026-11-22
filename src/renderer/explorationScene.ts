import type { AsciiMap, Position } from "../engine/grid";
import type { ViewModel } from "./combatSceneModel";
import type { GridSize, IsoOrigin } from "./gridProjection";
import { gridDiamond, sceneOrigin } from "./gridProjection";
import type { GridHighlight, SceneModel, TileView } from "./scene";
import { buildSceneModel } from "./scene";
import { PATH_STYLE } from "./tileStyle";
import type { TokenSprite, TokenView } from "./tokens";
import { groupTokenView, playerTokenView } from "./tokens";

export interface ExplorationGroup {
  pos: Position;
  label: string;
  totalLevel: number;
}

/** Données d'exploration fournies par l'appelant : le store de combat ne les expose pas. */
export interface ExplorationView {
  playerPos: Position;
  groups: ExplorationGroup[];
  /** Carte réelle : fige l'origine et permet de dessiner le décor. */
  map?: AsciiMap;
  path?: Position[];
  /** `entityId` de la feuille du héros ; absent, le héros garde un jeton géométrique. */
  heroSpriteId?: string;
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
  const groups = groupsPositions(exploration.groups);
  return [exploration.playerPos, ...groups, ...(exploration.path ?? [])];
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

/**
 * Origine figée sur la carte réelle : elle ne dépend ni du chemin de survol ni
 * des jetons, donc l'écran ne saute pas sous le curseur.
 */
function gridSizeOf(exploration: ExplorationView): GridSize {
  if (exploration.map === undefined) return explorationMapSize(exploration);
  return { width: exploration.map.width, height: exploration.map.height };
}

/** Décor complet sans surbrillance : exploration = même grille que le combat, sans PM/PO. */
function explorationScene(exploration: ExplorationView, origin: IsoOrigin): SceneModel {
  if (exploration.map === undefined) return { tiles: [], highlights: [] };
  return buildSceneModel({ map: exploration.map, highlight: NO_HIGHLIGHT, origin });
}

function pathTile(position: Position, origin: IsoOrigin): TileView {
  const diamond = gridDiamond({ ...position, origin });
  return { cell: ".", center: { x: diamond.cx, y: diamond.cy }, points: diamond.points, style: PATH_STYLE };
}

function pathTiles(path: readonly Position[], origin: IsoOrigin): TileView[] {
  return path.map((position) => pathTile(position, origin));
}

/** Le héros marche quand un chemin est tracé, sinon il respire. */
function heroSprite(exploration: ExplorationView): TokenSprite {
  const moving = (exploration.path ?? []).length > 0;
  const animation = moving ? "walk" : "idle";
  return { spriteId: exploration.heroSpriteId ?? null, facing: "right", animation, animationKey: `${animation}-explore` };
}

function explorationTokens(exploration: ExplorationView, origin: IsoOrigin): TokenView[] {
  const groups = exploration.groups.map((group) => groupTokenView(group, origin));
  return [playerTokenView(exploration.playerPos, origin, heroSprite(exploration)), ...groups];
}

/** View model d'exploration : décor iso, chemin A* translucide, héros puis groupes badgés. */
export function buildExplorationViewModel(input: ExplorationModelInput): ViewModel {
  const exploration = input.exploration;
  const origin = sceneOrigin(gridSizeOf(exploration), input.viewport);
  return {
    scene: explorationScene(exploration, origin),
    tokens: explorationTokens(exploration, origin),
    path: pathTiles(exploration.path ?? [], origin),
    lastAction: null,
  };
}
