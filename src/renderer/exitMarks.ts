import type { Position } from "../engine/grid";
import type { ExitSpec } from "../schemas/mapSchema";
import type { Diamond, IsoCellInput, IsoOrigin, PixelPoint } from "./gridProjection";
import { TILE_H, TILE_W, diamondPoints, gridToIso, originScale } from "./gridProjection";

/**
 * Or du survol `#F2D64B` (`ui-dofus-retro.md` §3.2) : la seule teinte dorée
 * libre, `#E2C044` étant réservé aux étoiles de groupe (§3.1).
 */
export const EXIT_MARK_FILL = 0xf2d64b;
/**
 * Encre sombre `#2B241D` (§1.1) : sur le sable `#D8BD82` le doré ne tient que
 * 1,26:1, alors que ce contour y monte à 8,39:1 — et reste à 3,20:1 sur l'eau.
 */
export const EXIT_MARK_STROKE = 0x2b241d;
export const EXIT_MARK_STROKE_WIDTH = 1.5;
/** 40 % de la largeur de la case : un repère, pas un aplat qui mange la grille. */
export const EXIT_MARK_RATIO = 0.4;

export interface ExitMark {
  /** Case de sortie, telle que `data/maps.yaml` la déclare. */
  cell: Position;
  center: PixelPoint;
  points: number[];
  scale: number;
}

function markHalf(origin: IsoOrigin): PixelPoint {
  const scale = originScale(origin) * EXIT_MARK_RATIO;
  return { x: (TILE_W / 2) * scale, y: (TILE_H / 2) * scale };
}

/** Losange 2:1 centré sur la case : il suit `gridToIso`, jamais une constante d'écran. */
export function exitMarkDiamond(input: IsoCellInput): Diamond {
  const center = gridToIso(input);
  return { cx: center.x, cy: center.y, points: diamondPoints(center, markHalf(input.origin)) };
}

function exitMarkView(exit: ExitSpec, origin: IsoOrigin): ExitMark {
  const cell = { x: exit.x, y: exit.y };
  const diamond = exitMarkDiamond({ ...cell, origin });
  return { cell, center: { x: diamond.cx, y: diamond.cy }, points: diamond.points, scale: originScale(origin) };
}

/** Un marqueur par sortie déclarée : aucune carte sans sortie n'en reçoit. */
export function exitMarkViews(exits: readonly ExitSpec[], origin: IsoOrigin): ExitMark[] {
  return exits.map((exit) => exitMarkView(exit, origin));
}
