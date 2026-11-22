import type { Graphics } from "pixi.js";
import type { Position } from "../engine/grid";
import type { CombatantState } from "../engine/combatLoop/types";
import type { CombatantLike, Side } from "../engine/multiCombat";
import type { IsoOrigin, PixelPoint } from "./gridProjection";
import { TILE_H, TILE_W, gridToIso, originScale } from "./gridProjection";
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
/** Dégagement entre la barre et le bas du jeton. */
export const HP_BAR_GAP = 4;
/** Dégagement au-dessus d'un sprite : la barre de PV passe au-dessus de la tête. */
export const SPRITE_HEADROOM = 30;

export const BADGE_RADIUS = 9;
export const BADGE_FILL = 0x1b2430;
export const BADGE_STROKE = 0xf2d64b;

/** Anneau du combattant actif : la couleur du cadre doré du panneau de salle. */
export const ACTIVE_RING = 0xf2d64b;
export const ACTIVE_RING_WIDTH = 3;
/** Rayon de l'anneau, en multiples du rayon du jeton : il enlace la case. */
export const ACTIVE_RING_RATIO = 1.3;

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
  /** Identité stable du jeton : deux monstres identiques en ont deux. */
  id: string;
  /** Case logique du jeton : la règle décide, le rendu ne fait que glisser. */
  cell: Position;
  center: PixelPoint;
  radius: number;
  /** Échelle de la caméra : jetons, barres et sprites suivent le décor. */
  scale: number;
  fill: number;
  hp: number;
  maxHp: number;
  hpRatio: number;
  badge: string | null;
  /** Nom complet affiché au-dessus de la barre de vie ; `null` = aucune étiquette. */
  name: string | null;
  /** Profondeur de grille `x + y`, utilisée pour l'ordre peintre des acteurs. */
  depth: number;
  /** C'est son tour : un anneau doré l'entoure, comme le cadre de sa carte. */
  active: boolean;
}

export interface HpBar {
  x: number;
  y: number;
  width: number;
  height: number;
  fillWidth: number;
}

