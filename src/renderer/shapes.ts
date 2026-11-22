/** Formes pures produites par les textures et le décor : aucun import PixiJS. */
export interface PolyShape {
  kind: "poly";
  points: number[];
  color: number;
  alpha: number;
}

export interface LineShape {
  kind: "line";
  points: number[];
  width: number;
  color: number;
  alpha: number;
}

export interface EllipseShape {
  kind: "ellipse";
  x: number;
  y: number;
  rx: number;
  ry: number;
  color: number;
  alpha: number;
}

export interface RingShape {
  kind: "ring";
  x: number;
  y: number;
  rx: number;
  ry: number;
  width: number;
  color: number;
  alpha: number;
}

export type Shape = PolyShape | LineShape | EllipseShape | RingShape;
