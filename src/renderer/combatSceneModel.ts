import type { Position } from "../engine/grid";
import type { CombatantKind, CombatState } from "../engine/combatLoop/types";
import { getCastableCells } from "../engine/combatLoop/castable";
import { getReachableCells } from "../engine/combatLoop/cells";
import type { GridSize, IsoOrigin } from "./gridProjection";
import { sceneOrigin } from "./gridProjection";
import type { GridHighlight, SceneModel, TileView } from "./scene";
import { buildSceneModel, cellKey } from "./scene";
import { knownSpriteId } from "./spriteManifest";
import type { Facing, SpriteAnimationName } from "./sprites/types";
import type { TokenSprite, TokenView } from "./tokens";
import { facingToward, tokenView } from "./tokens";

export interface CombatSceneInput {
  combat: CombatState;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  viewport: GridSize;
}

/** Dernière action lisible dans `combat.log`, utilisée pour les animations. */
export interface LastAction {
  kind: "cast" | "move";
  actor: CombatantKind;
  /** Clé de rejeu : le journal grandit à chaque action, même répétée. */
  signature: string;
}

export interface ViewModel {
  scene: SceneModel;
  tokens: TokenView[];
  path: TileView[];
  lastAction: LastAction | null;
}

const MOVE_MARKERS = [" se déplace"];
const CAST_MARKERS = [" lance ", " se téléporte"];

const ACTION_ANIMATION: Record<LastAction["kind"], Record<"self" | "other", SpriteAnimationName>> = {
  cast: { self: "attack", other: "hit" },
  move: { self: "walk", other: "idle" },
};

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

function actionKind(line: string): LastAction["kind"] | null {
  if (MOVE_MARKERS.some((marker) => line.includes(marker))) return "move";
  return CAST_MARKERS.some((marker) => line.includes(marker)) ? "cast" : null;
}

function actionActor(combat: CombatState, line: string): CombatantKind {
  return line.startsWith(combat.player.name) ? "player" : "enemy";
}

/**
 * Heuristique assumée sur `combat.log` : le moteur écrit des lignes françaises
 * (`… se déplace de N case(s).`, `… lance Sort : …`, `… se téléporte.`) toujours
 * préfixées du nom de l'acteur. On classe la dernière ligne par son verbe et on
 * attribue l'acteur par son préfixe — le store n'est jamais touché.
 */
export function lastActionFrom(combat: CombatState): LastAction | null {
  const line = combat.log[combat.log.length - 1];
  if (line === undefined) return null;
  const kind = actionKind(line);
  if (kind === null) return null;
  return { kind, actor: actionActor(combat, line), signature: `log-${combat.log.length}` };
}

interface TokenSpriteInput {
  role: CombatantKind;
  spriteId: string | null;
  action: LastAction | null;
  facing: Facing;
}

function animationFor(input: TokenSpriteInput): SpriteAnimationName {
  if (input.action === null) return "idle";
  const pair = ACTION_ANIMATION[input.action.kind];
  return pair[input.action.actor === input.role ? "self" : "other"];
}

function tokenSprite(input: TokenSpriteInput): TokenSprite {
  return {
    spriteId: input.spriteId,
    facing: input.facing,
    animation: animationFor(input),
    animationKey: input.action === null ? "static" : input.action.signature,
  };
}

/** Classe du héros déduite de ses sorts, validée contre le manifeste : aucune donnée métier dupliquée. */
function playerClassId(combat: CombatState): string | null {
  const spellId = combat.player.spellIds[0];
  const spell = spellId === undefined ? undefined : combat.spellsById[spellId];
  return spell === undefined ? null : knownSpriteId(spell.classId);
}

/**
 * Feuille de l'ennemi : l'id du monstre est un `entityId` du manifeste, mais
 * seulement s'il y résout. Un id inconnu devient `null` — donc un cercle — au
 * lieu d'un identifiant fantôme que personne ne dessine (combattant invisible).
 */
function enemySpriteId(combat: CombatState): string | null {
  return knownSpriteId(combat.enemy.id);
}

interface CombatTokenInput {
  combat: CombatState;
  origin: IsoOrigin;
  action: LastAction | null;
}

interface TokenTarget {
  role: CombatantKind;
  spriteId: string | null;
}

function tokenFor(input: CombatTokenInput, target: TokenTarget): TokenView {
  const { player, enemy } = input.combat;
  const combatant = target.role === "player" ? player : enemy;
  const opponent = target.role === "player" ? enemy : player;
  const facing = facingToward(combatant.position, opponent.position);
  return tokenView(combatant, input.origin, tokenSprite({ ...target, action: input.action, facing }));
}

function combatTokens(input: CombatTokenInput): TokenView[] {
  const player = tokenFor(input, { role: "player", spriteId: playerClassId(input.combat) });
  const enemy = tokenFor(input, { role: "enemy", spriteId: enemySpriteId(input.combat) });
  return [player, enemy];
}

/** Modèle de scène dérivé de l'état de combat, du sort sélectionné, du survol et du viewport. */
export function buildViewModel(input: CombatSceneInput): ViewModel {
  const { combat } = input;
  const action = lastActionFrom(combat);
  const origin = sceneOrigin(mapSize(combat), input.viewport);
  const scene = buildSceneModel({ map: combat.map, highlight: highlightFor(input), origin });
  return { scene, tokens: combatTokens({ combat, origin, action }), path: [], lastAction: action };
}
