import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import type { ExplorationState, MonsterGroup, Rng } from "./types";

const MIN_RESPAWN_DISTANCE = 4;
const GROUP_ID_PREFIX = "group-";

export function groupPositions(state: ExplorationState): Position[] {
  return state.monsterGroups.map((group) => group.pos);
}

export function getMonsterGroupAt(state: ExplorationState, position: Position): MonsterGroup | null {
  return state.monsterGroups.find((group) => samePosition(group.pos, position)) ?? null;
}

export function buildGroup(
  input: { monsterId: string; monsterName: string; level: number },
  id: string,
  pos: Position,
): MonsterGroup {
  const label = `${input.monsterName} · Niv. ${input.level}`;
  return { id, pos, monsterIds: [input.monsterId], totalLevel: input.level, label };
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function allCells(map: AsciiMap): Position[] {
  const cells: Position[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function isRespawnCell(state: ExplorationState, position: Position): boolean {
  if (!isWalkableCell(state.map, position)) return false;
  if (getMonsterGroupAt(state, position) !== null) return false;
  return manhattan(position, state.playerPos) >= MIN_RESPAWN_DISTANCE;
}

function respawnCandidates(state: ExplorationState): Position[] {
  return allCells(state.map).filter((cell) => isRespawnCell(state, cell));
}

function pickCandidate(candidates: Position[], rng: Rng): Position | undefined {
  if (candidates.length === 0) return undefined;
  return candidates[Math.floor(rng() * candidates.length)];
}

function parseGroupIndex(id: string): number {
  const suffix = Number(id.slice(GROUP_ID_PREFIX.length));
  return Number.isFinite(suffix) ? suffix : 0;
}

function nextGroupId(groups: MonsterGroup[]): string {
  const indexes = groups.map((group) => parseGroupIndex(group.id));
  return `${GROUP_ID_PREFIX}${Math.max(0, ...indexes) + 1}`;
}

function removeGroupsUnderPlayer(state: ExplorationState): MonsterGroup[] {
  return state.monsterGroups.filter((group) => !samePosition(group.pos, state.playerPos));
}

function respawnLog(label: string): string {
  return `Un groupe rôde plus loin : ${label}.`;
}

function withRespawnedGroup(
  state: ExplorationState,
  groups: MonsterGroup[],
  position: Position,
): ExplorationState {
  const template = state.monsterGroups[0];
  if (template === undefined) return { ...state, monsterGroups: groups };
  const group = { ...template, id: nextGroupId(groups), pos: position };
  return { ...state, monsterGroups: [...groups, group], log: [...state.log, respawnLog(group.label)] };
}

export function respawnMonsterGroup(state: ExplorationState, rng: Rng): ExplorationState {
  const groups = removeGroupsUnderPlayer(state);
  const position = pickCandidate(respawnCandidates({ ...state, monsterGroups: groups }), rng);
  if (position === undefined) return state;
  return withRespawnedGroup(state, groups, position);
}
