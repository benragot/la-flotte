import type { Position } from "../engine/grid";
import type { ViewModel } from "./combatSceneModel";
import type { GridSize, IsoOrigin } from "./gridProjection";
import { gridDiamond, sceneOrigin } from "./gridProjection";
import type { TileView } from "./scene";
import { PATH_STYLE } from "./tileStyle";
import type { TokenView } from "./tokens";
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
  path?: Position[];
}

export interface ExplorationModelInput {
  exploration: ExplorationView;
  viewport: GridSize;
}

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

function pathTile(position: Position, origin: IsoOrigin): TileView {
  const diamond = gridDiamond({ ...position, origin });
  return { cell: ".", center: { x: diamond.cx, y: diamond.cy }, points: diamond.points, style: PATH_STYLE };
}

function pathTiles(path: readonly Position[], origin: IsoOrigin): TileView[] {
  return path.map((position) => pathTile(position, origin));
}

function explorationTokens(exploration: ExplorationView, origin: IsoOrigin): TokenView[] {
  const groups = exploration.groups.map((group) => groupTokenView(group, origin));
  return [playerTokenView(exploration.playerPos, origin), ...groups];
}

/** View model d'exploration : chemin A* en losanges translucides, héros puis groupes badgés. */
export function buildExplorationViewModel(input: ExplorationModelInput): ViewModel {
  const exploration = input.exploration;
  const origin = sceneOrigin(explorationMapSize(exploration), input.viewport);
  return {
    scene: { tiles: [], highlights: [] },
    tokens: explorationTokens(exploration, origin),
    path: pathTiles(exploration.path ?? [], origin),
  };
}
