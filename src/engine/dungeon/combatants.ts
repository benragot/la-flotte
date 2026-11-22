import type { MonsterDef } from "../../schemas/monsterSchema";
import type { CombatantState } from "../combatLoop/types";
import { computeInitiative } from "../combat/initiative";
import type { Position } from "../grid";
import type { CombatantLike, Side } from "../multiCombat";

/** Placement par défaut : le placement réel des N ennemis est du ressort de la Vague 5C. */
const ORIGIN: Position = { x: 0, y: 0 };

/** Tout ce qu'un `CombatantLike` porte hors `side`, `position` et `initiative`. */
type BattleSource = Omit<CombatantLike, "side" | "position" | "initiative">;

export interface MonsterCombatantInput {
  monster: MonsterDef;
  index: number;
  position?: Position;
}

export interface HeroBattleInput {
  combatant: CombatantState;
  position?: Position;
}

export interface BattleSetupInput {
  hero: { combatant: CombatantLike };
  monsters: readonly { monster: MonsterDef; count: number }[];
  startingPositions?: { hero: Position; monsters: Position[] };
}

export interface BattleSetup {
  combatants: CombatantLike[];
  playerId: string;
}

function copyResistances(resistances: CombatantLike["resistances"]): CombatantLike["resistances"] {
  return { flat: { ...resistances.flat }, percent: { ...resistances.percent } };
}

/** Initiative toujours déléguée à `computeInitiative` : aucun doublon de formule. */
function initiativeFor(source: BattleSource): number {
  const { strength, intelligence, chance, agility } = source.stats;
  const input = { strength, intelligence, chance, agility, currentHp: source.hp, maxHp: source.maxHp };
  return computeInitiative(input);
}

function withSide(source: BattleSource, side: Side, position: Position): CombatantLike {
  const stats = { ...source.stats };
  const resistances = copyResistances(source.resistances);
  return { ...source, side, position, stats, resistances, initiative: initiativeFor(source) };
}

function monsterSource(monster: MonsterDef, index: number): BattleSource {
  const pools = { hp: monster.hp, maxHp: monster.hp, ap: monster.ap, maxAp: monster.ap, mp: monster.mp, maxMp: monster.mp };
  const identity = { id: `${monster.id}-${index}`, name: monster.name, level: monster.level };
  return { ...identity, ...pools, stats: monster.stats, resistances: monster.resistances, spellIds: [...monster.spellIds] };
}

/** Pont `MonsterDef` → `CombatantLike` : id déterministe, aucune donnée en dur. */
export function monsterCombatant(input: MonsterCombatantInput): CombatantLike {
  const position = input.position ?? ORIGIN;
  return withSide(monsterSource(input.monster, input.index), "enemy", position);
}

/** Pont héros 1v1 → combattant 1vN : ajoute `side` et l'initiative calculée. */
export function heroBattleCombatant(input: HeroBattleInput): CombatantLike {
  const { combatant } = input;
  return withSide(combatant, "player", input.position ?? combatant.position);
}

type BattleGroupInput = BattleSetupInput["monsters"][number];

function expandGroup(group: BattleGroupInput): MonsterDef[] {
  return Array.from({ length: group.count }, () => group.monster);
}

function enemyCombatants(input: BattleSetupInput): CombatantLike[] {
  const positions = input.startingPositions?.monsters ?? [];
  const spawn = (monster: MonsterDef, index: number) => monsterCombatant({ monster, index, position: positions[index] });
  return input.monsters.flatMap(expandGroup).map(spawn);
}

/** Compose un combat de salle : un héros + `count` copies de chaque monstre. */
export function setupDungeonBattle(input: BattleSetupInput): BattleSetup {
  const { combatant } = input.hero;
  const hero = withSide(combatant, "player", input.startingPositions?.hero ?? combatant.position);
  return { combatants: [hero, ...enemyCombatants(input)], playerId: hero.id };
}
