import type { Graphics } from "pixi.js";
import { TILE_H, TILE_W } from "./gridProjection";
import { paintShapes } from "./paintShapes";
import type { RingShape } from "./shapes";
import type { TokenView } from "./tokens";
import { ENEMY_TOKEN_COLOR } from "./tokens";

/**
 * Anneau d'équipe au sol : ellipse `0,92 × 0,46` tuile, trait `2 px`, posée sous
 * le sprite **et sous son ombre** (`ui-dofus-retro.md` §5 et §8.6). L'ombre est
 * cuite dans la feuille de sprite (couche `actors`) : un anneau dans la couche
 * `teamRings` se lit donc **autour** d'elle, jamais par-dessus.
 */
export const TEAM_RING_RX = TILE_W * 0.46;
export const TEAM_RING_RY = TILE_H * 0.23;
export const TEAM_RING_STROKE = 2;

/** Cerclage des combattants (§3.2) : **bleu `#3F7FD6` alliés / rouge `#D64545` ennemis**. */
export const ALLY_RING_COLOR = 0x3f7fd6;
export const ENEMY_RING_COLOR = 0xd64545;

/**
 * Le camp voyage déjà sur `TokenView.fill` (le moteur l'a décidé) : le rendu ne
 * recalcule aucune appartenance, il ne fait que choisir la teinte de §3.2.
 */
export function ringColorFor(fill: number): number {
  return fill === ENEMY_TOKEN_COLOR ? ENEMY_RING_COLOR : ALLY_RING_COLOR;
}

/** Les trois mesures qui suivent la caméra : rayons et épaisseur de trait. */
function scaledRing(token: TokenView): { rx: number; ry: number; width: number } {
  const { scale } = token;
  return { rx: TEAM_RING_RX * scale, ry: TEAM_RING_RY * scale, width: TEAM_RING_STROKE * scale };
}

/** Géométrie de l'anneau d'un jeton : toutes les mesures suivent l'échelle caméra. */
export function teamRingFor(token: TokenView): RingShape {
  const { x, y } = token.center;
  return { kind: "ring", x, y, color: ringColorFor(token.fill), alpha: 1, ...scaledRing(token) };
}

/** Peint un anneau par jeton : la couche `teamRings` est sous les jetons et les acteurs. */
export function drawTeamRings(graphics: Graphics, tokens: readonly TokenView[]): void {
  paintShapes(graphics, tokens.map(teamRingFor));
}
