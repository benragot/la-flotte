import type { CellType, DecorSpec } from "../schemas/mapSchema";
import type { AsciiMap, Position } from "../engine/grid";
import { getCell } from "../engine/grid";
import { allPositions } from "../engine/combatLoop/cells";
import type { DecorView } from "./decor";
import type { Diamond, IsoOrigin, PixelPoint } from "./gridProjection";
import { gridDiamond, originScale } from "./gridProjection";
import { mapDecorSpecs } from "./mapDecor";
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
}

export interface SceneInput {
  map: AsciiMap;
  highlight: GridHighlight;
  origin: IsoOrigin;
}

export interface SceneModel {
  tiles: TileView[];
  highlights: TileView[];
  /** Objets de décor de `data/maps.yaml`, en ordre peintre. */
  decor: DecorView[];
}

interface TileFlags {
  isMoveCell: boolean;
  isCastCell: boolean;
}

interface TileContext {
  map: AsciiMap;
  origin: IsoOrigin;
  hover: string | null;
  move: ReadonlySet<string>;
  cast: ReadonlySet<string>;
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

/** Profondeur isométrique d'une case : c'est elle qui ordonne le rendu peintre. */
export function depthOf(position: Position): number {
  return position.x + position.y;
}

function depthOrder(a: Position, b: Position): number {
  const delta = depthOf(a) - depthOf(b);
  return delta === 0 ? a.y - b.y : delta;
}

/** Ordre peintre : cases du haut de l'écran d'abord (`x + y` croissant). */
export function painterOrder(positions: readonly Position[]): Position[] {
  return [...positions].sort(depthOrder);
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
  const style = resolveTileStyle({ cell, isHovered, ...flags });
  const texture = tileTexture(context, position, { material, diamond });
  return { cell, position, center: { x: diamond.cx, y: diamond.cy }, points: diamond.points, scale, style, material, texture };
}

function highlightTile(context: TileContext, position: Position): TileView | null {
  const key = cellKey(position);
  if (!context.move.has(key) && !context.cast.has(key)) return null;
  const flags = { isMoveCell: context.move.has(key), isCastCell: context.cast.has(key) };
  return tileAt(context, position, flags);
}

function isTileView(view: TileView | null): view is TileView {
  return view !== null;
}

function decorDepth(spec: DecorSpec): number {
  return spec.x + spec.y;
}

function decorView(spec: DecorSpec, origin: IsoOrigin): DecorView {
  const diamond = gridDiamond({ x: spec.x, y: spec.y, origin });
  return { type: spec.type, layer: spec.layer, center: { x: diamond.cx, y: diamond.cy }, scale: originScale(origin) };
}

function decorViews(specs: readonly DecorSpec[], origin: IsoOrigin): DecorView[] {
  return [...specs].sort((a, b) => decorDepth(a) - decorDepth(b)).map((spec) => decorView(spec, origin));
}

function pontoonCells(specs: readonly DecorSpec[]): ReadonlySet<string> {
  return new Set(specs.filter((spec) => spec.type === "ponton").map((spec) => cellKey(spec)));
}

function contextOf(input: SceneInput, pontoon: ReadonlySet<string>): TileContext {
  const { map, origin, highlight } = input;
  return { map, origin, hover: highlight.hover, move: highlight.move, cast: highlight.cast, pontoon };
}

/** Modèle d'affichage complet : tuiles de base, décor et surbrillances en ordre peintre. */
export function buildSceneModel(input: SceneInput): SceneModel {
  const specs = mapDecorSpecs(input.map);
  const context = contextOf(input, pontoonCells(specs));
  const positions = painterOrder(allPositions(input.map));
  const base: TileFlags = { isMoveCell: false, isCastCell: false };
  const tiles = positions.map((cell) => tileAt(context, cell, base));
  const highlights = positions.map((cell) => highlightTile(context, cell)).filter(isTileView);
  return { tiles, highlights, decor: decorViews(specs, input.origin) };
}
