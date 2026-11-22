import type { ExplorationState } from "../engine/exploration";
import { explorationPathTo } from "../engine/exploration";
import type { Position } from "../engine/grid";
import type { ExplorationGroup, ExplorationView, GridSize } from "../renderer";
import { explorationMapSize, isoToGrid, sceneOrigin } from "../renderer";

export interface CellPickInput {
  exploration: ExplorationState;
  hoveredCell: Position | null;
  point: { x: number; y: number };
  viewport: GridSize;
}

function pathFor(exploration: ExplorationState, hovered: Position | null): Position[] | undefined {
  if (hovered === null) return undefined;
  return explorationPathTo(exploration, hovered) ?? undefined;
}

function groupViews(exploration: ExplorationState): ExplorationGroup[] {
  return exploration.monsterGroups.map(({ pos, label, totalLevel }) => ({ pos, label, totalLevel }));
}

/** Vue d'exploration attendue par le renderer : même dérivation pour l'affichage et le clic. */
export function explorationView(
  exploration: ExplorationState | null,
  hovered: Position | null,
): ExplorationView | undefined {
  if (exploration === null) return undefined;
  return { playerPos: exploration.playerPos, groups: groupViews(exploration), path: pathFor(exploration, hovered) };
}

/** Case sous un point du conteneur, avec l'origine exacte utilisée par le renderer. */
export function cellAtPoint(input: CellPickInput): Position | null {
  const view = explorationView(input.exploration, input.hoveredCell);
  if (view === undefined) return null;
  const origin = sceneOrigin(explorationMapSize(view), input.viewport);
  const { width, height } = input.exploration.map;
  return isoToGrid({ px: input.point.x, py: input.point.y, origin, width, height });
}
