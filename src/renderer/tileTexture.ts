import type { PixelPoint } from "./gridProjection";
import { TILE_H, TILE_W } from "./gridProjection";
import { hashUnit } from "./cellHash";
import type { EllipseShape, LineShape, PolyShape, Shape } from "./shapes";
import type { TileMaterial } from "./tileMaterials";
import { shiftColor } from "./tileMaterials";

export type Edge = "north" | "east" | "south" | "west";

/** Un côté de case touché par la terre ferme : l'eau y dessine son écume. */
export interface NeighbourLand {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

export interface GroundShapeInput {
  material: TileMaterial;
  x: number;
  y: number;
  center: PixelPoint;
  scale: number;
  edges?: readonly Edge[];
}

interface Frame {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

interface CellStamp {
  x: number;
  y: number;
  index: number;
}

const SAND_SLOTS: readonly (readonly [number, number])[] = [
  [-0.5, 0.1],
  [-0.1, -0.45],
  [0.38, 0.22],
  [0.05, 0.5],
  [-0.55, -0.5],
];

const GALET_SLOTS: readonly (readonly [number, number])[] = [
  [-0.35, 0.18],
  [0.12, -0.3],
  [0.42, 0.28],
  [-0.05, 0.42],
  [0.28, -0.05],
];

const GALET_COLORS: readonly number[] = [0x8d8778, 0x6f6a5d, 0xa39b88];

const PLANK_RATIOS: readonly number[] = [0.3, 0.5, 0.7];

const EDGE_SEGMENTS: Record<Edge, readonly [readonly [number, number], readonly [number, number]]> = {
  north: [[0.08, -0.92], [0.92, -0.08]],
  east: [[0.92, 0.08], [0.08, 0.92]],
  south: [[0.08, 0.92], [-0.92, 0.08]],
  west: [[-0.92, -0.08], [-0.08, -0.92]],
};

function frameOf(center: PixelPoint, scale: number): Frame {
  return { cx: center.x, cy: center.y, halfW: (TILE_W / 2) * scale, halfH: (TILE_H / 2) * scale };
}

function pt(frame: Frame, u: number, v: number): number[] {
  return [frame.cx + u * frame.halfW, frame.cy + v * frame.halfH];
}

type Segment = readonly [readonly [number, number], readonly [number, number]];

function segmentPoints(frame: Frame, segment: Segment): number[] {
  return segment.flatMap(([u, v]) => pt(frame, u, v));
}

function diamond(frame: Frame, uv: readonly [number, number], size: number): number[] {
  const [u, v] = uv;
  return [...pt(frame, u - size, v), ...pt(frame, u, v - size / 2), ...pt(frame, u + size, v), ...pt(frame, u, v + size / 2)];
}

function waterEdges(land: NeighbourLand): Edge[] {
  const sides: (readonly [Edge, boolean])[] = [
    ["north", land.north],
    ["east", land.east],
    ["south", land.south],
    ["west", land.west],
  ];
  return sides.filter(([, touched]) => touched).map(([edge]) => edge);
}

function speckle(frame: Frame, cell: CellStamp, slot: readonly [number, number]): EllipseShape {
  const jitterU = (hashUnit(cell.x, cell.y, cell.index * 3 + 1) - 0.5) * 0.18;
  const jitterV = (hashUnit(cell.x, cell.y, cell.index * 3 + 2) - 0.5) * 0.18;
  const [u, v] = slot;
  const color = cell.index % 3 === 0 ? 0xe9d6a3 : 0xbfa36b;
  return { kind: "ellipse", x: frame.cx + (u + jitterU) * frame.halfW, y: frame.cy + (v + jitterV) * frame.halfH, rx: 1.7, ry: 1.1, color, alpha: 0.55 };
}

function sandShapes(input: GroundShapeInput): Shape[] {
  const frame = frameOf(input.center, input.scale);
  return SAND_SLOTS.map((slot, index) => speckle(frame, { x: input.x, y: input.y, index }, slot));
}

function galet(frame: Frame, cell: CellStamp, slot: readonly [number, number]): PolyShape {
  const [u, v] = slot;
  const size = 0.1 + hashUnit(cell.x, cell.y, cell.index + 21) * 0.06;
  const base = GALET_COLORS[cell.index % GALET_COLORS.length] ?? 0x8d8778;
  const color = shiftColor(base, Math.round((hashUnit(cell.x, cell.y, cell.index + 31) - 0.5) * 22));
  return { kind: "poly", points: diamond(frame, [u, v], size), color, alpha: 0.85 };
}

function galetShapes(input: GroundShapeInput): Shape[] {
  const frame = frameOf(input.center, input.scale);
  return GALET_SLOTS.map((slot, index) => galet(frame, { x: input.x, y: input.y, index }, slot));
}

function ripple(frame: Frame, cell: CellStamp, slot: readonly [number, number]): LineShape {
  const [u, v] = slot;
  return { kind: "line", points: segmentPoints(frame, [[u - 0.16, v], [u + 0.16, v + 0.05]]), width: 1.4, color: 0x9fd6d6, alpha: 0.35 };
}

function foamShape(frame: Frame, edge: Edge): LineShape {
  const [start, end] = EDGE_SEGMENTS[edge];
  return { kind: "line", points: segmentPoints(frame, [start, end]), width: 2.4, color: 0xe8f7f4, alpha: 0.8 };
}

function waterShapes(input: GroundShapeInput): Shape[] {
  const frame = frameOf(input.center, input.scale);
  const ripples = SAND_SLOTS.map((slot, index) => ripple(frame, { x: input.x, y: input.y, index }, slot));
  const foam = (input.edges ?? []).map((edge) => foamShape(frame, edge));
  return [...ripples, ...foam];
}

function plankSeam(frame: Frame, ratio: number): LineShape {
  return { kind: "line", points: segmentPoints(frame, [[ratio - 1, -ratio], [ratio, 1 - ratio]]), width: 1.8, color: 0x6d5133, alpha: 0.75 };
}

function nail(frame: Frame, u: number, v: number): EllipseShape {
  return { kind: "ellipse", x: frame.cx + u * frame.halfW, y: frame.cy + v * frame.halfH, rx: 1.2, ry: 0.8, color: 0x3b2c1d, alpha: 0.7 };
}

function pontonShapes(input: GroundShapeInput): Shape[] {
  const frame = frameOf(input.center, input.scale);
  const seams = PLANK_RATIOS.map((ratio) => plankSeam(frame, ratio));
  const nails = [[0.45, -0.25], [0.45, 0.25], [-0.45, -0.25], [-0.45, 0.25]].map(([u, v]) => nail(frame, u ?? 0, v ?? 0));
  return [...seams, ...nails];
}

function pierreShapes(input: GroundShapeInput): Shape[] {
  const frame = frameOf(input.center, input.scale);
  const seams = [0.32, 0.66].map((ratio) => plankSeam(frame, ratio));
  const facet = { kind: "poly" as const, points: diamond(frame, [-0.22, -0.18], 0.16), color: 0x8c95a0, alpha: 0.5 };
  return [...seams, facet];
}

const TEXTURES: Record<TileMaterial, (input: GroundShapeInput) => Shape[]> = {
  sable: sandShapes,
  galets: galetShapes,
  eau: waterShapes,
  ponton: pontonShapes,
  pierre: pierreShapes,
};

/** Formes du matériau : le peintre se contente de les tracer. */
export function groundShapes(input: GroundShapeInput): Shape[] {
  return TEXTURES[input.material](input);
}

export { waterEdges };
