import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import type { ExplorationState, MonsterGroup, MonsterSpawn, RespawnInput, Rng } from "./types";

const GROUP_ID_PREFIX = "group-";
const GROUP_ID_PATTERN = /group-(\d+)/g;
/**
 * Marge du respawn : **trois** cases, comme `MIN_GROUP_DISTANCE` du placement
 * initial, appliquée au héros ET à chaque case d'entrée (`P` + sorties). La
 * dette « 4 cases mais sorties ignorées » est soldée ici.
 */
const MIN_RESPAWN_DISTANCE = 3;
const SATURATED_LOG = "La carte est saturée : aucun groupe ne peut réapparaître.";

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

function farFromAnchors(state: ExplorationState, position: Position): boolean {
  const anchors = [state.playerPos, ...state.entries];
  return anchors.every((cell) => manhattan(position, cell) >= MIN_RESPAWN_DISTANCE);
}

function isRespawnCell(state: ExplorationState, position: Position): boolean {
  if (!isWalkableCell(state.map, position)) return false;
  if (getMonsterGroupAt(state, position) !== null) return false;
  return farFromAnchors(state, position);
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

function withRespawnedGroup(state: ExplorationState, spawn: MonsterSpawn, position: Position): ExplorationState {
  const group = buildGroup(spawn, nextGroupId(state), position);
  const monsterGroups = [...state.monsterGroups, group];
  const log = [...state.log, respawnLog(group)];
  return { ...state, monsterGroups, log, respawns: state.respawns + 1 };
}

function respawnOnce(state: ExplorationState, spawn: MonsterSpawn, rng: Rng): ExplorationState {
  const position = pickCandidate(respawnCandidates(state), rng);
  return position === undefined ? state : withRespawnedGroup(state, spawn, position);
}

/** Ce qu'une passe de repeuplement traîne : la carte, le monstre, l'aléa. */
interface TopUpInput {
  state: ExplorationState;
  spawn: MonsterSpawn;
  rng: Rng;
}

/** Boucle **bornée par `wanted`** : à court de cases, elle s'arrête net. */
function topUpGroups(input: TopUpInput, wanted: number): ExplorationState {
  let current = input.state;
  for (let placed = 0; placed < wanted; placed += 1) {
    const next = respawnOnce(current, input.spawn, input.rng);
    if (next === current) return current;
    current = next;
  }
  return current;
}

/** Rien de libre alors que la zone demande encore des groupes : on le dit. */
function saturationLog(state: ExplorationState, minGroups: number): ExplorationState {
  if (state.monsterGroups.length >= minGroups) return state;
  return { ...state, log: [...state.log, SATURATED_LOG] };
}

/**
 * Repeuple la carte jusqu'au `min` de la zone. Aucun groupe sur un mur, une eau,
 * le héros, une sortie ou un autre groupe ; tous à trois cases du héros et de
 * chaque entrée. Carte pleine : aucun ajout, une ligne de journal, aucune boucle.
 */
export function respawnMonsterGroup(input: RespawnInput): ExplorationState {
  const wanted = input.minGroups - input.state.monsterGroups.length;
  if (wanted <= 0) return input.state;
  const filled = topUpGroups({ state: input.state, spawn: input.spawn, rng: input.rng }, wanted);
  return saturationLog(filled, input.minGroups);
}

export function defeatGroup(state: ExplorationState, groupId: string): ExplorationState {
  const monsterGroups = state.monsterGroups.filter((group) => group.id !== groupId);
  if (monsterGroups.length === state.monsterGroups.length) return state;
  return { ...state, monsterGroups, log: [...state.log, defeatLog(groupId)] };
}
