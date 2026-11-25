import { samePosition } from "../engine/grid";
import type { Position } from "../engine/grid";
import type { BattleState, CombatantLike } from "../engine/multiCombat";

/** Cible d'un clic dans un combat d'exploration unifié. */
export type BattleRoute =
  | { kind: "spell"; targetId: string }
  | { kind: "attack"; targetId: string }
  | { kind: "move" };

export interface BattleClickInput {
  battle: BattleState;
  target: Position;
  /** Un sort est armé : le clic vise une cible, jamais le sol. */
  spellSelected: boolean;
  /**
   * Le sort armé se lance sur soi (soin) : le clic sur le héros devient un
   * sort, sinon il resterait un déplacement et le soin serait incliquable.
   */
  selfSpell?: boolean;
}

function isLivingOn(entry: CombatantLike, cell: Position): boolean {
  return entry.hp > 0 && samePosition(entry.position, cell);
}

function livingEnemyAt(battle: BattleState, cell: Position): CombatantLike | null {
  return battle.combatants.find((entry) => entry.side === "enemy" && isLivingOn(entry, cell)) ?? null;
}

function livingHeroAt(battle: BattleState, cell: Position): CombatantLike | null {
  return battle.combatants.find((entry) => entry.side === "player" && isLivingOn(entry, cell)) ?? null;
}

function enemyRoute(input: BattleClickInput, enemy: CombatantLike): BattleRoute {
  return { kind: input.spellSelected ? "spell" : "attack", targetId: enemy.id };
}

function selfRoute(input: BattleClickInput): BattleRoute | null {
  if (!input.spellSelected || input.selfSpell !== true) return null;
  const hero = livingHeroAt(input.battle, input.target);
  return hero === null ? null : { kind: "spell", targetId: hero.id };
}

/**
 * Routage DEC-12 étape 3 : le clic d'un combat d'exploration unifié se lit sur
 * le `BattleState`, jamais sur une phase 1v1. Case vide ⇒ déplacement ; ennemi
 * vivant ⇒ sort armé, sinon attaque de base ; héros avec un soin armé ⇒ soin.
 * Aucune règle de combat ici : les moteurs (`moveHero`, `castHeroSpell`,
 * `resolveAttack`, `resolveHeal`) décident ensuite.
 */
export function battleClickRoute(input: BattleClickInput): BattleRoute {
  const enemy = livingEnemyAt(input.battle, input.target);
  if (enemy !== null) return enemyRoute(input, enemy);
  return selfRoute(input) ?? { kind: "move" };
}
