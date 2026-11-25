import type { Position } from "../engine/grid";
import type { FloatingEvent } from "../engine/combat";
import type { Element } from "../schemas/spellSchema";
import type { CombatantKind, CombatState } from "../engine/combatLoop/types";
import { getActiveCombatant, getOpponent } from "../engine/combatLoop/active";
import { getCastableCells } from "../engine/combatLoop/castable";
import type { AsciiMap } from "../engine/grid";
import type { GridSize, IsoOrigin } from "./gridProjection";
import { sceneOrigin } from "./gridProjection";
import type { GridHighlight, PathHint, SceneModel, TileView } from "./scene";
import { buildSceneModel, cellKey, pathTileViews } from "./scene";
import { moveZoneCells } from "./moveZone";
import type { HoverPath } from "./pathPreview";
import { hoverPathPreview } from "./pathPreview";
import { PATH_STYLE } from "./tileStyle";
import { knownSpriteId } from "./spriteManifest";
import type { Facing, SpriteAnimationName } from "./sprites/types";
import type { TrailBatch } from "../store/trails";
import { attachTrails } from "./walkTrail";
import type { TokenSprite, TokenView } from "./tokens";
import { facingToward, tokenView } from "./tokens";

export interface CombatSceneInput {
  combat: CombatState;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  viewport: GridSize;
  /** Trajets reçus du store : distincts de l'aperçu `path`. */
  trails?: TrailBatch;
  /** `Maj` maintenu, lu à la frontière (`useModifierHeld`) : R1, jamais `window` ici. */
  modifierHeld?: boolean;
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
  /**
   * Jetons qui portent une barre de vie : **seul** le combat en déclare. La
   * couche de rendu ne lit que ce champ, jamais `tokens` : une scène sans
   * combat ne peut donc pas faire réapparaître une barre par accident.
   */
  hpBarTokens: readonly TokenView[];
  path: TileView[];
  /** Pastille de coût PM du survol ; `null` hors survol jouable (aucun chemin promis). */
  pathHint?: PathHint | null;
  /** Nombres flottants produits par le moteur : le rendu ne les recalcule jamais. */
  floats?: readonly FloatingEvent[];
  /** Identité de la carte dessinée : une carte neuve annule les animations en vol. */
  sceneKey?: object | null;
}

/**
 * Vue du **1v1** : elle seule publie l'action dérivée de `combat.log`. Le champ
 * n'est pas dans `ViewModel` — une salle ou une exploration n'ont pas le même
 * journal, et aucun consommateur ne lit `lastAction` sur la vue partagée.
 */
export interface CombatSceneView extends ViewModel {
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

function moveCells(input: CombatSceneInput): Position[] {
  const { combat, hoveredCell, modifierHeld } = input;
  return moveZoneCells({ combat, hoveredCell, modifierHeld: modifierHeld === true });
}

function castCells(combat: CombatState, spellId: string | null): Position[] {
  if (spellId === null) return [];
  return getCastableCells(combat, spellId);
}

function hoverKey(position: Position | null): string | null {
  return position === null ? null : cellKey(position);
}

/** Élément retenu pour peindre la portée : une donnée du sort, lue telle quelle. */
function selectedElement(combat: CombatState, spellId: string | null): Element | null {
  if (spellId === null) return null;
  return combat.spellsById[spellId]?.element ?? null;
}

function highlightFor(input: CombatSceneInput): GridHighlight {
  return {
    move: toCellKeys(moveCells(input)),
    cast: toCellKeys(castCells(input.combat, input.selectedSpellId)),
    hover: hoverKey(input.hoveredCell),
    castElement: selectedElement(input.combat, input.selectedSpellId),
  };
}

function mapSize(combat: CombatState): GridSize {
  return { width: combat.map.width, height: combat.map.height };
}

/** Couche de chemin d'un survol : les cases peintes et la pastille de coût. */
interface PathLayer {
  path: TileView[];
  pathHint: PathHint | null;
}

interface HoverPreview {
  preview: HoverPath;
  /** Case visée, non nulle : c'est elle que la pastille et la croix désignent. */
  to: Position;
}

const NO_PATH_LAYER: PathLayer = { path: [], pathHint: null };

/**
 * Aperçu du survol : mêmes entrées que `moveActiveEntity` (mover actif, PM
 * courants, adversaire occupant sa case). Aucune règle de grille n'est recopiée ;
 * hors tour du joueur, rien n'est promis — c'est l'ennemi qui jouerait.
 */
function hoverPreview(input: CombatSceneInput): HoverPreview | null {
  const to = input.hoveredCell;
  if (to === null || input.combat.phase !== "player_turn") return null;
  const mover = getActiveCombatant(input.combat);
  const opponent = getOpponent(input.combat);
  const options = { map: input.combat.map, from: mover.position, to, maxPm: mover.mp, occupied: [opponent.position] };
  return { preview: hoverPathPreview(options), to };
}

function pathTiles(map: AsciiMap, origin: IsoOrigin, cells: readonly Position[]): TileView[] {
  return pathTileViews({ map, origin, path: cells, style: PATH_STYLE });
}

/** Une case de départ seule n'est pas un chemin : rien à peindre sous le héros. */
function paintedCells(preview: HoverPath): Position[] {
  return preview.path.length > 1 ? preview.path : [];
}

/** Pastille posée sur la case visée ; coût nul (sur place) ⇒ rien à annoncer. */
function hintFor(hover: HoverPreview, map: AsciiMap, origin: IsoOrigin): PathHint | null {
  const { preview, to } = hover;
  if (preview.cost === 0) return null;
  const [target] = pathTiles(map, origin, [to]);
  return target === undefined ? null : { cost: preview.cost, payable: preview.payable, target };
}

function pathLayer(input: CombatSceneInput, origin: IsoOrigin): PathLayer {
  const hover = hoverPreview(input);
  if (hover === null) return NO_PATH_LAYER;
  const map = input.combat.map;
  return { path: pathTiles(map, origin, paintedCells(hover.preview)), pathHint: hintFor(hover, map, origin) };
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
export function buildViewModel(input: CombatSceneInput): CombatSceneView {
  const { combat } = input;
  const action = lastActionFrom(combat);
  const origin = sceneOrigin(mapSize(combat), input.viewport);
  const scene = buildSceneModel({ map: combat.map, highlight: highlightFor(input), origin });
  const tokens = attachTrails(combatTokens({ combat, origin, action }), input.trails);
  const path = pathLayer(input, origin);
  const animations = { floats: combat.floats ?? [], sceneKey: combat.map };
  return { ...animations, scene, tokens, hpBarTokens: tokens, lastAction: action, ...path };
}
