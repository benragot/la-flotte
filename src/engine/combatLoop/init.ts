import type { MonsterDef } from "../../schemas/monsterSchema";
import type { Element, SpellDef } from "../../schemas/spellSchema";
import type { Hero } from "../createHero";
import type { AsciiMap, Position } from "../grid";
import { isWalkableCell, samePosition } from "../grid";
import { allPositions, manhattan } from "./cells";
import type {
  CombatResistances,
  CombatStats,
  CombatantKind,
  CombatantState,
  CombatState,
} from "./types";

export interface InitCombatInput {
  map: AsciiMap;
  hero: Hero;
  monster: MonsterDef;
  spells: readonly SpellDef[];
}

interface CombatantBase {
  id: string;
  kind: CombatantKind;
  name: string;
  position: Position;
}

const NO_ELEMENT_RES: Record<Element, number> = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function zeroStats(): CombatStats {
  return { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
}

function zeroResistances(): CombatResistances {
  return { flat: { ...NO_ELEMENT_RES }, percent: { ...NO_ELEMENT_RES } };
}

function requireSpawn(spawns: readonly Position[], label: string): Position {
  const spawn = spawns[0];
  if (spawn === undefined) throw new Error(`placement ${label} absent de la carte`);
  return spawn;
}

/** Une carte d'extérieur sans `M` : le monstre s'écarte du héros au lieu d'échouer. */
function farFromOrigin(a: Position, b: Position, origin: Position): boolean {
  return manhattan(origin, a) > manhattan(origin, b);
}

/** Case praticable la plus loin du héros, départage en lecture (jamais la sienne). */
function farthestCell(map: AsciiMap, player: Position): Position | null {
  const cells = allPositions(map).filter((cell) => isWalkableCell(map, cell) && !samePosition(cell, player));
  return cells.reduce<Position | null>((best, cell) => keepFarther(best, cell, player), null);
}

/** Conserve la meilleure candidate : le premier maximum rencontré gagne. */
function keepFarther(best: Position | null, cell: Position, origin: Position): Position {
  if (best === null) return cell;
  return farFromOrigin(cell, best, origin) ? cell : best;
}

/**
 * Case de l'ennemi : les `M` de `data/maps.yaml` d'abord (la plage, les salles),
 * sinon la case praticable la plus loin du héros. Quai et cale déclarent leurs
 * monstres dans `data/spawns.yaml` et n'ont aucun `M` : sans ce repli, cliquer
 * un groupe levait « placement monstre absent de la carte » et n'ouvrait RIEN.
 */
function enemySpawn(map: AsciiMap, player: Position): Position {
  const declared = map.monsterSpawns.filter((cell) => isWalkableCell(map, cell))[0];
  if (declared !== undefined) return declared;
  const fallback = farthestCell(map, player);
  if (fallback === null) throw new Error("placement monstre absent de la carte");
  return fallback;
}

function vitals(source: { hp: number; ap: number; mp: number }): Partial<CombatantState> {
  const { hp, ap, mp } = source;
  return { hp, maxHp: hp, ap, maxAp: ap, mp, maxMp: mp };
}

function spellIdsFor(spells: readonly SpellDef[], classId: string): string[] {
  return spells.filter((spell) => spell.classId === classId).map((spell) => spell.id);
}

function indexSpells(spells: readonly SpellDef[]): Record<string, SpellDef> {
  return Object.fromEntries(spells.map((spell) => [spell.id, spell]));
}

function combatantBase(input: CombatantBase): CombatantState {
  const defaults = { level: 1, hp: 1, maxHp: 1, ap: 0, maxAp: 0, mp: 0, maxMp: 0, accuracyPct: 0, pp: 0, percentDmg: 0 };
  const extras = { stats: zeroStats(), resistances: zeroResistances(), spellIds: [] };
  return { ...input, ...defaults, ...extras };
}

function buildPlayer(input: InitCombatInput): CombatantState {
  const { hero, map } = input;
  const position = requireSpawn(map.playerSpawns, "joueur");
  const base = combatantBase({ id: "player", kind: "player", name: hero.name, position });
  const extras = { level: hero.level, pp: hero.pp, spellIds: spellIdsFor(input.spells, hero.classId) };
  return { ...base, ...vitals(hero), ...extras };
}

function buildEnemy(input: InitCombatInput, player: Position): CombatantState {
  const { monster, map } = input;
  const position = enemySpawn(map, player);
  const base = combatantBase({ id: monster.id, kind: "enemy", name: monster.name, position });
  const extras = { level: monster.level, pp: 0, spellIds: monster.spellIds };
  return { ...base, ...vitals(monster), ...extras, stats: monster.stats, resistances: monster.resistances };
}

function openingLog(player: CombatantState, enemy: CombatantState): string[] {
  return [`${player.name} affronte ${enemy.name}.`];
}

/**
 * État de combat brut : la phase vaut ici `player_turn` par défaut. Le 1v1
 * la corrige via `beginCombat` **après** l'équipement du héros.
 */
export function initCombat(input: InitCombatInput): CombatState {
  const player = buildPlayer(input);
  const enemy = buildEnemy(input, player.position);
  const base = { turn: 1, map: input.map, player, enemy, rewards: null };
  const spellsById = indexSpells(input.spells);
  return { ...base, phase: "player_turn", spellsById, log: openingLog(player, enemy) };
}
