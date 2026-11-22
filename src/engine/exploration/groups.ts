import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import type { ExplorationState, MonsterGroup, MonsterSpawn, RespawnInput, Rng } from "./types";

const MIN_RESPAWN_DISTANCE = 4;
const GROUP_ID_PREFIX = "group-";
const GROUP_ID_PATTERN = /group-(\d+)/g;

export function groupPositions(state: ExplorationState): Position[] {
  return state.monsterGroups.map((group) => group.pos);
}

export function getMonsterGroupAt(state: ExplorationState, position: Position): MonsterGroup | null {
  return state.monsterGroups.find((group) => samePosition(group.pos, position)) ?? null;
}

/** `monsterIds` est un tableau neuf : aucun groupe ne partage sa référence. */
export function buildGroup(spawn: MonsterSpawn, id: string, pos: Position): MonsterGroup {
  return buildGroupOf([spawn], id, pos);
}

interface LabelPart {
  name: string;
  count: number;
}

/** Un nom par monstre distinct : le label dit « ×2 », il ne répète pas le nom. */
function nameCounts(spawns: readonly MonsterSpawn[]): LabelPart[] {
  const counts = new Map<string, number>();
  spawns.forEach((spawn) => counts.set(spawn.monsterName, (counts.get(spawn.monsterName) ?? 0) + 1));
  return [...counts].map(([name, count]) => ({ name, count }));
}

function partLabel(part: LabelPart): string {
  return part.count > 1 ? `${part.name} ×${part.count}` : part.name;
}

function totalLevelOf(spawns: readonly MonsterSpawn[]): number {
  return spawns.reduce((sum, spawn) => sum + spawn.level, 0);
}

/** « Piou Mazouté · Niv. 1 » pour un solitaire, « Piou ×2 + Rat · Niv. 7 » sinon. */
function groupLabel(spawns: readonly MonsterSpawn[], totalLevel: number): string {
  return `${nameCounts(spawns).map(partLabel).join(" + ")} · Niv. ${totalLevel}`;
}

/** Groupe de 1 à 3 monstres : ids neufs, label composé, niveau **cumulé**. */
export function buildGroupOf(spawns: readonly MonsterSpawn[], id: string, pos: Position): MonsterGroup {
  const totalLevel = totalLevelOf(spawns);
  const monsterIds = spawns.map((spawn) => spawn.monsterId);
  return { id, pos, monsterIds, totalLevel, label: groupLabel(spawns, totalLevel) };
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

function loggedIndexes(state: ExplorationState): number[] {
  const matches = [...state.log.join(" ").matchAll(GROUP_ID_PATTERN)];
  return matches.map((match) => Number(match[1] ?? 0));
}

/**
 * Règle d'id : plus grand suffixe numérique connu (groupes présents **et** ids
 * déjà cités dans le journal) + 1, donc `group-1` sans historique. Le journal
 * ne fait que croître : l'id reste déterministe et ne recule jamais, même
 * après la victoire sur le dernier groupe.
 */
function nextGroupId(state: ExplorationState): string {
  const known = state.monsterGroups.map((group) => parseGroupIndex(group.id));
  return `${GROUP_ID_PREFIX}${Math.max(0, ...known, ...loggedIndexes(state)) + 1}`;
}

function respawnLog(group: MonsterGroup): string {
  return `Un groupe rôde plus loin : ${group.label} (${group.id}).`;
}

function defeatLog(groupId: string): string {
  return `Le groupe ${groupId} est vaincu.`;
}

function withRespawnedGroup(input: RespawnInput, position: Position): ExplorationState {
  const group = buildGroup(input.spawn, nextGroupId(input.state), position);
  const monsterGroups = [...input.state.monsterGroups, group];
  return { ...input.state, monsterGroups, log: [...input.state.log, respawnLog(group)] };
}

export function respawnMonsterGroup(input: RespawnInput): ExplorationState {
  const position = pickCandidate(respawnCandidates(input.state), input.rng);
  if (position === undefined) return input.state;
  return withRespawnedGroup(input, position);
}

export function defeatGroup(state: ExplorationState, groupId: string): ExplorationState {
  const monsterGroups = state.monsterGroups.filter((group) => group.id !== groupId);
  if (monsterGroups.length === state.monsterGroups.length) return state;
  return { ...state, monsterGroups, log: [...state.log, defeatLog(groupId)] };
}
