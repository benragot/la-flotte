import type { MonsterAi } from "../../schemas/monsterSchema";
import type { SpellDef } from "../../schemas/spellSchema";

/**
 * COMBAT-07 — traduction pure d'un bloc `ai:` en plan de jeu.
 *
 * `preferredDistance` reste une donnée : le sélecteur ne fait que choisir un
 * archétype et lire la distance. Aucune règle de portée ni de dégâts ici.
 */
export interface EnemyPlan {
  /** Distance de Chebyshev visée par rapport à la cible. */
  preferredDistance: number;
  /** `true` : fonce au contact, le comportement historique du moteur. */
  rushes: boolean;
  /** `true` : frappe dès qu'un sort porte, sans se replacer d'abord. */
  aggressive: boolean;
}

/** Contact agressif : c'est exactement ce que faisait le moteur avant cette règle. */
const CONTACT: EnemyPlan = { preferredDistance: 1, rushes: true, aggressive: true };

const ARCHETYPES: Record<string, EnemyPlan> = {
  melee_rusher: CONTACT,
  tank_tackler: CONTACT,
  pusher_control: CONTACT,
  support_healer: { preferredDistance: 4, rushes: false, aggressive: false },
  boss_custom: { preferredDistance: 2, rushes: false, aggressive: true },
};

/** Repli : sans `ai:` ou avec un archétype inconnu, le jeu d'avant COMBAT-07. */
export const DEFAULT_ENEMY_PLAN: EnemyPlan = CONTACT;

function wholeCells(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

/** Nombre, `"3–4"` (borne basse) ou `"contact"` ; `null` si illisible. */
export function readPreferredDistance(value: number | string | undefined): number | null {
  if (value === undefined) return null;
  if (typeof value === "number") return wholeCells(value);
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : wholeCells(parsed);
}

/**
 * Sélecteur pur `monster → plan`. Une distance absente prend celle de
 * l'archétype, une distance illisible aussi : aucun cas ne casse le tour.
 */
export function enemyStrategy(monster: { ai?: MonsterAi }): EnemyPlan {
  if (monster.ai === undefined) return DEFAULT_ENEMY_PLAN;
  const plan = ARCHETYPES[monster.ai.archetype] ?? DEFAULT_ENEMY_PLAN;
  const distance = readPreferredDistance(monster.ai.preferredDistance);
  return distance === null ? plan : { ...plan, preferredDistance: distance };
}

/** Intervalle de portée d'un sort, dans la métrique de `castBlock`. */
export interface SpellReach {
  min: number;
  max: number;
  requiresLos: boolean;
}

function reachOf(spell: SpellDef): SpellReach {
  return { min: spell.minRange, max: spell.maxRange, requiresLos: spell.requiresLos };
}

function wider(best: SpellReach, next: SpellReach): SpellReach {
  return next.max > best.max ? next : best;
}

/** Portée du sort qui laisse le plus de mou ; `null` si le monstre n'a aucun sort. */
export function firingReach(spells: readonly SpellDef[]): SpellReach | null {
  const reaches = spells.map(reachOf);
  return reaches.reduce<SpellReach | null>((best, next) => (best === null ? next : wider(best, next)), null);
}

function clampDistance(distance: number, reach: SpellReach): number {
  return Math.min(Math.max(distance, reach.min), reach.max);
}

/** Distance réellement visée : la préférée, ramenée dans la portée du sort. */
export interface EnemyAim {
  distance: number;
  requiresLos: boolean;
}

/** Ramène la distance préférée dans la portée : négatif → min, trop loin → max. */
export function aimOf(plan: EnemyPlan, spells: readonly SpellDef[]): EnemyAim {
  const reach = firingReach(spells);
  if (reach === null) return { distance: plan.preferredDistance, requiresLos: false };
  return { distance: clampDistance(plan.preferredDistance, reach), requiresLos: reach.requiresLos };
}
