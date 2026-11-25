import { Graphics } from "pixi.js";
import type { DecorView } from "./decor";
import { decorShapes } from "./decor";
import { paintShapes } from "./paintShapes";

function paintOne(graphics: Graphics, view: DecorView): void {
  paintShapes(graphics, decorShapes(view));
}

/** Peint les objets de décor d'une couche, dans l'ordre peintre reçu. */
export function drawDecor(graphics: Graphics, views: readonly DecorView[]): void {
  views.forEach((view) => paintOne(graphics, view));
}

/** Nœud propre à un objet : il entre dans la séquence de profondeur avec les acteurs. */
export function decorNode(view: DecorView): Graphics {
  const node = new Graphics();
  paintOne(node, view);
  return node;
}
