import type { Position } from "../engine/grid";
import type { BattleState, CombatantLike } from "../engine/multiCombat";
import { activeCombatant } from "../engine/multiCombat";
import type { GridSize, IsoOrigin } from "./gridProjection";
import { sceneOrigin } from "./gridProjection";
import type { GridHighlight, SceneModel, TileView } from "./scene";
import { buildSceneModel } from "./scene";
import { knownSpriteId, resolveSpriteId } from "./spriteManifest";
import type { SpriteAnimationName } from "./sprites/types";
import type { TrailBatch } from "../store/trails";
import { attachTrails } from "./walkTrail";
import type { TokenSprite, TokenView } from "./tokens";
import { combatantTokenView } from "./tokens";

export interface BattleSceneInput {
  battle: BattleState;
  viewport: GridSize;
  /** `entityId` de la feuille du héros ; absent, le héros retombe sur un cercle. */
  heroSpriteId?: string | null;
  /** Trajets reçus du store : un par combattant qui a bougé. */
  trails?: TrailBatch;
}

/**
 * Modèle de scène d'une **salle** : un jeton par combattant de `battle`, dans
 * l'ordre du panneau, plus l'id du combattant actif. Le panneau et la carte
 * lisent donc la même timeline, et l'anneau doré ne peut plus contredire
 * l'en-tête « Actif : ».
 */
export interface BattleSceneView {
  scene: SceneModel;
  tokens: TokenView[];
  path: TileView[];
  lastAction: null;
  /** Combattant dont c'est le tour, tel que `activeCombatant` le désigne. */
  activeId: string | null;
}

const NO_HIGHLIGHT: GridHighlight = { move: new Set(), cast: new Set(), hover: null };
const IDLE: SpriteAnimationName = "idle";
const ORIGIN: Position = { x: 0, y: 0 };

function maxCoord(positions: readonly Position[]): Position {
  const grow = (acc: Position, pos: Position) => ({ x: Math.max(acc.x, pos.x), y: Math.max(acc.y, pos.y) });
  return positions.reduce(grow, ORIGIN);
}

/** Grille de la salle ; sans carte, elle couvre les positions occupées. */
export function battleGridSize(battle: BattleState): GridSize {
  if (battle.map !== undefined) return { width: battle.map.width, height: battle.map.height };
  const max = maxCoord(battle.combatants.map((entry) => entry.position));
  return { width: max.x + 1, height: max.y + 1 };
}

function heroSprite(heroSpriteId: string | null | undefined): TokenSprite {
  return { spriteId: knownSpriteId(heroSpriteId), facing: "right", animation: IDLE, animationKey: "battle-hero" };
}

/** Un ennemi porte `${monsterId}-${index}` : sa feuille se résout par préfixe. */
function enemySprite(id: string): TokenSprite {
  return { spriteId: resolveSpriteId(id), facing: "left", animation: IDLE, animationKey: `battle-${id}` };
}

interface TokenContext {
  battle: BattleState;
  origin: IsoOrigin;
  heroSpriteId: string | null | undefined;
}

function activeIdOf(battle: BattleState): string | null {
  return activeCombatant(battle)?.id ?? null;
}

function spriteFor(context: TokenContext, combatant: CombatantLike): TokenSprite {
  return combatant.side === "player" ? heroSprite(context.heroSpriteId) : enemySprite(combatant.id);
}

function tokenFor(context: TokenContext, combatant: CombatantLike): TokenView {
  const sprite = spriteFor(context, combatant);
  const active = combatant.id === activeIdOf(context.battle);
  return combatantTokenView({ combatant, sprite, active }, context.origin);
}

function battleScene(battle: BattleState, origin: IsoOrigin): SceneModel {
  if (battle.map === undefined) return { tiles: [], highlights: [], decor: [], outlines: [], exitMarks: [] };
  return buildSceneModel({ map: battle.map, highlight: NO_HIGHLIGHT, origin });
}

/** Modèle de scène d'une salle de donjon : tous les combattants, aucun ne manque. */
export function buildBattleViewModel(input: BattleSceneInput): BattleSceneView {
  const origin = sceneOrigin(battleGridSize(input.battle), input.viewport);
  const context = { battle: input.battle, origin, heroSpriteId: input.heroSpriteId };
  const tokens = attachTrails(input.battle.combatants.map((entry) => tokenFor(context, entry)), input.trails);
  const scene = battleScene(input.battle, origin);
  const activeId = activeIdOf(input.battle);
  return { scene, tokens, path: [], lastAction: null, activeId };
}
