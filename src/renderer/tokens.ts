import type { Graphics } from "pixi.js";
import type { Position } from "../engine/grid";
import type { CombatantState } from "../engine/combatLoop/types";
import type { IsoOrigin, PixelPoint } from "./gridProjection";
import { TILE_H, TILE_W, gridToIso } from "./gridProjection";
import { depthOf } from "./scene";
import type { Facing, SpriteAnimationName } from "./sprites/types";

export const PLAYER_TOKEN_COLOR = 0x3f7fd6;
export const ENEMY_TOKEN_COLOR = 0xd64545;
export const TOKEN_STROKE = 0x101820;
export const TOKEN_RADIUS = TILE_H * 0.4;

export const HP_BAR_BG = 0x101820;
export const HP_BAR_BG_ALPHA = 0.8;
export const HP_BAR_FILL = 0x6ad06a;
export const HP_BAR_WIDTH = TILE_W * 0.5;
export const HP_BAR_HEIGHT = 5;
/** Dégagement au-dessus d'un sprite : la barre de PV passe au-dessus de la tête. */
export const SPRITE_HEADROOM = 30;

export const BADGE_RADIUS = 9;
export const BADGE_FILL = 0x1b2430;
export const BADGE_STROKE = 0xf2d64b;

/** Ce qu'un jeton doit savoir pour piloter son `EntitySprite`. */
export interface TokenSprite {
  spriteId: string | null;
  facing: Facing;
  animation: SpriteAnimationName;
  animationKey: string;
}

/** Repli géométrique : aucun sprite connu pour ce jeton. */
export const STATIC_TOKEN_SPRITE: TokenSprite = {
  spriteId: null,
  facing: "right",
  animation: "idle",
  animationKey: "static",
};

export interface TokenView extends TokenSprite {
  center: PixelPoint;
  radius: number;
  fill: number;
  hp: number;
  maxHp: number;
  hpRatio: number;
  badge: string | null;
  /** Profondeur de grille `x + y`, utilisée pour l'ordre peintre des acteurs. */
  depth: number;
}

export interface HpBar {
  x: number;
  y: number;
  width: number;
  height: number;
  fillWidth: number;
}

export interface TokenBadge {
  text: string;
  x: number;
  y: number;
  radius: number;
}

interface TokenSpec {
  fill: number;
  hp: number;
  maxHp: number;
  badge: string | null;
  depth: number;
  sprite: TokenSprite;
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

/** Orientation écran : l'acteur regarde la colonne isométrique de sa cible. */
export function facingToward(from: Position, to: Position): Facing {
  return to.x - to.y >= from.x - from.y ? "right" : "left";
}

function tokenAt(center: PixelPoint, spec: TokenSpec): TokenView {
  const { fill, hp, maxHp, badge, depth, sprite } = spec;
  const ratio = hpRatio(hp, maxHp);
  return { center, radius: TOKEN_RADIUS, fill, hp, maxHp, hpRatio: ratio, badge, depth, ...sprite };
}

/** Jeton d'un combattant, centré sur le losange de sa case. */
export function tokenView(
  combatant: CombatantState,
  origin: IsoOrigin,
  sprite: TokenSprite = STATIC_TOKEN_SPRITE,
): TokenView {
  const center = gridToIso({ ...combatant.position, origin });
  const { hp, maxHp, kind, position } = combatant;
  return tokenAt(center, { fill: tokenColor(kind), hp, maxHp, badge: null, depth: depthOf(position), sprite });
}

/** Jeton du héros en exploration, sans combat engagé. */
export function playerTokenView(
  position: Position,
  origin: IsoOrigin,
  sprite: TokenSprite = STATIC_TOKEN_SPRITE,
): TokenView {
  const spec: TokenSpec = { fill: PLAYER_TOKEN_COLOR, hp: 1, maxHp: 1, badge: null, depth: depthOf(position), sprite };
  return tokenAt(gridToIso({ ...position, origin }), spec);
}

/** Jeton d'un groupe de monstres, badgé de son niveau total. */
export function groupTokenView(group: { pos: Position; totalLevel: number }, origin: IsoOrigin): TokenView {
  const { pos, totalLevel } = group;
  const spec = { fill: ENEMY_TOKEN_COLOR, hp: 1, maxHp: 1, badge: String(totalLevel), sprite: STATIC_TOKEN_SPRITE };
  return tokenAt(gridToIso({ ...pos, origin }), { ...spec, depth: depthOf(pos) });
}

function barLift(token: TokenView): number {
  return token.spriteId === null ? 0 : SPRITE_HEADROOM;
}

/** Géométrie de la mini-barre de PV au-dessus du jeton (et au-dessus de la tête d'un sprite). */
export function hpBarFor(token: TokenView): HpBar {
  const x = token.center.x - HP_BAR_WIDTH / 2;
  const y = token.center.y - token.radius - HP_BAR_HEIGHT - 4 - barLift(token);
  return { x, y, width: HP_BAR_WIDTH, height: HP_BAR_HEIGHT, fillWidth: HP_BAR_WIDTH * token.hpRatio };
}

/** Géométrie du badge de niveau, en haut à droite du jeton. */
export function tokenBadge(token: TokenView): TokenBadge | null {
  if (token.badge === null) return null;
  const x = token.center.x + token.radius;
  const y = token.center.y - token.radius;
  return { text: token.badge, x, y, radius: BADGE_RADIUS };
}

export function drawHpBar(graphics: Graphics, token: TokenView): void {
  const bar = hpBarFor(token);
  graphics.rect(bar.x, bar.y, bar.width, bar.height);
  graphics.fill({ color: HP_BAR_BG, alpha: HP_BAR_BG_ALPHA });
  graphics.rect(bar.x, bar.y, bar.fillWidth, bar.height);
  graphics.fill({ color: HP_BAR_FILL, alpha: 1 });
}

/** Barres de PV seules, pour les jetons rendus par un `EntitySprite`. */
export function drawHpBars(graphics: Graphics, tokens: readonly TokenView[]): void {
  tokens.forEach((token) => drawHpBar(graphics, token));
}

function paintBadge(graphics: Graphics, token: TokenView): void {
  const badge = tokenBadge(token);
  if (badge === null) return;
  graphics.circle(badge.x, badge.y, badge.radius);
  graphics.fill({ color: BADGE_FILL, alpha: 0.9 });
  graphics.circle(badge.x, badge.y, badge.radius);
  graphics.stroke({ width: 1.5, color: BADGE_STROKE, alpha: 1 });
}

function drawToken(graphics: Graphics, token: TokenView): void {
  const { x, y } = token.center;
  graphics.circle(x, y, token.radius);
  graphics.fill({ color: token.fill, alpha: 1 });
  graphics.circle(x, y, token.radius);
  graphics.stroke({ width: 2, color: TOKEN_STROKE, alpha: 0.9 });
  paintBadge(graphics, token);
}

/**
 * Peint les jetons géométriques (groupes, héros sans feuille) avec leur badge.
 * La barre de PV n'est **pas** peinte ici : elle vit uniquement dans
 * `drawHpBars`, sinon les jetons géométriques la verraient deux fois.
 */
export function drawTokens(graphics: Graphics, tokens: readonly TokenView[]): void {
  tokens.forEach((token) => drawToken(graphics, token));
}
