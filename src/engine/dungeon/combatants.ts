import type { MonsterDef } from "../../schemas/monsterSchema";
import type { CombatantState } from "../combatLoop/types";
import { computeInitiative } from "../combat/initiative";
import type { AsciiMap, Position } from "../grid";
import type { CombatantLike, Side } from "../multiCombat";
import { placeBattle } from "./placement";

/** Placement par défaut : sans carte, tout le monde reste à l'origine (5C-c). */
const ORIGIN: Position = { x: 0, y: 0 };

/** Tout ce qu'un `CombatantLike` porte hors `side`, `position` et `initiative`. */
type BattleSource = Omit<CombatantLike, "side" | "position" | "initiative">;

export interface MonsterCombatantInput {
  monster: MonsterDef;
  index: number;
  position?: Position;
  /** Facteur de PV de la salle (DEC-03) : `Math.floor(hp × hpScale)`. */
  hpScale?: number;
}

export interface HeroBattleInput {
  combatant: CombatantState;
  position?: Position;
}

export interface BattleSetupInput {
  hero: { combatant: CombatantLike };
  monsters: readonly { monster: MonsterDef; count: number }[];
  startingPositions?: { hero: Position; monsters: Position[] };
  /** Grille de la salle : active le placement déterministe (5C-d). */
  map?: AsciiMap;
  /** Facteur de PV de la salle (DEC-03), `1` quand la salle n'en déclare pas. */
  hpScale?: number;
}

export interface BattleSetup {
  combatants: CombatantLike[];
  playerId: string;
  /** Grille retenue pour le placement, absente si l'appelant n'en fournit pas. */
  map?: AsciiMap;
}

interface BattlePositions {
  hero: Position;
  monsters: Position[];
}

function copyResistances(resistances: CombatantLike["resistances"]): CombatantLike["resistances"] {
  return { flat: { ...resistances.flat }, percent: { ...resistances.percent } };
}

/**
 * Initiative toujours déléguée à `computeInitiative` : `stored` (donnée du
 * monstre, 1.29) prime sur la formule, le héros n'en porte jamais.
 */
function initiativeFor(source: BattleSource, stored?: number): number {
  const { strength, intelligence, chance, agility } = source.stats;
  const input = { strength, intelligence, chance, agility, currentHp: source.hp, maxHp: source.maxHp };
  return computeInitiative({ ...input, storedInitiative: stored });
}

interface SidePlacement {
  side: Side;
  position: Position;
  /** Initiative stockée du monstre ; le héros n'en porte jamais. */
  storedInitiative?: number;
}

function withSide(source: BattleSource, placement: SidePlacement): CombatantLike {
  const { side, position, storedInitiative } = placement;
  const stats = { ...source.stats };
  const resistances = copyResistances(source.resistances);
  const initiative = initiativeFor(source, storedInitiative);
  return { ...source, side, position, stats, resistances, initiative };
}

/**
 * PV de la salle : le facteur (DEC-03) s'applique au PV de référence AVANT
 * toute autre opération, `Math.floor` inclus (jamais d'arrondi supérieur), et
 * il est le seul modificateur de PV d'un ennemi — aucun bonus ne s'y ajoute
 * ensuite dans `withSide`.
 */
function scaledHp(monster: MonsterDef, hpScale: number): number {
  return Math.floor(monster.hp * hpScale);
}

function monsterSource(monster: MonsterDef, index: number, hpScale: number): BattleSource {
  const hp = scaledHp(monster, hpScale);
  const pools = { hp, maxHp: hp, ap: monster.ap, maxAp: monster.ap, mp: monster.mp, maxMp: monster.mp };
  const identity = { id: `${monster.id}-${index}`, name: monster.name, level: monster.level };
  const spells = { spellIds: [...monster.spellIds], ai: monster.ai };
  return { ...identity, ...pools, stats: monster.stats, resistances: monster.resistances, ...spells };
}

/** Pont `MonsterDef` → `CombatantLike` : id déterministe, aucune donnée en dur. */
export function monsterCombatant(input: MonsterCombatantInput): CombatantLike {
  const position = input.position ?? ORIGIN;
  const source = monsterSource(input.monster, input.index, input.hpScale ?? 1);
  return withSide(source, { side: "enemy", position, storedInitiative: input.monster.initiative });
}

/** Pont héros 1v1 → combattant 1vN : ajoute `side` et l'initiative calculée. */
export function heroBattleCombatant(input: HeroBattleInput): CombatantLike {
  const { combatant } = input;
  return withSide(combatant, { side: "player", position: input.position ?? combatant.position });
}

type BattleGroupInput = BattleSetupInput["monsters"][number];

function expandGroup(group: BattleGroupInput): MonsterDef[] {
  return Array.from({ length: group.count }, () => group.monster);
}

function monsterCount(groups: BattleSetupInput["monsters"]): number {
  return groups.reduce((total, group) => total + group.count, 0);
}

/** Positions explicites d'abord, sinon placement déterministe sur la carte. */
function battlePositions(input: BattleSetupInput): BattlePositions | null {
  if (input.startingPositions !== undefined) return input.startingPositions;
  if (input.map === undefined) return null;
  return placeBattle(input.map, monsterCount(input.monsters));
}

function enemyCombatants(input: BattleSetupInput, positions: readonly Position[]): CombatantLike[] {
  const spawn = (monster: MonsterDef, index: number) =>
    monsterCombatant({ monster, index, position: positions[index], hpScale: input.hpScale });
  return input.monsters.flatMap(expandGroup).map(spawn);
}

function heroPosition(input: BattleSetupInput, positions: BattlePositions | null): Position {
  return positions === null ? input.hero.combatant.position : positions.hero;
}

function monsterPositions(positions: BattlePositions | null): Position[] {
  return positions === null ? [] : positions.monsters;
}

/** Compose un combat de salle : un héros + `count` copies de chaque monstre. */
export function setupDungeonBattle(input: BattleSetupInput): BattleSetup {
  const positions = battlePositions(input);
  const hero = withSide(input.hero.combatant, { side: "player", position: heroPosition(input, positions) });
  const enemies = enemyCombatants(input, monsterPositions(positions));
  return { combatants: [hero, ...enemies], playerId: hero.id, map: input.map };
}
