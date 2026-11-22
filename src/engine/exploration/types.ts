import type { AsciiMap, Position } from "../grid";

/** Source d'aléa injectée, retourne une valeur dans `[0, 1[`. */
export type Rng = () => number;

export interface MonsterGroup {
  id: string;
  pos: Position;
  monsterIds: string[];
  totalLevel: number;
  label: string;
}

export interface ExplorationState {
  map: AsciiMap;
  playerPos: Position;
  monsterGroups: MonsterGroup[];
  log: string[];
  /** Cases d'entrée : départ `P` + sorties. Le respawn les traite comme le héros. */
  entries: Position[];
  /** Respawns déjà effectués sur cette carte : dérive la graine du tirage. */
  respawns: number;
}

export interface MoveResult {
  state: ExplorationState;
  path: Position[];
}

/** Description d'un monstre à instancier : le moteur ne connaît aucune donnée métier. */
export interface MonsterSpawn {
  monsterId: string;
  monsterName: string;
  level: number;
}

export interface InitExplorationInput extends MonsterSpawn {
  map: AsciiMap;
  /**
   * Plan de peuplement de la zone (compte de groupes, vivier pondéré). Sans
   * plan, le comportement historique reste : un groupe sur la première ancre.
   */
  plan?: SpawnPlan;
  /** Aléa injecté du placement ; défaut déterministe (graine nulle). */
  rng?: Rng;
  /**
   * Cases de sortie de la carte : le héros y apparaît en arrivant, donc aucune
   * ne reçoit de groupe ni son voisinage immédiat. Le moteur ne lit pas
   * `maps.yaml` : c'est l'appelant qui les fournit.
   */
  safeCells?: readonly Position[];
}

/** Deux bornes incluses d'un compte tiré en jeu, écrites en donnée. */
export interface CountRange {
  readonly min: number;
  readonly max: number;
}

/** Un monstre du vivier de la zone, avec son poids de tirage et sa fiche. */
export interface RosterEntry {
  readonly monsterId: string;
  readonly weight: number;
  readonly monsterName: string;
  readonly level: number;
}

/**
 * Ce qu'une zone demande : combien de groupes, combien de monstres par groupe et
 * dans quel vivier pondéré. Les cases interdites viennent de la carte
 * (`P` + sorties), jamais de la zone.
 */
export interface SpawnPlan {
  readonly groups: CountRange;
  readonly members: CountRange;
  readonly roster: readonly RosterEntry[];
}

/**
 * Un groupe vaincu est remplacé **immédiatement** : la carte remonte au `min` de
 * sa zone. `rng` vient de l'appelant, seedé par `seedForRespawn(mapId, respawns)`.
 */
export interface RespawnInput {
  state: ExplorationState;
  spawn: MonsterSpawn;
  /** `groups.min` de la zone : cible du repeuplement. */
  minGroups: number;
  rng: Rng;
}
