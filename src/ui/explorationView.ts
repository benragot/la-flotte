import type { ExplorationState } from "../engine/exploration";
import { explorationPathTo } from "../engine/exploration";
import type { Position } from "../engine/grid";
import type { ExplorationGroup, ExplorationView, GridSize } from "../renderer";
import { isoToGrid, sceneOrigin } from "../renderer";

export interface CellPickInput {
  exploration: ExplorationState;
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

/** Vue d'exploration attendue par le renderer : décor + jetons + chemin de survol. */
export function explorationView(
  exploration: ExplorationState | null,
  hovered: Position | null,
): ExplorationView | undefined {
  if (exploration === null) return undefined;
  const base = { playerPos: exploration.playerPos, groups: groupViews(exploration), map: exploration.map };
  return { ...base, path: pathFor(exploration, hovered) };
}

/** Case sous un point du conteneur ; l'origine ne dépend que de la carte, jamais du survol. */
export function cellAtPoint(input: CellPickInput): Position | null {
  const { width, height } = input.exploration.map;
  if (width <= 0 || height <= 0) return null;
  const origin = sceneOrigin({ width, height }, input.viewport);
  return isoToGrid({ px: input.point.x, py: input.point.y, origin, width, height });
}
