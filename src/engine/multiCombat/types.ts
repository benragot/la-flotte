import type { Element } from "../../schemas/spellSchema";
import type { SpellLimit, SpellUsageMap } from "../combat";
import type { CombatResistances, Rng } from "../combatLoop/types";
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
  /** Résistances par élément, alignées sur `CombatantState` (1v1). */
  resistances: CombatResistances;
  /** Armure plate optionnelle, cumulée aux résistances fixes dans `computeDamage`. */
  armor?: number;
  /** Sorts du combattant, recopiés depuis la donnée (`MonsterDef` / héros). */
  spellIds?: readonly string[];
  /** Initiative déjà calculée par l'appelant via `computeInitiative`. */
  initiative: number;
}

/** Portée d'un sort : bornes incluses, en cases (distance de `combatLoop/cells`). */
export interface RangeSpec {
  min: number;
  max: number;
  requiresLos: boolean;
}

export interface BattleState {
  turn: number;
  /** Ids triés par initiative décroissante (départage déterministe par id). */
  order: string[];
  activeIndex: number;
  combatants: CombatantLike[];
  log: string[];
  /**
   * Grille de la salle. Sans elle, aucune contrainte géométrique n'est
   * appliquée : le comportement 5C-c (portée infinie, murs traversés) reste
   * celui des appels qui ne fournissent pas de carte.
   */
  map?: AsciiMap;
  /**
   * Portée du sort de dégâts du héros, dérivée de `data/spells.yaml` par
   * l'appelant : le panneau n'a pas accès aux sorts et ne peut donc pas la
   * recalculer. Absente = aucune cible n'est marquée hors portée.
   */
  castRange?: RangeSpec;
  /**
   * Quotas de lancement par lanceur et par sort (`castsPerTurn`, `cooldown`),
   * portés par la bataille. Absent = aucun sort à quota n'a encore été lancé.
   */
  spellUsage?: SpellUsageMap;
}

export interface AttackSpec extends SpellLimit {
  base: number;
  element: Element;
  baseCrit: number;
  bonusCrit?: number;
  /** Bonus de dégâts (%) ajouté en cas de coup critique (défaut 0). */
  critDamagePct?: number;
  /** Cases de poussée ; 0 ou absent = pas de poussée. */
  pushCells?: number;
  /** Valeur de dé de la poussée (voir `computePushbackDamage`). */
  roll?: number;
  apCost: number;
  /**
   * Sort d'origine : clé des quotas `castsPerTurn`/`cooldown`. Sans lui, le
   * coup est une attaque nue, jamais soumise à une recharge.
   */
  spellId?: string;
  /** Nom du sort, pour un journal lisible ; absent = attaque nue. */
  spellName?: string;
  /**
   * Portée de l'attaque. Absente (`minRange`/`maxRange` non fournis) = aucune
   * contrainte : une attaque nue ou une grille absente garde le comportement
   * historique.
   */
  minRange?: number;
  maxRange?: number;
  /** Ligne de vue exigée (défaut `false`). */
  requiresLos?: boolean;
}

export type EnemyAction =
  | { kind: "attack"; targetId: string; attack: AttackSpec }
  | { kind: "move"; to: Position }
  /** Ni approche ni attaque possible : la raison part au journal, pas de no-op muet. */
  | { kind: "blocked"; reason: string };

/** Stratégie injectée : rend une action ou `null` pour finir le tour. */
export type EnemyStrategy = (state: BattleState, enemyId: string) => EnemyAction | null;
