import type { Rng } from "./types";

/**
 * Tirage de spawn d'exploration : module **pur**.
 * Il ne connaît ni YAML, ni React, ni PixiJS, ni `window` : la table lui est
 * passée en argument par le store, qui l'a déjà parsée.
 */
export interface WeightedMonster {
  readonly monsterId: string;
  readonly weight: number;
}

export interface SpawnZone {
  readonly id: string;
  readonly mapId: string;
  readonly monsters: readonly WeightedMonster[];
}

export interface SpawnPick {
  readonly monsterId: string;
  readonly zoneId: string;
  /** `true` quand la map courante n'a aucune zone : repli sur la première. */
  readonly fallback: boolean;
}

export interface PickSpawnInput {
  zones: readonly SpawnZone[];
  mapId: string;
  rng: Rng;
}

export interface ZoneSelection {
  zone: SpawnZone;
  fallback: boolean;
}

function at<T>(list: readonly T[], index: number): T {
  const value = list[index];
  if (value === undefined) throw new Error(`spawnTable: index ${index} hors bornes`);
  return value;
}

export function totalWeight(monsters: readonly WeightedMonster[]): number {
  return monsters.reduce((sum, entry) => sum + entry.weight, 0);
}

/** Bornes cumulées hautes : `[w1, w1+w2, …]`, supports du tirage. */
export function cumulativeWeights(monsters: readonly WeightedMonster[]): number[] {
  return monsters.reduce<number[]>((bounds, entry) => [...bounds, (bounds[bounds.length - 1] ?? 0) + entry.weight], []);
}

/** `rng` fixé ⇒ monstre fixé : aucun accès direct au hasard ici. */
export function pickWeighted(monsters: readonly WeightedMonster[], rng: Rng): WeightedMonster {
  const bounds = cumulativeWeights(monsters);
  const target = rng() * (bounds[bounds.length - 1] ?? 0);
  const index = bounds.findIndex((bound) => target < bound);
  return at(monsters, index === -1 ? monsters.length - 1 : index);
}

/** Map sans zone déclarée : première zone en repli, jamais une exception. */
export function zoneForMap(zones: readonly SpawnZone[], mapId: string): ZoneSelection {
  const zone = zones.find((entry) => entry.mapId === mapId);
  if (zone !== undefined) return { zone, fallback: false };
  return { zone: at(zones, 0), fallback: true };
}

export function pickSpawn(input: PickSpawnInput): SpawnPick {
  const { zone, fallback } = zoneForMap(input.zones, input.mapId);
  const monster = pickWeighted(zone.monsters, input.rng);
  return { monsterId: monster.monsterId, zoneId: zone.id, fallback };
}
