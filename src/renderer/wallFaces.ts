import { TILE_H, TILE_W } from "./gridProjection";
import { WALL_HEIGHT, WALL_SIDE, WALL_SIDE_EAST } from "./tileStyle";

/** Ce qu'un mur doit connaître du losange qu'il occupe : centre, échelle et sommets au sol. */
export interface WallShape {
  center: { x: number; y: number };
  scale: number;
  points: readonly number[];
}

/** Une face latérale et sa teinte, prête à être peinte. */
export interface WallFace {
  points: number[];
  color: number;
}

/** Repère du relief : centre, demi-tuile et hauteur, déjà à l'échelle de la scène. */
interface WallFrame {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  height: number;
}

function frameOf(shape: WallShape): WallFrame {
  return {
    cx: shape.center.x,
    cy: shape.center.y,
    halfW: (TILE_W / 2) * shape.scale,
    halfH: (TILE_H / 2) * shape.scale,
    height: WALL_HEIGHT * shape.scale,
  };
}

/** Sommets du losange translatés verticalement, pour le relief. */
function shiftPoints(points: readonly number[], dy: number): number[] {
  return points.map((value, index) => (index % 2 === 0 ? value : value + dy));
}

/** Losange du dessus : le losange au sol remonté de la hauteur du mur. */
export function wallTopPoints(shape: WallShape): number[] {
  return shiftPoints(shape.points, -WALL_HEIGHT * shape.scale);
}

/** Face sud-ouest : arête gauche → pointe basse, remontée à la verticale. */
function westFace(frame: WallFrame): number[] {
  const { cx, cy, halfW, halfH, height } = frame;
  return [cx - halfW, cy, cx, cy + halfH, cx, cy + halfH - height, cx - halfW, cy - height];
}

/** Face sud-est : pointe basse → arête droite, même remontée — la seconde face du mur. */
function eastFace(frame: WallFrame): number[] {
  const { cx, cy, halfW, halfH, height } = frame;
  return [cx, cy + halfH, cx + halfW, cy, cx + halfW, cy - height, cx, cy + halfH - height];
}

/** Les deux flancs visibles du mur, du plus sombre au plus clair. */
export function wallFaces(shape: WallShape): WallFace[] {
  const frame = frameOf(shape);
  return [
    { points: westFace(frame), color: WALL_SIDE },
    { points: eastFace(frame), color: WALL_SIDE_EAST },
  ];
}
