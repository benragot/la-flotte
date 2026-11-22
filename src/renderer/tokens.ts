import type { Graphics } from "pixi.js";
import type { CombatantState } from "../engine/combatLoop/types";
import type { PixelPoint } from "./gridProjection";
import { TILE_SIZE, gridToPixel } from "./gridProjection";

export const PLAYER_TOKEN_COLOR = 0x3f7fd6;
export const ENEMY_TOKEN_COLOR = 0xd64545;
export const TOKEN_STROKE = 0x101820;
export const TOKEN_RADIUS = TILE_SIZE * 0.3;

export const HP_BAR_BG = 0x101820;
export const HP_BAR_BG_ALPHA = 0.8;
export const HP_BAR_FILL = 0x6ad06a;
export const HP_BAR_WIDTH = TILE_SIZE * 0.72;
export const HP_BAR_HEIGHT = 5;

export interface TokenView {
  center: PixelPoint;
  radius: number;
  fill: number;
  hp: number;
  maxHp: number;
  hpRatio: number;
}

export interface HpBar {
  x: number;
  y: number;
  width: number;
  height: number;
  fillWidth: number;
}

/** Borne une valeur dans `[0, 1]`. */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Ratio de points de vie, borné et sûr quand `maxHp` est nul. */
export function hpRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return clamp01(hp / maxHp);
}

export function tokenColor(kind: CombatantState["kind"]): number {
  return kind === "player" ? PLAYER_TOKEN_COLOR : ENEMY_TOKEN_COLOR;
}

export function tokenView(combatant: CombatantState): TokenView {
  return {
    center: gridToPixel(combatant.position),
    radius: TOKEN_RADIUS,
    fill: tokenColor(combatant.kind),
    hp: combatant.hp,
    maxHp: combatant.maxHp,
    hpRatio: hpRatio(combatant.hp, combatant.maxHp),
  };
}

/** Géométrie de la mini-barre de PV au-dessus du jeton. */
export function hpBarFor(token: TokenView): HpBar {
  const x = token.center.x - HP_BAR_WIDTH / 2;
  const y = token.center.y - token.radius - HP_BAR_HEIGHT - 4;
  return { x, y, width: HP_BAR_WIDTH, height: HP_BAR_HEIGHT, fillWidth: HP_BAR_WIDTH * token.hpRatio };
}

export function drawHpBar(graphics: Graphics, token: TokenView): void {
  const bar = hpBarFor(token);
  graphics.rect(bar.x, bar.y, bar.width, bar.height);
  graphics.fill({ color: HP_BAR_BG, alpha: HP_BAR_BG_ALPHA });
  graphics.rect(bar.x, bar.y, bar.fillWidth, bar.height);
  graphics.fill({ color: HP_BAR_FILL, alpha: 1 });
}

function drawToken(graphics: Graphics, token: TokenView): void {
  const { x, y } = token.center;
  graphics.circle(x, y, token.radius);
  graphics.fill({ color: token.fill, alpha: 1 });
  graphics.circle(x, y, token.radius);
  graphics.stroke({ width: 2, color: TOKEN_STROKE, alpha: 0.9 });
  drawHpBar(graphics, token);
}

/** Peint les jetons héros et monstre avec leur barre de PV. */
export function drawTokens(graphics: Graphics, tokens: readonly TokenView[]): void {
  tokens.forEach((token) => drawToken(graphics, token));
}
