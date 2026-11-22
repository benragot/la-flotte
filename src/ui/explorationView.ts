import type { ExplorationState, MonsterGroup } from "../engine/exploration";
import type { Position } from "../engine/grid";
import type { ExplorationGroup, ExplorationView, GridSize } from "../renderer";
import { isoToGrid, sceneOrigin } from "../renderer";
import { knownSpriteId } from "../renderer/spriteManifest";

export interface CellPickInput {
  exploration: ExplorationState;
  point: { x: number; y: number };
  viewport: GridSize;
}

export interface ExplorationViewInput {
  exploration: ExplorationState | null;
  /** Classe du héros : l'id de classe est aussi l'`entityId` de sa feuille. */
  heroClassId: string | null;
}

/** Même résolution que le combat : l'id du monstre est l'id de sa feuille. */
function groupSpriteId(group: MonsterGroup): string | null {
  return knownSpriteId(group.monsterIds[0]);
}

function groupView(group: MonsterGroup): ExplorationGroup {
  const { pos, label, totalLevel } = group;
  return { pos, label, totalLevel, spriteId: groupSpriteId(group) };
}

function groupViews(exploration: ExplorationState): ExplorationGroup[] {
  return exploration.monsterGroups.map(groupView);
}

/** Vue d'exploration attendue par le renderer : décor, héros à feuille et groupes. */
export function explorationView(input: ExplorationViewInput): ExplorationView | undefined {
  const { exploration, heroClassId } = input;
  if (exploration === null) return undefined;
  const base = { playerPos: exploration.playerPos, groups: groupViews(exploration), map: exploration.map };
  return { ...base, heroSpriteId: knownSpriteId(heroClassId) };
}

/** Case sous un point du conteneur ; l'origine ne dépend que de la carte. */
export function cellAtPoint(input: CellPickInput): Position | null {
  const { width, height } = input.exploration.map;
  if (width <= 0 || height <= 0) return null;
  const origin = sceneOrigin({ width, height }, input.viewport);
  return isoToGrid({ px: input.point.x, py: input.point.y, origin, width, height });
}
