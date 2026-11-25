import type { Position } from "../../engine/grid";
import type { IsoOrigin } from "../gridProjection";
import { gridToIso, originScale } from "../gridProjection";
import { SPRITE_ANCHOR } from "./anchor";
import { SPRITE_DISPLAY_SIZE } from "./frameMath";

/**
 * Boîte de clic d'un jeton : le corps **peint**, pas la case.
 *
 * Le sprite est posé au centre du losange puis ancré aux pieds (0,5 / 0,85) :
 * sa tête monte à `0,85 × 64 px` au-dessus du centre, sa largeur utile est celle
 * de l'art (`scripts/generate-sprites.mjs`, membres de x ≈ 12 à 57 sur 64).
 * Cliquer la tête tombait donc sur la case *derrière* (`AUDIT/ISSUES.md:33`).
 *
 * Aucune dépendance PixiJS : la fonction pure ne reçoit que des points, des
 * rectangles et des rectangles écran déjà projetés.
 */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** Rectangle écran, bords inclus : un clic sur le bord touche le jeton. */
export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Jeton candidat : son identité logique et sa géométrie d'écran. */
export interface TokenHitTarget {
  id: string;
  cell: Position;
  /** Centre du losange de sa case, en pixels écran. */
  center: ScreenPoint;
  /** Échelle de la caméra : la boîte suit le zoom du décor. */
  scale: number;
  /** Profondeur peinte (`x + y`) : départage deux boîtes chevauchées. */
  depth: number;
}

/** Ce qu'un jeton a besoin de fournir pour être visé : son id et sa case. */
export interface TokenAnchor {
  id: string;
  cell: Position;
}

/** Constantes géométriques de la visée, dérivées de la peinture. */
export interface TokenHitGeometry {
  /** Côté d'une frame à l'échelle 1, en px écran (`SPRITE_DISPLAY_SIZE`). */
  frameSize: number;
  /** Ancre verticale de la peinture (`SPRITE_ANCHOR.y`). */
  anchorY: number;
  /** Part de la frame occupée par le corps peint, centrée horizontalement. */
  bodyWidthRatio: number;
}

/** Part de la frame qu'occupe le corps : l'art va de x ≈ 12 à 57 sur 64. */
export const TOKEN_BODY_WIDTH_RATIO = 0.7;

/** Géométrie de référence : exactement celle que la scène peint. */
export const SPRITE_HIT_GEOMETRY: TokenHitGeometry = {
  frameSize: SPRITE_DISPLAY_SIZE,
  anchorY: SPRITE_ANCHOR.y,
  bodyWidthRatio: TOKEN_BODY_WIDTH_RATIO,
};

/** Boîte écran d'un jeton : de la tête aux pieds, centrée sur le losange. */
export function tokenHitBox(target: TokenHitTarget, geometry: TokenHitGeometry = SPRITE_HIT_GEOMETRY): ScreenRect {
  const height = geometry.frameSize * target.scale;
  const half = (height * geometry.bodyWidthRatio) / 2;
  const top = target.center.y - height * geometry.anchorY;
  return { left: target.center.x - half, top, right: target.center.x + half, bottom: top + height };
}

/** Le clic est-il dans la boîte ? Bords compris, pour ne pas perdre le dernier pixel. */
export function containsPoint(point: ScreenPoint, box: ScreenRect): boolean {
  const insideX = point.x >= box.left && point.x <= box.right;
  const insideY = point.y >= box.top && point.y <= box.bottom;
  return insideX && insideY;
}

/** Candidat de clic d'une case : même projection que `tokenView` (`tokens.ts`). */
export function hitTargetOf(anchor: TokenAnchor, origin: IsoOrigin): TokenHitTarget {
  const { cell } = anchor;
  const center = gridToIso({ ...cell, origin });
  return { id: anchor.id, cell, center, scale: originScale(origin), depth: cell.x + cell.y };
}

/** Le plus **devant** d'abord (`x + y` décroissant), puis l'identifiant : ordre total. */
function compareTargets(a: TokenHitTarget, b: TokenHitTarget): number {
  if (a.depth !== b.depth) return b.depth - a.depth;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

function frontMost(hits: readonly TokenHitTarget[]): TokenHitTarget | null {
  return [...hits].sort(compareTargets)[0] ?? null;
}

/**
 * Jeton sous le curseur, sinon `null` (le clic retombe alors sur la grille).
 *
 * Seules les boîtes **qui contiennent le point** concourent : toute candidate a
 * une distance nulle au curseur, c'est le « plus proche » au sens strict. Le
 * départage est l'ordre peintre : la boîte la plus avancée est celle que le
 * joueur voit, et l'identifiant tranche les superpositions exactes.
 */
export function pickToken(
  pointer: ScreenPoint,
  targets: readonly TokenHitTarget[],
  geometry: TokenHitGeometry = SPRITE_HIT_GEOMETRY,
): TokenHitTarget | null {
  const hits = targets.filter((target) => containsPoint(pointer, tokenHitBox(target, geometry)));
  return frontMost(hits);
}
