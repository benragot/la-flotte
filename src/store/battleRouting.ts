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
}

function isLivingEnemyOn(entry: CombatantLike, cell: Position): boolean {
  return entry.side === "enemy" && entry.hp > 0 && samePosition(entry.position, cell);
}

function livingEnemyAt(battle: BattleState, cell: Position): CombatantLike | null {
  return battle.combatants.find((entry) => isLivingEnemyOn(entry, cell)) ?? null;
}

/**
 * Routage DEC-12 étape 3 : le clic d'un combat d'exploration unifié se lit sur
 * le `BattleState`, jamais sur une phase 1v1. Case vide ⇒ déplacement ; ennemi
 * vivant ⇒ sort armé, sinon attaque de base. Aucune règle de combat ici : le
 * moteur (`moveHero`, `castHeroSpell`, `resolveAttack`) décide ensuite.
 */
export function battleClickRoute(input: BattleClickInput): BattleRoute {
  const enemy = livingEnemyAt(input.battle, input.target);
  if (enemy === null) return { kind: "move" };
  if (input.spellSelected) return { kind: "spell", targetId: enemy.id };
  return { kind: "attack", targetId: enemy.id };
}
