import type { Element } from "../../schemas/spellSchema";
import type { Rng } from "../combatLoop/types";
import type { AsciiMap, Position } from "../grid";

export type { Rng };

export type Side = "player" | "enemy";

export interface CombatStats {
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
  wisdom: number;
}

export interface CombatantLike {
  id: string;
  side: Side;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  mp: number;
  maxMp: number;
  position: Position;
  stats: CombatStats;
  /** Initiative déjà calculée par l'appelant via `computeInitiative`. */
  initiative: number;
}

export interface BattleState {
  turn: number;
  /** Ids triés par initiative décroissante (départage déterministe par id). */
  order: string[];
  activeIndex: number;
  combatants: CombatantLike[];
  log: string[];
  /** Carte optionnelle : seule la poussée contre un mur en dépend. */
  map?: AsciiMap;
}

export interface AttackSpec {
  base: number;
  element: Element;
  baseCrit: number;
  bonusCrit?: number;
  /** Cases de poussée ; 0 ou absent = pas de collision possible. */
  pushCells?: number;
  /** Valeur de dé de la poussée (voir `computePushbackDamage`). */
  roll?: number;
  apCost: number;
}

export type EnemyAction =
  | { kind: "attack"; targetId: string; attack: AttackSpec }
  | { kind: "move"; to: Position };

/** Stratégie injectée : rend une action ou `null` pour finir le tour. */
export type EnemyStrategy = (state: BattleState, enemyId: string) => EnemyAction | null;
