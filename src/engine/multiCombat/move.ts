import type { Position } from "../grid";
import { findPath, mapPathBudget, stepCost } from "../grid";
import { appendLog, findCombatant, isAlive, withCombatant } from "./combatants";
import { tackleCheck } from "./tackle";
import { activeCombatant } from "./timeline";
import type { BattleState, CombatantLike, Rng } from "./types";

/** Pas de marche en cours : état courant, marcheur, et PM réellement payés. */
interface Walk {
  state: BattleState;
  moverId: string;
  /** Facture cumulée du chemin parcouru, en PM. */
  spent: number;
}

interface WalkInput {
  walk: Walk;
  path: readonly Position[];
  rng: Rng;
}

interface StepInput {
  walk: Walk;
  from: Position;
  next: Position;
  rng: Rng;
}

export interface HeroMoveInput {
  state: BattleState;
  to: Position;
  rng: Rng;
}

/** Vivants autres que le marcheur : ils bloquent passage, arrivée et coins. */
function livingOthers(state: BattleState, moverId: string): CombatantLike[] {
  return state.combatants.filter((entry) => entry.id !== moverId && entry.hp > 0);
}

/** Le héros actif et vivant : condition nécessaire au pas. */
function walkingHero(state: BattleState): CombatantLike | null {
  const active = activeCombatant(state);
  if (active === null || !isAlive(active) || active.side !== "player") return null;
  return active;
}

/** Le héros **actif et vivant** sur une carte, seul cas où le pas est permis. */
function moverOf(state: BattleState): CombatantLike | null {
  if (state.map === undefined) return null;
  return walkingHero(state);
}

/** Chemin réel vers `to` : le budget PM est appliqué pas par pas, pas ici. */
function heroPath(state: BattleState, mover: CombatantLike, to: Position): Position[] | null {
  const map = state.map;
  if (map === undefined) return null;
  const occupied = livingOthers(state, mover.id).map((entry) => entry.position);
  return findPath({ map, from: mover.position, to, maxPm: mapPathBudget(map), occupied });
}

/** Pas payé : ce que ça coûte et où ça mène. */
interface Payment {
  next: Position;
  cost: number;
}

/** Pas payé : position et PM mis à jour, facture cumulée (DEC-10). */
function paidStep(walk: Walk, mover: CombatantLike, payment: Payment): Walk {
  const moved = { ...mover, position: payment.next, mp: mover.mp - payment.cost };
  const state = withCombatant(walk.state, moved);
  return { state, moverId: walk.moverId, spent: walk.spent + payment.cost };
}

/** Tacle raté : 1 PM, arrêt sur place, et le pas n'est **jamais** facturé. */
function tackledStep(walk: Walk, mover: CombatantLike, mpLoss: number): Walk {
  const docked = { ...mover, mp: Math.max(0, mover.mp - mpLoss) };
  return { ...walk, state: withCombatant(walk.state, docked) };
}

/**
 * Un pas atomique : le tacle est jugé **avant** le paiement, et un pas sans
 * budget n'est jamais commencé (`mp` ne descend donc jamais sous 0).
 */
function attemptStep(input: StepInput): Walk | null {
  const mover = findCombatant(input.walk.state, input.walk.moverId);
  if (mover === undefined) return null;
  const cost = stepCost(input.from, input.next);
  if (mover.mp < cost) return null;
  const tackle = tackleCheck({ state: input.walk.state, moverId: input.walk.moverId, rng: input.rng });
  if (!tackle.escaped) return tackledStep(input.walk, mover, tackle.mpLoss);
  return paidStep(input.walk, mover, { next: input.next, cost });
}

/** Marche récursive : l'adjacence est réévaluée à **chaque** case de départ. */
function walkStep(input: WalkInput, index: number): Walk {
  const from = input.path[index - 1];
  const next = input.path[index];
  if (from === undefined || next === undefined) return input.walk;
  const stepped = attemptStep({ walk: input.walk, from, next, rng: input.rng });
  if (stepped === null) return input.walk;
  return walkStep({ ...input, walk: stepped }, index + 1);
}

/** Une seule ligne de journal, et seulement si le héros a réellement payé. */
function movementLine(mover: CombatantLike, spent: number): string {
  return `${mover.name} se déplace de ${spent} case(s).`;
}

/** Rien payé ni bougé ⇒ état rendu par identité ; sinon la facture au journal. */
function settled(state: BattleState, walk: Walk): BattleState {
  if (walk.state === state || walk.spent <= 0) return walk.state;
  const mover = findCombatant(walk.state, walk.moverId);
  return mover === undefined ? walk.state : appendLog(walk.state, movementLine(mover, walk.spent));
}

/**
 * Déplacement du héros en 1vN (5C-hero-move). Autant de pas que les PM le
 * permettent, **sans** toucher aux PA, aux quotas de sort ni à la timeline.
 *
 * Ordre exact : garde actif+vivant+carte → `findPath` (bloqueurs vivants,
 * murs, eau, coins) → un pas par case du chemin, chacun jugé par
 * `tackleCheck` puis payé selon DEC-10 (1 PM orthogonal, 2 PM diagonal).
 * Un clic plus loin que le budget s'arrête sur la dernière case payable, sans
 * message de refus ; `findPath` nul ⇒ identité.
 */
export function moveHero(input: HeroMoveInput): BattleState {
  const mover = moverOf(input.state);
  if (mover === null) return input.state;
  const path = heroPath(input.state, mover, input.to);
  if (path === null || path.length < 2) return input.state;
  const walk = walkStep({ walk: { state: input.state, moverId: mover.id, spent: 0 }, path, rng: input.rng }, 1);
  return settled(input.state, walk);
}
