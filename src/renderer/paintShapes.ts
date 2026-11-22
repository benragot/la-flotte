import type { Graphics } from "pixi.js";
import type { EllipseShape, LineShape, PolyShape, RingShape, Shape } from "./shapes";

function paintPoly(graphics: Graphics, shape: PolyShape): void {
  graphics.poly(shape.points);
  graphics.fill({ color: shape.color, alpha: shape.alpha });
}

function toPairs(points: readonly number[]): [number, number][] {
  const count = Math.floor(points.length / 2);
  return Array.from({ length: count }, (_unused, index) => [points[index * 2] ?? 0, points[index * 2 + 1] ?? 0]);
}

function firstPoint(points: readonly number[]): [number, number] {
  return [points[0] ?? 0, points[1] ?? 0];
}

function tracePath(graphics: Graphics, points: readonly number[]): void {
  const [x, y] = firstPoint(points);
  graphics.moveTo(x, y);
  toPairs(points.slice(2)).forEach(([u, v]) => graphics.lineTo(u, v));
}

function paintLine(graphics: Graphics, shape: LineShape): void {
  tracePath(graphics, shape.points);
  graphics.stroke({ width: shape.width, color: shape.color, alpha: shape.alpha });
}

function paintEllipse(graphics: Graphics, shape: EllipseShape): void {
  graphics.ellipse(shape.x, shape.y, shape.rx, shape.ry);
  graphics.fill({ color: shape.color, alpha: shape.alpha });
}

function paintRing(graphics: Graphics, shape: RingShape): void {
  graphics.ellipse(shape.x, shape.y, shape.rx, shape.ry);
  graphics.stroke({ width: shape.width, color: shape.color, alpha: shape.alpha });
}

function paintOne(graphics: Graphics, shape: Shape): void {
  if (shape.kind === "poly") return paintPoly(graphics, shape);
  if (shape.kind === "line") return paintLine(graphics, shape);
  if (shape.kind === "ellipse") return paintEllipse(graphics, shape);
  paintRing(graphics, shape);
}

/** Trace une liste de formes pures sur la couche PixiJS courante. */
export function paintShapes(graphics: Graphics, shapes: readonly Shape[]): void {
  shapes.forEach((shape) => paintOne(graphics, shape));
}
