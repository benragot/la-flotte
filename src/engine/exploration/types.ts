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
}

export interface MoveResult {
  state: ExplorationState;
  path: Position[];
}

export interface InitExplorationInput {
  map: AsciiMap;
  monsterId: string;
  monsterName: string;
  level: number;
}
