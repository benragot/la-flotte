export type {
  AttackSpec,
  BattleState,
  CombatantLike,
  CombatStats,
  DamageRange,
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
export { canCastSpellNow, isAttackAvailable, recordAttack } from "./spellUse";
export type { CastableSpell } from "./spellUse";
export { rollsCritical } from "./crit";
export type { CriticalInput } from "./crit";
export { adjacentEnemies, TACKLE_MP_LOSS, tackleCheck } from "./tackle";
export type { TackleCheckInput, TackleCheckResult } from "./tackle";
export { moveHero } from "./move";
export type { HeroMoveInput } from "./move";
export { enemiesAct } from "./enemies";
export type { EnemiesActInput } from "./enemies";
export { nearestFreeCell, separateOccupants } from "./overlap";
export type { FreeCellInput } from "./overlap";
export { approachCell } from "./approach";
export type { ApproachInput } from "./approach";
