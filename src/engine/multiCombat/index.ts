export type {
  AttackSpec,
  BattleState,
  CombatantLike,
  CombatStats,
  EnemyAction,
  EnemyStrategy,
  RangeSpec,
  Rng,
  Side,
} from "./types";
export {
  appendLog,
  findCombatant,
  isActive,
  isAlive,
  isAliveById,
  livingOf,
  oppositeOf,
  withCombatant,
} from "./combatants";
export { activeCombatant, buildTimeline } from "./timeline";
export type { Timeline } from "./timeline";
export { isDefeat, isVictory, targetsOf } from "./outcome";
export { advanceTurn } from "./turn";
export { resolveAttack } from "./attack";
export type { AttackInput } from "./attack";
export { castBlock, rangeOf } from "./range";
export type { CastBlock, RangeCheck } from "./range";
export { isCritical } from "./crit";
export type { CriticalInput } from "./crit";
export { resolveTackle } from "./tackle";
export type { TackleInput, TackleResult } from "./tackle";
export { enemiesAct } from "./enemies";
export type { EnemiesActInput } from "./enemies";
export { nearestFreeCell, separateOccupants } from "./overlap";
export type { FreeCellInput } from "./overlap";
export { approachCell } from "./approach";
export type { ApproachInput } from "./approach";
