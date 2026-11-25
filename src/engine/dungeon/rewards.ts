import type { LootEntry, MonsterDef } from "../../schemas/monsterSchema";
import type { ProgressionDef } from "../../schemas/progressionSchema";
import type { RewardsMultipliers } from "../combatLoop/rewards";
import { resolveCombatRewards } from "../combatLoop/rewards";
import type { CombatRewards, CombatantState, Rng } from "../combatLoop/types";

/** Un groupe de salle : la donnée monstre et son nombre d'occurrences. */
export interface RoomMonsterGroup {
  monster: MonsterDef;
  count: number;
}

export interface RoomRewardsInput {
  heroXp: number;
  hero: CombatantState;
  groups: readonly RoomMonsterGroup[];
  progression: ProgressionDef;
  rng: Rng;
  multipliers?: RewardsMultipliers;
}

export interface RoomRewards extends CombatRewards {
  kamas: number;
}

function instances(groups: readonly RoomMonsterGroup[]): MonsterDef[] {
  return groups.flatMap((group) => Array.from({ length: group.count }, () => group.monster));
}

function strongestOf(monsters: readonly MonsterDef[]): MonsterDef {
  return monsters.reduce((best, monster) => (monster.level > best.level ? monster : best));
}

/** COMBAT-09 : base = Σ des `baseXp`, niveau = `max(M)` pour l'écart et l'anti-farm. */
function aggregateMonster(monsters: readonly MonsterDef[]): MonsterDef {
  const baseXp = monsters.reduce((total, monster) => total + monster.baseXp, 0);
  const loot: LootEntry[] = monsters.flatMap((monster) => monster.loot);
  return { ...strongestOf(monsters), baseXp, loot };
}

function kamasRange(monster: MonsterDef): { min: number; max: number } | null {
  const { kamasMin, kamasMax } = monster;
  return kamasMin === undefined || kamasMax === undefined ? null : { min: kamasMin, max: kamasMax };
}

function rollInt(min: number, max: number, rng: Rng): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Une absence de kamas dans le YAML vaut zéro : aucun plancher inventé. */
function kamasOf(monster: MonsterDef, rng: Rng): number {
  const range = kamasRange(monster);
  return range === null ? 0 : rollInt(range.min, range.max, rng);
}

/** DATA-02 : un tirage entier par monstre de la salle, sommé. */
export function rollRoomKamas(groups: readonly RoomMonsterGroup[], rng: Rng): number {
  return instances(groups).reduce((total, monster) => total + kamasOf(monster, rng), 0);
}

/**
 * Récompenses d'une salle nettoyée : mêmes formules 1.29 que le 1v1, avec
 * l'agrégat Σ`baseXp` / `max(M)` (COMBAT-09). `null` pour une salle vide.
 */
export function resolveRoomRewards(input: RoomRewardsInput): RoomRewards | null {
  const monsters = instances(input.groups);
  if (monsters.length === 0) return null;
  const rewards = { ...input, monster: aggregateMonster(monsters) };
  return { ...resolveCombatRewards(rewards), kamas: rollRoomKamas(input.groups, input.rng) };
}
