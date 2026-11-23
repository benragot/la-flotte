import type { CombatState } from "../engine/combatLoop/types";
import type { Position } from "../engine/grid";
import type { BattleState } from "../engine/multiCombat";
import type { ViewModel } from "./combatSceneModel";
import { buildViewModel } from "./combatSceneModel";
import { buildBattleViewModel } from "./battleSceneModel";
import type { ExplorationView } from "./explorationScene";
import { buildExplorationViewModel } from "./explorationScene";
import type { GridSize } from "./gridProjection";
import type { TrailBatch } from "../store/trails";

export type ArenaMode = "combat" | "exploration";

/** Tout ce qu'une image de l'arène peut lire : aucune fonction de ce fichier n'écrit. */
export interface ArenaSceneInput {
  combat: CombatState | null;
  battle: BattleState | null;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  viewport: GridSize;
  mode: ArenaMode;
  exploration?: ExplorationView;
  heroSpriteId?: string | null;
  /** Trajets reçus du store, à attacher aux jetons de la vue retenue. */
  trails?: TrailBatch;
  /** `Maj` maintenu : état d'entrée de la frontière, la peinture ne lit pas `window`. */
  modifierHeld?: boolean;
}

function battleModel(input: ArenaSceneInput): ViewModel | null {
  if (input.battle === null) return null;
  const view = { battle: input.battle, viewport: input.viewport, heroSpriteId: input.heroSpriteId, trails: input.trails };
  return buildBattleViewModel(view);
}

/** Le 1v1 ne se dessine qu'en mode combat : en exploration, la carte est celle du héros. */
function combatModel(input: ArenaSceneInput): ViewModel | null {
  if (input.combat === null || input.mode === "exploration") return null;
  const { combat, selectedSpellId, hoveredCell, viewport, trails, modifierHeld } = input;
  return buildViewModel({ combat, selectedSpellId, hoveredCell, viewport, trails, modifierHeld });
}

function explorationModel(input: ArenaSceneInput): ViewModel | null {
  if (input.exploration === undefined) return null;
  const view = { exploration: input.exploration, viewport: input.viewport, trails: input.trails };
  return buildExplorationViewModel(view);
}

/**
 * Une **salle ouverte prime** sur tout le reste : c'est le portillon qui
 * manquait, `mode` restant `"exploration"` quand `battle` arrivait par la fiche
 * Donjons. Le canvas dessinait donc le héros d'exploration et un groupe, jamais
 * les combattants de la salle.
 */
export function arenaSceneView(input: ArenaSceneInput): ViewModel | null {
  return battleModel(input) ?? combatModel(input) ?? explorationModel(input);
}

/**
 * Carte effectivement dessinée : son identité sert à invalider les trajets en
 * cours. Les états du store remplacent leurs combattants mais gardent la même
 * `AsciiMap`, donc changer de carte change forcément cette référence.
 */
export function arenaSceneMap(input: ArenaSceneInput): object | null {
  return battleMap(input) ?? combatMap(input) ?? explorationMap(input);
}

function battleMap(input: ArenaSceneInput): object | null | undefined {
  return input.battle === null ? undefined : (input.battle.map ?? null);
}

function combatMap(input: ArenaSceneInput): object | undefined {
  if (input.combat === null) return undefined;
  return input.mode === "exploration" ? undefined : input.combat.map;
}

function explorationMap(input: ArenaSceneInput): object | null {
  return input.exploration?.map ?? null;
}