interface TokenSpec {
  id: string;
  cell: Position;
  fill: number;
  hp: number;
  maxHp: number;
  badge: string | null;
  name: string | null;
  depth: number;
  sprite: TokenSprite;
  scale: number;
  active: boolean;
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

/**
 * `true` dès qu'une feuille connue rend le jeton. Un id fantôme (feuille jamais
 * dessinée) vaut `false` : il tombe sur le cercle, il n'est jamais omis.
 */
export function hasSpriteSheet(spriteId: string | null, sheets: ReadonlySet<string>): boolean {
  return spriteId !== null && sheets.has(spriteId);
}

/** Jetons qu'aucune feuille ne rend : la couche de scène les peint en cercle coloré. */
export function tokensNeedingCircle(
  tokens: readonly TokenView[],
  sheets: ReadonlySet<string>,
): readonly TokenView[] {
  return tokens.filter((token) => !hasSpriteSheet(token.spriteId, sheets));
}

function tokenAt(center: PixelPoint, spec: TokenSpec): TokenView {
  const { id, cell, fill, hp, maxHp, badge, name, depth, sprite, scale, active } = spec;
  const ratio = hpRatio(hp, maxHp);
  const radius = TOKEN_RADIUS * scale;
  return { id, cell, center, radius, scale, fill, hp, maxHp, hpRatio: ratio, badge, name, depth, active, ...sprite };
}

/** Jeton d'un combattant, centré sur le losange de sa case. */
export function tokenView(
  combatant: CombatantState,
  origin: IsoOrigin,
  sprite: TokenSprite = STATIC_TOKEN_SPRITE,
): TokenView {
  const { id, hp, maxHp, kind, position } = combatant;
  const base = { id, cell: position, hp, maxHp, badge: null, name: null, depth: depthOf(position), sprite, scale: originScale(origin), active: false };
  const spec = { ...base, fill: tokenColor(kind) };
  return tokenAt(gridToIso({ ...combatant.position, origin }), spec);
}

/** Jeton du héros en exploration, sans combat engagé. */
export function playerTokenView(
  position: Position,
  origin: IsoOrigin,
  sprite: TokenSprite = STATIC_TOKEN_SPRITE,
): TokenView {
  const scale = originScale(origin);
  const base = { id: "player", cell: position, hp: 1, maxHp: 1, badge: null, name: null, depth: depthOf(position), sprite, scale, active: false };
  const spec: TokenSpec = { ...base, fill: PLAYER_TOKEN_COLOR };
  return tokenAt(gridToIso({ ...position, origin }), spec);
}

/** Ce qu'un groupe d'exploration doit savoir pour piloter son `EntitySprite`. */
export interface GroupTokenInput {
  pos: Position;
  totalLevel: number;
  /** Nom complet du monstre : affiché au-dessus de la barre, jamais tronqué. */
  name?: string | null;
  /** Feuille du premier monstre du groupe ; absente = jeton géométrique documenté. */
  spriteId?: string | null;
}

/** Même chemin de sprite que le combat : la feuille du manifeste, sinon repli. */
function groupSprite(spriteId: string | null | undefined): TokenSprite {
  const known = spriteId ?? null;
  if (known === null) return STATIC_TOKEN_SPRITE;
  return { spriteId: known, facing: "left", animation: "idle", animationKey: `idle-${known}` };
}

/** Jeton d'un groupe de monstres, badgé de son niveau total. */
export function groupTokenView(group: GroupTokenInput, origin: IsoOrigin): TokenView {
  const { pos, totalLevel } = group;
  const sprite = groupSprite(group.spriteId);
  const scale = originScale(origin);
  const id = `group-${pos.x}-${pos.y}`;
  const spec = { id, cell: pos, fill: ENEMY_TOKEN_COLOR, hp: 1, maxHp: 1, badge: String(totalLevel), name: group.name ?? null, sprite, scale, active: false };
  return tokenAt(gridToIso({ ...pos, origin }), { ...spec, depth: depthOf(pos) });
}

/** Camp → couleur du jeton : le héros bleu, l'ennemi rouge, comme en 1v1. */
function fillForSide(side: Side): number {
  return side === "player" ? PLAYER_TOKEN_COLOR : ENEMY_TOKEN_COLOR;
}

/** Ce qu'un combattant de salle apporte au jeton : sa case, ses PV et son camp. */
export interface CombatantTokenInput {
  combatant: CombatantLike;
  sprite: TokenSprite;
  active: boolean;
}

/** Jeton d'un combattant 1vN : même géométrie que le 1v1, couleur par camp. */
export function combatantTokenView(input: CombatantTokenInput, origin: IsoOrigin): TokenView {
  const { combatant, sprite, active } = input;
  const scale = originScale(origin);
  const base = { id: combatant.id, cell: combatant.position, hp: combatant.hp, maxHp: combatant.maxHp, badge: null, name: null, sprite, scale, active };
  const spec = { ...base, fill: fillForSide(combatant.side), depth: depthOf(combatant.position) };
  return tokenAt(gridToIso({ ...combatant.position, origin }), spec);
}

function barLift(token: TokenView): number {
  return token.spriteId === null ? 0 : SPRITE_HEADROOM * token.scale;
}

/** Géométrie de la mini-barre de PV au-dessus du jeton (et au-dessus de la tête d'un sprite). */
export function hpBarFor(token: TokenView): HpBar {
  const width = HP_BAR_WIDTH * token.scale;
  const height = HP_BAR_HEIGHT * token.scale;
  const gap = HP_BAR_GAP * token.scale;
  const x = token.center.x - width / 2;
  const y = token.center.y - token.radius - height - gap - barLift(token);
  return { x, y, width, height, fillWidth: width * token.hpRatio };
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

function drawToken(graphics: Graphics, token: TokenView): void {
  const { x, y } = token.center;
  graphics.circle(x, y, token.radius);
  graphics.fill({ color: token.fill, alpha: 1 });
  graphics.circle(x, y, token.radius);
  graphics.stroke({ width: 2, color: TOKEN_STROKE, alpha: 0.9 });
}

/**
 * Peint les jetons géométriques (groupes, héros sans feuille).
 * La barre de PV n'est **pas** peinte ici : elle vit uniquement dans
 * `drawHpBars`, sinon les jetons géométriques la verraient deux fois.
 * Le badge de niveau vit dans la couche des étiquettes, hors du sprite.
 */
export function drawTokens(graphics: Graphics, tokens: readonly TokenView[]): void {
  tokens.forEach((token) => drawToken(graphics, token));
}

function paintActiveRing(graphics: Graphics, token: TokenView): void {
  graphics.circle(token.center.x, token.center.y, token.radius * ACTIVE_RING_RATIO);
  graphics.stroke({ width: ACTIVE_RING_WIDTH * token.scale, color: ACTIVE_RING, alpha: 1 });
}

/**
 * Anneau doré du combattant actif, peint **sous** les acteurs : il enlace la
 * case du jeton même quand une feuille de sprite le recouvre.
 */
export function drawActiveRings(graphics: Graphics, tokens: readonly TokenView[]): void {
  tokens.filter((token) => token.active).forEach((token) => paintActiveRing(graphics, token));
}
