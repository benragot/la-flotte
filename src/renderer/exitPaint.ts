import type { Graphics } from "pixi.js";
import type { ExitMark } from "./exitMarks";
import { EXIT_MARK_FILL, EXIT_MARK_STROKE, EXIT_MARK_STROKE_WIDTH } from "./exitMarks";

/** Aplat doré puis contour sombre : le soleil se lit sur le sable comme sur l'eau. */
function paintExitMark(graphics: Graphics, mark: ExitMark): void {
  graphics.poly(mark.points);
  graphics.fill({ color: EXIT_MARK_FILL, alpha: 1 });
  graphics.poly(mark.points);
  graphics.stroke({ width: EXIT_MARK_STROKE_WIDTH * mark.scale, color: EXIT_MARK_STROKE, alpha: 1 });
}

/** Un losange doré par sortie, **sous** les jetons : ni nom, ni PV, ni case masqués. */
export function drawExitMarks(graphics: Graphics, marks: readonly ExitMark[]): void {
  marks.forEach((mark) => paintExitMark(graphics, mark));
}
