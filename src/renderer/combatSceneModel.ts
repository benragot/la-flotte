import type { Position } from "../engine/grid";
import type { CombatState } from "../engine/combatLoop/types";
import { getCastableCells } from "../engine/combatLoop/castable";
import { getReachableCells } from "../engine/combatLoop/cells";
import type { GridSize } from "./gridProjection";
import { sceneOrigin } from "./gridProjection";
import type { GridHighlight, SceneModel, TileView } from "./scene";
import { buildSceneModel, cellKey } from "./scene";
import type { TokenView } from "./tokens";
import { tokenView } from "./tokens";

export interface CombatSceneInput {
  combat: CombatState;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  viewport: GridSize;
}

export interface ViewModel {
  scene: SceneModel;
  tokens: TokenView[];
  path: TileView[];
}

export function toCellKeys(positions: readonly Position[]): Set<string> {
  return new Set(positions.map(cellKey));
}

function moveCells(combat: CombatState): Position[] {
  if (combat.phase !== "player_turn") return [];
  return getReachableCells(combat);
}

function castCells(combat: CombatState, spellId: string | null): Position[] {
  if (spellId === null) return [];
  return getCastableCells(combat, spellId);
}

function hoverKey(position: Position | null): string | null {
  return position === null ? null : cellKey(position);
}

function highlightFor(input: CombatSceneInput): GridHighlight {
  return {
    move: toCellKeys(moveCells(input.combat)),
    cast: toCellKeys(castCells(input.combat, input.selectedSpellId)),
    hover: hoverKey(input.hoveredCell),
  };
}

function mapSize(combat: CombatState): GridSize {
  return { width: combat.map.width, height: combat.map.height };
}

/** Modèle de scène dérivé de l'état de combat, du sort sélectionné, du survol et du viewport. */
export function buildViewModel(input: CombatSceneInput): ViewModel {
  const origin = sceneOrigin(mapSize(input.combat), input.viewport);
  const scene = buildSceneModel({ map: input.combat.map, highlight: highlightFor(input), origin });
  const tokens = [tokenView(input.combat.player, origin), tokenView(input.combat.enemy, origin)];
  return { scene, tokens, path: [] };
}
