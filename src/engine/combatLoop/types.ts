import type { Element, SpellDef } from "../../schemas/spellSchema";
import type { FloatingEvent, SpellUsageMap } from "../combat";
import type { LevelUpGain } from "../economy";
import type { AsciiMap, Position } from "../grid";

/** Source d'aléa injectée, retourne une valeur dans `[0, 1[`. */
export type Rng = () => number;

export type CombatPhase = "player_turn" | "enemy_turn" | "victory" | "defeat";

export type CombatantKind = "player" | "enemy";

export type CombatStatKey = "strength" | "intelligence" | "chance" | "agility" | "wisdom";

export interface CombatStats {
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
  wisdom: number;
}

export interface CombatResistances {
  flat: Record<Element, number>;
  percent: Record<Element, number>;
}

export interface CombatantState {
  id: string;
  kind: CombatantKind;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  mp: number;
  maxMp: number;
  /** Précision en pourcentage : réservée à la Vague 2, inutilisée en V1. */
  accuracyPct: number;
  pp: number;
  /** `% Dégâts` de l'équipement, appliqué à la base avant toute résistance. */
  percentDmg: number;
  position: Position;
  stats: CombatStats;
  resistances: CombatResistances;
  spellIds: string[];
  /**
   * Initiative stockée par grade en 1.29, projetée depuis `MonsterDef` par
   * `initCombat`. Sa précédence sur la formule vit dans `computeInitiative`,
   * jamais dans une règle locale au moteur 1v1.
   */
  storedInitiative?: number;
}

export interface CombatRewards {
  xpGained: number;
  totalXp: number;
  level: number;
  levelUp: LevelUpGain | null;
  prospection: number;
  drops: string[];
  /** Kamas gagnés : renseigné par une salle de donjon, absent en 1v1 (DATA-02). */
  kamas?: number;
  /**
   * Niveau du héros **avant** le crédit. Renseigné par le store au moment où il
   * crédite, pour l'écran de fin unifié : aucune formule ne lit ce champ.
   */
  levelBefore?: number;
}

export interface CombatState {
  phase: CombatPhase;
  turn: number;
  map: AsciiMap;
  player: CombatantState;
  enemy: CombatantState;
  spellsById: Record<string, SpellDef>;
  log: string[];
  rewards: CombatRewards | null;
  /** Quotas `castsPerTurn`/`cooldown` par lanceur et par sort, portés par le combat. */
  spellUsage?: SpellUsageMap;
  /** Derniers coups reçus, bornés : le rendu anime ce qu'il n'a pas encore vu. */
  floats?: readonly FloatingEvent[];
}
