import type { Position } from "../engine/grid";
import { samePosition } from "../engine/grid";
import { getReachableCells } from "../engine/combatLoop/cells";
import type { CombatState } from "../engine/combatLoop/types";

/** Entrées des règles R1 et R8 : phase, survol et `Maj`, tous fournis par la frontière. */
export interface MoveZoneInput {
  combat: CombatState;
  hoveredCell: Position | null;
  modifierHeld: boolean;
}

/**
 * Portée moteur d'un camp. `getReachableCells` ne vise que l'entité **active**
 * (`getActiveCombatant`) : on lui présente la phase de l'acteur dont on veut la
 * portée. Aucun coût n'est recalculé ici — DEC-10 (1 PM ortho, 2 PM diag) reste
 * dans `src/engine`.
 */
function reachableFor(combat: CombatState, side: "player" | "enemy"): Position[] {
  if (side === "player") return getReachableCells(combat);
  return getReachableCells({ ...combat, phase: "enemy_turn" });
}

function isHovered(input: MoveZoneInput, position: Position): boolean {
  return input.hoveredCell !== null && samePosition(input.hoveredCell, position);
}

/** R1 : la zone du héros n'apparaît qu'à son tour, sur sa case ou `Maj` maintenu. */
function heroVisible(input: MoveZoneInput): boolean {
  if (input.combat.phase !== "player_turn") return false;
  if (input.modifierHeld) return true;
  return isHovered(input, input.combat.player.position);
}

/**
 * Cases de déplacement **visibles** (`ui-dofus-retro.md` §6). Jamais en aplat
 * permanent : R8 (ennemi) cède la priorité à R1 quand `Maj` est maintenu, parce
 * que la touche est une intention explicite et que deux zones superposées
 * seraient illisibles.
 */
export function moveZoneCells(input: MoveZoneInput): Position[] {
  if (heroVisible(input)) return reachableFor(input.combat, "player");
  if (isHovered(input, input.combat.enemy.position)) return reachableFor(input.combat, "enemy");
  return [];
}
