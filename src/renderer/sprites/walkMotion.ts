import type { PixelPoint } from "../gridProjection";

/**
 * Durée du glissement d'**une** case, en millisecondes.
 *
 * 150 ms : à 6-7 cases/seconde le trajet reste lisible sans être instantané
 * (en dessous de 100 ms l'œil ne voit qu'un saut, au-dessus de 250 ms le clic
 * « répond » avec un temps de retard). Une course de 6 PM dure ~0,9 s.
 */
export const WALK_MS_PER_CELL = 150;

/** Trajet peint : les centres pixels des cases, départ et arrivée inclus. */
export interface WalkPlan {
  points: readonly PixelPoint[];
  durationMs: number;
}

/** Position d'un acteur à un instant du trajet. */
export interface WalkSample {
  point: PixelPoint;
  /** Index du segment en cours : `0` = entre `points[0]` et `points[1]`. */
  segment: number;
  /** Progression locale dans le segment, dans `[0, 1]`. */
  t: number;
  /** Le trajet est fini : l'acteur est exactement sur la dernière case. */
  done: boolean;
}

/** Trajet en cours d'un acteur : la seule source de vérité de son glissement. */
export interface WalkState {
  plan: WalkPlan;
  startedAt: number;
}

/** Point par défaut : évite tout accès non défini, jamais peint. */
const ORIGIN: PixelPoint = { x: 0, y: 0 };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Progression bornée d'un trajet. Une durée nulle vaut « déjà arrivé » : aucune
 * division par zéro, un déplacement vide ne bloque jamais l'acteur.
 */
export function stepProgress(elapsedMs: number, durationMs: number): number {
  if (!(durationMs > 0)) return 1;
  return clamp01(elapsedMs / durationMs);
}

/** Position interpolée entre deux centres de case ; `t` supposé dans `[0, 1]`. */
export function interpolatedCell(from: PixelPoint, to: PixelPoint, t: number): PixelPoint {
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
}

/** Durée d'un trajet de `legs` segments : une case, une durée. */
export function walkDuration(legs: number): number {
  return Math.max(0, legs) * WALK_MS_PER_CELL;
}

/** Plan de marche ; `null` quand il n'y a rien à parcourir (moins de deux cases). */
export function walkPlan(points: readonly PixelPoint[]): WalkPlan | null {
  if (points.length < 2) return null;
  return { points, durationMs: walkDuration(points.length - 1) };
}

function segmentFor(legs: number, progress: number): number {
  return Math.min(legs - 1, Math.floor(progress * legs));
}

/**
 * Échantillon du trajet : le segment courant et le point interpolé dessus.
 * Chaque point reste donc **sur le chemin**, jamais sur la corde départ-arrivée.
 */
export function pathAt(plan: WalkPlan, elapsedMs: number): WalkSample {
  const legs = plan.points.length - 1;
  const progress = stepProgress(elapsedMs, plan.durationMs);
  const segment = segmentFor(legs, progress);
  const from = plan.points[segment] ?? ORIGIN;
  const to = plan.points[segment + 1] ?? from;
  const t = progress >= 1 ? 1 : progress * legs - segment;
  return { point: interpolatedCell(from, to, t), segment, t, done: progress >= 1 };
}

/**
 * Démarre un trajet : aucun segment du précédent n'est conservé. Un second
 * déplacement remplace donc le premier au lieu d'empiler deux tweens.
 */
export function startWalk(plan: WalkPlan, nowMs: number): WalkState {
  return { plan, startedAt: nowMs };
}

/** Position de l'acteur à `nowMs`, relative au départ du trajet. */
export function sampleWalk(state: WalkState, nowMs: number): WalkSample {
  return pathAt(state.plan, nowMs - state.startedAt);
}
