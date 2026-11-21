import { Graphics } from "pixi.js";
import type { Application } from "pixi.js";
import type { Position } from "../engine/grid";
import type { CombatState } from "../engine/combatLoop/types";
import { getCastableCells } from "../engine/combatLoop/castable";
import { getReachableCells } from "../engine/combatLoop/cells";
import { cellKey } from "./scene";
import type { GridHighlight, SceneModel } from "./scene";
import { buildSceneModel, drawGrid, drawHighlights } from "./scene";
import { drawTokens, tokenView } from "./tokens";
import type { TokenView } from "./tokens";

export interface CombatSceneInput {
  combat: CombatState;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
}

export interface ViewModel {
  scene: SceneModel;
  tokens: TokenView[];
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

/** Modèle de scène dérivé de l'état de combat et du survol. */
export function buildViewModel(input: CombatSceneInput): ViewModel {
  return {
    scene: buildSceneModel({ map: input.combat.map, highlight: highlightFor(input) }),
    tokens: [tokenView(input.combat.player), tokenView(input.combat.enemy)],
  };
}

interface SceneLayers {
  grid: Graphics;
  highlights: Graphics;
  tokens: Graphics;
}

const LAYERS = new WeakMap<Application, SceneLayers>();

function createLayers(): SceneLayers {
  return { grid: new Graphics(), highlights: new Graphics(), tokens: new Graphics() };
}

function layersFor(app: Application): SceneLayers {
  const existing = LAYERS.get(app);
  if (existing !== undefined) return existing;
  const created = createLayers();
  app.stage.addChild(created.grid, created.highlights, created.tokens);
  LAYERS.set(app, created);
  return created;
}

function clearLayers(layers: SceneLayers): void {
  layers.grid.clear();
  layers.highlights.clear();
  layers.tokens.clear();
}

/** Redessine entièrement la scène pour l'application PixiJS donnée. */
export function renderScene(app: Application, view: ViewModel): void {
  const layers = layersFor(app);
  clearLayers(layers);
  drawLayers(layers, view);
  app.render();
}

function drawLayers(layers: SceneLayers, view: ViewModel): void {
  drawGrid(layers.grid, view.scene.tiles);
  drawHighlights(layers.highlights, view.scene.highlights);
  drawTokens(layers.tokens, view.tokens);
}
