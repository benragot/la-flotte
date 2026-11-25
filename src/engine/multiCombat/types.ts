import type { Element } from "../../schemas/spellSchema";
import type { FloatingEvent, SpellLimit, SpellUsageMap } from "../combat";
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
  /** `% Dégâts` de l'équipement (défaut 0), appliqué avant les résistances. */
  percentDmg?: number;
  /** Armure plate optionnelle, cumulée aux résistances fixes dans `computeDamage`. */
  armor?: number;
  /** Sorts du combattant, recopiés depuis la donnée (`MonsterDef` / héros). */
  spellIds?: readonly string[];
  /** Initiative déjà calculée par l'appelant via `computeInitiative`. */
  initiative: number;
}

/** Portée d'un sort : bornes incluses, en cases (Chebyshev, `grid/range`). */
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
  /** Derniers coups reçus, bornés : le rendu anime ce qu'il n'a pas encore vu. */
  floats?: readonly FloatingEvent[];
}

/** Fourchette de dégâts d'un sort, bornes incluses. */
export interface DamageRange {
  min: number;
  max: number;
}

export interface AttackSpec extends SpellLimit {
  /**
   * Base fixe du jet **non critique** (attaque nue, tests). Ignorée dès que
   * `damage` est fourni : le moteur tire alors lui-même, après le CC.
   */
  base: number;
  /** Fourchette du sort : le dé de dégâts n'est consommé que hors coup critique. */
  damage?: DamageRange;
  element: Element;
  /** Dénominateur du coup critique (`1/X`) ; **absent = aucun CC**. */
  critRate?: number;
  /** `+CC` d'équipement, retiré du dénominateur **avant** l'Agilité. */
  bonusCrit?: number;
  /**
   * Jet du coup critique ; défaut = le **maximum** de `damage`. Le CC
   * substitue le jet, il n'additionne aucun pourcentage.
   */
  critMax?: DamageRange;
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
