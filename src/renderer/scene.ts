import type { CellType, DecorSpec } from "../schemas/mapSchema";
import type { Element } from "../schemas/spellSchema";
import type { AsciiMap, Position } from "../engine/grid";
import { getCell, isWalkableCell } from "../engine/grid";
import { allPositions } from "../engine/combatLoop/cells";
import type { DecorView } from "./decor";
import type { ExitMark } from "./exitMarks";
import { exitMarkViews } from "./exitMarks";
import type { Diamond, IsoOrigin, PixelPoint } from "./gridProjection";
import { gridDiamond, originScale } from "./gridProjection";
import { depthOf } from "./depthOrder";
import { mapDecorSpecs, mapExitSpecs } from "./mapDefinition";
import type { Shape } from "./shapes";
import type { NeighbourLand } from "./tileTexture";
import { groundShapes, waterEdges } from "./tileTexture";
import type { TileMaterial } from "./tileMaterials";
import { materialAt } from "./tileMaterials";
import type { TileStyle } from "./tileStyle";
import { resolveTileStyle, WALL_HEIGHT } from "./tileStyle";

export interface TileView {
  cell: CellType;
  /** Coordonnée de grille : le grain du sol dépend de la case, jamais du hasard. */
  position: Position;
  center: PixelPoint;
  points: number[];
  /** Échelle de la caméra, pour que le relief des murs suive le décor. */
  scale: number;
  style: TileStyle;
  material: TileMaterial;
  /** Motif procédural du sol (points de sable, planches, écume…). */
  texture: Shape[];
}

export interface GridHighlight {
  move: ReadonlySet<string>;
  cast: ReadonlySet<string>;
  hover: string | null;
  /** Élément du sort sélectionné : le rendu en déduit une teinte, jamais une règle. */
  castElement?: Element | null;
}

export interface SceneInput {
  map: AsciiMap;
  highlight: GridHighlight;
  origin: IsoOrigin;
}

/**
 * Contour fin d'une case praticable. Il découpe la carte en losanges cliquables
 * et reste **sous** les jetons : c'est la grille de Dofus, pas un décor.
 */
export interface GridOutline {
  cell: Position;
  points: number[];
  scale: number;
}

export interface SceneModel {
  tiles: TileView[];
  highlights: TileView[];
  /** Objets de décor de `data/maps.yaml`, en ordre peintre. */
  decor: DecorView[];
  /** Un contour par case praticable : aucun mur, aucune case hors carte. */
  outlines: GridOutline[];
  /** Un « soleil » par sortie déclarée dans `data/maps.yaml` ; vide sans sortie. */
  exitMarks: ExitMark[];
}

interface TileFlags {
  isMoveCell: boolean;
  isCastCell: boolean;
  /** Élément du sort en cours : il ne change que la teinte de la portée. */
  castElement?: Element | null;
  /** Style imposé par la couche appelante (chemin) : il court-circuite la résolution §3.2. */
  style?: TileStyle;
}

interface TileContext {
  map: AsciiMap;
  origin: IsoOrigin;
  hover: string | null;
  move: ReadonlySet<string>;
  cast: ReadonlySet<string>;
  castElement: Element | null | undefined;
  pontoon: ReadonlySet<string>;
}

interface NeighbourDelta {
  dx: number;
  dy: number;
}

