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

/** Tolérance de comparaison de deux centres : un point confondu n'est jamais un segment. */
const SAME_POINT_EPSILON = 1e-6;

function samePoint(a: PixelPoint, b: PixelPoint): boolean {
  return Math.abs(a.x - b.x) < SAME_POINT_EPSILON && Math.abs(a.y - b.y) < SAME_POINT_EPSILON;
}

/** Points consécutifs fusionnés quand ils se confondent : aucun segment de longueur nulle. */
function withoutDuplicates(points: readonly PixelPoint[]): PixelPoint[] {
  const kept: PixelPoint[] = [];
  points.forEach((point) => {
    const last = kept.at(-1);
    if (last === undefined || !samePoint(last, point)) kept.push(point);
  });
  return kept;
}

/** Cases restantes d'un trajet peint, à partir de la fin du segment en cours. */
function cellsAfter(current: WalkPlan, segment: number): PixelPoint[] {
  return current.points.slice(segment + 1);
}

/**
 * Reprise d'un trajet interrompu : le glissement **finit le segment en cours**,
 * parcourt les cases qui restaient du trajet peint, puis enchaîne sur le trajet
 * neuf. La première case du trajet neuf est déjà l'arrivée du précédent : elle
 * n'est jamais répétée.
 *
 * Ce choix garde toutes les jambes alignées sur une arête **validée par le
 * moteur** : seul le premier point est interpolé, et il appartient au segment
 * déjà en cours de peinture. Aucune diagonale ne coupe donc un coin, jamais.
 *
 * La première jambe est plus courte qu'une case mais garde sa durée pleine :
 * le sprite ralentit un instant plutôt que de rattraper son retard d'un saut.
 */
export function resumeWalk(current: WalkPlan, elapsedMs: number, next: WalkPlan): WalkPlan | null {
  const sample = pathAt(current, elapsedMs);
  const points = [sample.point, ...cellsAfter(current, sample.segment), ...next.points];
  return walkPlan(withoutDuplicates(points));
}

/**
 * Démarre un trajet : aucun segment du précédent n'est conservé. Un second
 * déplacement remplace donc le premier au lieu d'empiler deux tweens. C'est la
 * primitive brute ; une interruption passe par `resumeWalk`, qui raccorde le
 * nouveau trajet au pixel peint.
 */
export function startWalk(plan: WalkPlan, nowMs: number): WalkState {
  return { plan, startedAt: nowMs };
}

/** Position de l'acteur à `nowMs`, relative au départ du trajet. */
export function sampleWalk(state: WalkState, nowMs: number): WalkSample {
  return pathAt(state.plan, nowMs - state.startedAt);
}
