import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import { buildGroupOf } from "./groups";
import { cumulativeWeights } from "./spawnTable";
import type { CountRange, MonsterGroup, Rng, RosterEntry, SpawnPlan } from "./types";

/** Congruentiel linéaire : la convention de graine du projet (`SPAWN_SEED`). */
const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;
const UINT32 = 4_294_967_296;

const FNV_OFFSET = 2_166_136_261;
const FNV_PRIME = 16_777_619;

/**
 * Un groupe ne doit jamais apparaître sous le nez du héros : trois cases de
 * marge autour de CHAQUE case d'entrée de la carte (départ `P` et sorties).
 * Le héros n'apparaît jamais ailleurs, donc il n'ouvre jamais un combat collé.
 */
export const MIN_GROUP_DISTANCE = 3;

const GROUP_ID_PREFIX = "group-";

/** Générateur déterministe : même graine ⇒ même suite, aucun `Math.random`. */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state * LCG_MULTIPLIER + LCG_INCREMENT) % UINT32;
    return state / UINT32;
  };
}

/**
 * Graine stable d'une carte : FNV-1a sur son identifiant. `initExploration` est
 * rappelé à chaque changement de carte ; sans cette dérivation, les groupes
 * changeraient de place à chaque retour sur la même carte.
 */
export function seedForMap(mapId: string): number {
  const hash = [...mapId].reduce((acc, char) => Math.imul(acc ^ char.charCodeAt(0), FNV_PRIME), FNV_OFFSET);
  return hash >>> 0;
}

/**
 * Graine d'un respawn : `(mapId, rang du respawn)` hachés par la même FNV-1a que
 * `seedForMap`. La carte rechargée repart à `respawns = 0` et **rejoue la même
 * suite** ; deux respawns successifs ne tirent jamais la même graine.
 */
export function seedForRespawn(mapId: string, respawns: number): number {
  return seedForMap(`${mapId}#respawn#${respawns}`);
}

export interface PlacementInput {
  map: AsciiMap;
  /**
   * Cases où le héros peut apparaître : départ `P` de la carte et cases de
   * sortie. Elles portent les deux règles de sécurité (jamais un groupe
   * dessus, jamais un groupe à moins de `MIN_GROUP_DISTANCE`), ce qui rend la
   * disposition **indépendante du trajet** : on revient par l'est ou l'ouest,
   * les monstres n'ont pas bougé.
   */
  entryPoints: readonly Position[];
  plan: SpawnPlan;
  rng: Rng;
}

export interface Placement {
  groups: MonsterGroup[];
  /** Compte demandé par la zone : sert au journal quand la carte est trop petite. */
  requested: number;
}

/** Ce qu'un placement traîne de case en case : la carte, les entrées, les prises. */
interface CellField {
  map: AsciiMap;
  entries: readonly Position[];
  used: Position[];
}

interface FillInput {
  field: CellField;
  anchors: readonly Position[];
  plan: SpawnPlan;
  total: number;
  rng: Rng;
}

interface GroupInput {
  index: number;
  pos: Position;
  rng: Rng;
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isUsed(field: CellField, cell: Position): boolean {
  return field.used.some((used) => samePosition(used, cell));
}

function isEntry(field: CellField, cell: Position): boolean {
  return field.entries.some((entry) => samePosition(entry, cell));
}

function farFromEntries(field: CellField, cell: Position): boolean {
  return field.entries.every((entry) => manhattan(cell, entry) >= MIN_GROUP_DISTANCE);
}

/** Mur, eau, case d'entrée, marge de sécurité et hors grille : tout est refusé. */
function isFree(field: CellField, cell: Position): boolean {
  if (!isWalkableCell(field.map, cell)) return false;
  if (isEntry(field, cell)) return false;
  return farFromEntries(field, cell);
}

function allCells(map: AsciiMap): Position[] {
  const cells: Position[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) cells.push({ x, y });
  }
  return cells;
}

/** Ordre row-major : la même carte donne toujours la même liste de candidates. */
function freeCells(field: CellField): Position[] {
  return allCells(field.map).filter((cell) => isFree(field, cell) && !isUsed(field, cell));
}

/** Ancre historique : les `M` de la grille passent en premier, jamais en doublon. */
function anchorCells(field: CellField): Position[] {
  return field.map.monsterSpawns.filter((cell) => isFree(field, cell));
}

function nextInt(range: CountRange, rng: Rng): number {
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

/** `rng` fixé ⇒ case fixée ; `undefined` quand la carte n'offre plus rien. */
function pickCell(field: CellField, rng: Rng): Position | undefined {
  const free = freeCells(field);
  if (free.length === 0) return undefined;
  return free[Math.floor(rng() * free.length)];
}

function pickRoster(roster: readonly RosterEntry[], rng: Rng): RosterEntry {
  const bounds = cumulativeWeights(roster);
  const target = rng() * (bounds.at(-1) ?? 0);
  const index = bounds.findIndex((bound) => target < bound);
  const entry = roster[index === -1 ? roster.length - 1 : index];
  if (entry === undefined) throw new Error("exploration: vivier de la zone vide");
  return entry;
}

function membersOf(plan: SpawnPlan, count: number, rng: Rng): RosterEntry[] {
  return Array.from({ length: count }, () => pickRoster(plan.roster, rng));
}

function groupAt(plan: SpawnPlan, input: GroupInput): MonsterGroup {
  const members = membersOf(plan, nextInt(plan.members, input.rng), input.rng);
  return buildGroupOf(members, `${GROUP_ID_PREFIX}${input.index + 1}`, input.pos);
}

function takePosition(field: CellField, anchors: readonly Position[], rng: Rng): Position | undefined {
  const anchor = anchors.find((cell) => !isUsed(field, cell));
  return anchor ?? pickCell(field, rng);
}

/** Borne dure `total` : une carte saturée sort de la boucle, elle ne gèle pas. */
function fillGroups(input: FillInput): MonsterGroup[] {
  const groups: MonsterGroup[] = [];
  while (groups.length < input.total) {
    const pos = takePosition(input.field, input.anchors, input.rng);
    if (pos === undefined) break;
    input.field.used.push(pos);
    groups.push(groupAt(input.plan, { index: groups.length, pos, rng: input.rng }));
  }
  return groups;
}

/**
 * Placement déterministe des groupes d'une zone. Aucun groupe sur un mur, une
 * eau, une case d'entrée ; jamais deux sur la même case ; tous à
 * `MIN_GROUP_DISTANCE` de chaque case d'entrée. Si la carte est trop petite, on
 * place ce qu'on peut et `requested` le dit — la boucle est bornée par le compte.
 */
export function placeGroups(input: PlacementInput): Placement {
  const field: CellField = { map: input.map, entries: input.entryPoints, used: [] };
  const total = nextInt(input.plan.groups, input.rng);
  const anchors = anchorCells(field);
  const groups = fillGroups({ field, anchors, plan: input.plan, total, rng: input.rng });
  return { groups, requested: total };
}