const NEIGHBOURS: readonly NeighbourDelta[] = [
  { dx: 0, dy: -1 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
];

/** Clé stable d'une case, utilisée pour les ensembles de surbrillance. */
export function cellKey(position: Position): string {
  return `${position.x}:${position.y}`;
}

/** Profondeur isométrique d'une case : un seul axe pour tuiles, acteurs et décor. */
export { depthOf };

function positionOrder(a: Position, b: Position): number {
  const delta = depthOf(a) - depthOf(b);
  return delta === 0 ? a.y - b.y : delta;
}

/** Ordre peintre : cases du haut de l'écran d'abord (`x + y` croissant). */
export function painterOrder(positions: readonly Position[]): Position[] {
  return [...positions].sort(positionOrder);
}

function neighbourCell(map: AsciiMap, position: Position, delta: NeighbourDelta): CellType | undefined {
  return getCell(map, { x: position.x + delta.dx, y: position.y + delta.dy });
}

function isLand(cell: CellType | undefined): boolean {
  return cell !== undefined && cell !== "~";
}

function landSide(map: AsciiMap, position: Position, delta: NeighbourDelta): boolean {
  return isLand(neighbourCell(map, position, delta));
}

function landSides(map: AsciiMap, position: Position): NeighbourLand {
  const [north, east, south, west] = NEIGHBOURS.map((delta) => landSide(map, position, delta));
  return { north: north === true, east: east === true, south: south === true, west: west === true };
}

function touchesWater(map: AsciiMap, position: Position): boolean {
  return NEIGHBOURS.some((delta) => neighbourCell(map, position, delta) === "~");
}

function tileMaterial(context: TileContext, position: Position): TileMaterial {
  const cell = getCell(context.map, position) ?? ".";
  return materialAt(cell, touchesWater(context.map, position), context.pontoon.has(cellKey(position)));
}

/** Le motif des murs se pose sur le dessus du relief, pas au sol. */
function textureCenter(material: TileMaterial, diamond: Diamond, scale: number): PixelPoint {
  if (material !== "pierre") return { x: diamond.cx, y: diamond.cy };
  return { x: diamond.cx, y: diamond.cy - WALL_HEIGHT * scale };
}

interface TextureSpec {
  material: TileMaterial;
  diamond: Diamond;
}

function tileTexture(context: TileContext, position: Position, spec: TextureSpec): Shape[] {
  const scale = originScale(context.origin);
  const { material, diamond } = spec;
  const edges = material === "eau" ? waterEdges(landSides(context.map, position)) : [];
  const center = textureCenter(material, diamond, scale);
  return groundShapes({ material, x: position.x, y: position.y, center, scale, edges });
}

function tileAt(context: TileContext, position: Position, flags: TileFlags): TileView {
  const cell = getCell(context.map, position) ?? ".";
  const diamond = gridDiamond({ ...position, origin: context.origin });
  const material = tileMaterial(context, position);
  const scale = originScale(context.origin);
  const isHovered = context.hover === cellKey(position);
  const style = flags.style ?? resolveTileStyle({ cell, isHovered, ...flags });
  const texture = tileTexture(context, position, { material, diamond });
  return { cell, position, center: { x: diamond.cx, y: diamond.cy }, points: diamond.points, scale, style, material, texture };
}

function highlightTile(context: TileContext, position: Position): TileView | null {
  const key = cellKey(position);
  if (!context.move.has(key) && !context.cast.has(key)) return null;
  const flags = { isMoveCell: context.move.has(key), isCastCell: context.cast.has(key), castElement: context.castElement };
  return tileAt(context, position, flags);
}

function isTileView(view: TileView | null): view is TileView {
  return view !== null;
}

function decorView(spec: DecorSpec, origin: IsoOrigin): DecorView {
  const diamond = gridDiamond({ x: spec.x, y: spec.y, origin });
  const center = { x: diamond.cx, y: diamond.cy };
  return { type: spec.type, layer: spec.layer, center, scale: originScale(origin), depth: depthOf(spec) };
}

function decorViews(specs: readonly DecorSpec[], origin: IsoOrigin): DecorView[] {
  return [...specs].sort((a, b) => depthOf(a) - depthOf(b)).map((spec) => decorView(spec, origin));
}

function pontoonCells(specs: readonly DecorSpec[]): ReadonlySet<string> {
  return new Set(specs.filter((spec) => spec.type === "ponton").map((spec) => cellKey(spec)));
}

function contextOf(input: SceneInput, pontoon: ReadonlySet<string>): TileContext {
  const { map, origin, highlight } = input;
  const { hover, move, cast, castElement } = highlight;
  return { map, origin, hover, move, cast, castElement, pontoon };
}

function outlineAt(origin: IsoOrigin, cell: Position): GridOutline {
  return { cell, points: gridDiamond({ ...cell, origin }).points, scale: originScale(origin) };
}

/** Contours des seules cases praticables, en ordre peintre comme les tuiles. */
export function gridOutlines(map: AsciiMap, origin: IsoOrigin): GridOutline[] {
  const walkable = allPositions(map).filter((cell) => isWalkableCell(map, cell));
  return painterOrder(walkable).map((cell) => outlineAt(origin, cell));
}

/** Soleils de sortie : la géométrie pure, testable sans PixiJS. */
function sceneExitMarks(input: SceneInput): ExitMark[] {
  return exitMarkViews(mapExitSpecs(input.map), input.origin);
}

/** Aucune surbrillance de base : le sol est peint avant les couches d'état. */
const NO_TILE_FLAGS: TileFlags = { isMoveCell: false, isCastCell: false };

/**
 * Marqueur de coût PM d'un aperçu de chemin. `target` est le **losange** visé :
 * son centre porte la pastille, son contour porte le refus « cible invalide ».
 */
export interface PathHint {
  /** Facture DEC-10 du chemin ; pour une cible hors budget, celle qu'il coûterait. */
  cost: number;
  /** `false` : trop cher pour les PM restants — contour et croix `#B83B3B` (§3.2). */
  payable: boolean;
  target: TileView;
}

export interface PathTilesInput {
  map: AsciiMap;
  origin: IsoOrigin;
  path: readonly Position[];
  /** Style de la couche : la teinte du chemin vient de `tileStyle.ts`, jamais d'ici. */
  style: TileStyle;
}

/** Losanges d'une couche de chemin : même projection et même matériau que la grille. */
export function pathTileViews(input: PathTilesInput): TileView[] {
  const highlight = { move: new Set<string>(), cast: new Set<string>(), hover: null };
  const context = contextOf({ map: input.map, origin: input.origin, highlight }, new Set<string>());
  const flags = { ...NO_TILE_FLAGS, style: input.style };
  return input.path.map((position) => tileAt(context, position, flags));
}

/** Modèle d'affichage complet : tuiles, contours, décor, sorties et surbrillances. */
export function buildSceneModel(input: SceneInput): SceneModel {
  const specs = mapDecorSpecs(input.map);
  const context = contextOf(input, pontoonCells(specs));
  const positions = painterOrder(allPositions(input.map));
  const tiles = positions.map((cell) => tileAt(context, cell, NO_TILE_FLAGS));
  const highlights = positions.map((cell) => highlightTile(context, cell)).filter(isTileView);
  const decor = decorViews(specs, input.origin);
  const outlines = gridOutlines(input.map, input.origin);
  return { tiles, highlights, decor, outlines, exitMarks: sceneExitMarks(input) };
}
