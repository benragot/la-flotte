import type { DecorLayer, DecorType } from "../schemas/mapSchema";
import type { PixelPoint } from "./gridProjection";
import { TILE_H, TILE_W } from "./gridProjection";
import type { EllipseShape, LineShape, PolyShape, RingShape, Shape } from "./shapes";

/**
 * Objet de décor prêt à peindre : centre iso de sa case, échelle de caméra.
 * Toutes les formes viennent du code — aucun fichier image, aucun asset.
 */
export interface DecorView {
  type: DecorType;
  layer: DecorLayer;
  center: PixelPoint;
  scale: number;
  /** Profondeur de grille `x + y` : le même axe que les acteurs et les tuiles. */
  depth: number;
}

interface Frame {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
}

interface Ink {
  color: number;
  alpha: number;
}

interface StrokeInk extends Ink {
  width: number;
}

interface EllipseInk extends Ink {
  rx: number;
  ry: number;
}

interface RingInk extends EllipseInk {
  width: number;
}

type Uv = readonly (readonly [number, number])[];

function frameOf(center: PixelPoint, scale: number): Frame {
  return { cx: center.x, cy: center.y, halfW: (TILE_W / 2) * scale, halfH: (TILE_H / 2) * scale };
}

function pt(frame: Frame, u: number, v: number): number[] {
  return [frame.cx + u * frame.halfW, frame.cy + v * frame.halfH];
}

function poly(frame: Frame, uv: Uv, ink: Ink): PolyShape {
  return { kind: "poly", points: uv.flatMap(([u, v]) => pt(frame, u, v)), color: ink.color, alpha: ink.alpha };
}

function line(frame: Frame, uv: Uv, ink: StrokeInk): LineShape {
  return { kind: "line", points: uv.flatMap(([u, v]) => pt(frame, u, v)), width: ink.width, color: ink.color, alpha: ink.alpha };
}

function ell(frame: Frame, uv: readonly [number, number], ink: EllipseInk): EllipseShape {
  const [x, y] = pt(frame, uv[0], uv[1]);
  return { kind: "ellipse", x: x ?? 0, y: y ?? 0, rx: ink.rx, ry: ink.ry, color: ink.color, alpha: ink.alpha };
}

function ring(frame: Frame, uv: readonly [number, number], ink: RingInk): RingShape {
  const [x, y] = pt(frame, uv[0], uv[1]);
  return { kind: "ring", x: x ?? 0, y: y ?? 0, rx: ink.rx, ry: ink.ry, width: ink.width, color: ink.color, alpha: ink.alpha };
}

/** Épave échouée : coque, pont, quille et membrures. */
function epaveShapes(frame: Frame): Shape[] {
  const hull = poly(frame, [[-1.1, 0.05], [-0.55, 0.55], [0.35, 0.6], [1.05, 0.1], [0.55, -0.08], [-0.5, -0.12]], { color: 0x4a3324, alpha: 1 });
  const deck = poly(frame, [[-0.78, 0.02], [-0.4, 0.34], [0.42, 0.38], [0.82, 0.08], [0.3, 0], [-0.42, -0.02]], { color: 0x6b4a33, alpha: 1 });
  const keel = line(frame, [[-1.02, 0.34], [0.92, 0.4]], { width: 2.4, color: 0x241610, alpha: 0.9 });
  const ribUs = [-0.42, 0, 0.42];
  const ribs = ribUs.map((u) => line(frame, [[u, 0.02], [u, 0.34 + u * 0.06]], { width: 1.6, color: 0x3a261b, alpha: 0.9 }));
  return [hull, deck, keel, ...ribs];
}

/** Mât couché : fût, veine de bois, vergue et filin. */
function matShapes(frame: Frame): Shape[] {
  const pole = poly(frame, [[-1.15, -0.04], [-0.95, -0.14], [1.05, 0.06], [0.92, 0.14]], { color: 0x9a7a4f, alpha: 1 });
  const grain = line(frame, [[-0.95, -0.02], [0.9, 0.08]], { width: 1.2, color: 0x6f5535, alpha: 0.8 });
  const yard = line(frame, [[0.72, -0.3], [0.95, 0.16]], { width: 2, color: 0x7d6038, alpha: 1 });
  const rope = line(frame, [[-1, -0.1], [-0.72, -0.34], [-0.5, -0.3]], { width: 1, color: 0xd9c08a, alpha: 0.8 });
  return [pole, grain, yard, rope];
}

/** Cordages : deux filins qui traînent et un tortillon. */
function cordagesShapes(frame: Frame): Shape[] {
  const ropeA = line(frame, [[-0.9, -0.2], [-0.4, 0.1], [0.1, -0.1], [0.6, 0.2]], { width: 1.6, color: 0xc9a86b, alpha: 0.9 });
  const ropeB = line(frame, [[-0.8, 0.3], [-0.2, 0.05], [0.4, 0.3], [0.9, 0.1]], { width: 1.3, color: 0xb08d55, alpha: 0.85 });
  const coil = ring(frame, [0.55, 0.32], { rx: 0.16, ry: 0.1, width: 1.4, color: 0xb08d55, alpha: 0.9 });
  return [ropeA, ropeB, coil];
}

/** Baril : corps, couvercle, cercles et douve. */
function barilShapes(frame: Frame): Shape[] {
  const body = ell(frame, [0, 0.05], { rx: 0.34, ry: 0.4, color: 0x7a5334, alpha: 1 });
  const top = ell(frame, [0, -0.18], { rx: 0.24, ry: 0.1, color: 0x9a6f45, alpha: 1 });
  const hoopA = line(frame, [[-0.33, -0.08], [0.33, -0.08]], { width: 1.6, color: 0x4a3220, alpha: 0.9 });
  const hoopB = line(frame, [[-0.33, 0.22], [0.33, 0.22]], { width: 1.6, color: 0x4a3220, alpha: 0.9 });
  const stave = line(frame, [[0, -0.16], [0, 0.3]], { width: 1, color: 0x5d3f26, alpha: 0.5 });
  return [body, top, hoopA, hoopB, stave];
}

/** Caisse : boîte iso, dessus clair et deux flancs. */
function caisseShapes(frame: Frame): Shape[] {
  const top = poly(frame, [[0, -0.5], [0.5, -0.2], [0, 0.1], [-0.5, -0.2]], { color: 0xb08a58, alpha: 1 });
  const left = poly(frame, [[-0.5, -0.2], [0, 0.1], [0, 0.5], [-0.5, 0.2]], { color: 0x7d5c37, alpha: 1 });
  const right = poly(frame, [[0.5, -0.2], [0, 0.1], [0, 0.5], [0.5, 0.2]], { color: 0x946d43, alpha: 1 });
  const brace = line(frame, [[-0.5, 0.05], [0, 0.34]], { width: 1, color: 0x5f452a, alpha: 0.8 });
  return [top, left, right, brace];
}

/** Ancre rouillée : anneau, tige, jas, pattes. */
function ancreShapes(frame: Frame): Shape[] {
  const eye = ring(frame, [0, -0.62], { rx: 0.12, ry: 0.08, width: 1.6, color: 0x7a4a3a, alpha: 1 });
  const shank = line(frame, [[0, -0.5], [0, 0.35]], { width: 3, color: 0x4c4f55, alpha: 1 });
  const stock = line(frame, [[-0.32, -0.36], [0.32, -0.36]], { width: 2.2, color: 0x4c4f55, alpha: 1 });
  const armLeft = line(frame, [[-0.42, 0.32], [0, 0.5]], { width: 2.4, color: 0x4c4f55, alpha: 1 });
  const armRight = line(frame, [[0.42, 0.32], [0, 0.5]], { width: 2.4, color: 0x4c4f55, alpha: 1 });
  const rust = line(frame, [[-0.02, -0.4], [0.02, 0.3]], { width: 1, color: 0x8a5236, alpha: 0.7 });
  return [eye, shank, stock, armLeft, armRight, rust];
}

/** Chaîne : anneaux alternés posés en diagonale. */
function chaineShapes(frame: Frame): Shape[] {
  const links: readonly (readonly [number, number])[] = [[-0.6, 0.3], [-0.3, 0.14], [0, 0], [0.3, -0.14], [0.6, -0.28]];
  return links.map((uv) => ring(frame, uv, { rx: 0.1, ry: 0.07, width: 1.4, color: 0x606468, alpha: 0.95 }));
}

/** Rocher : bloc sombre et facette éclairée. */
function rocherShapes(frame: Frame): Shape[] {
  const blob = poly(frame, [[-0.55, 0.18], [-0.3, -0.35], [0.18, -0.45], [0.52, -0.05], [0.4, 0.3], [0.02, 0.48], [-0.35, 0.4]], { color: 0x6b6f73, alpha: 1 });
  const facet = poly(frame, [[-0.3, -0.32], [0.16, -0.4], [0.3, -0.1], [-0.1, 0.02]], { color: 0x868b90, alpha: 0.85 });
  const crack = line(frame, [[-0.2, 0.25], [0.18, 0.05]], { width: 1, color: 0x4c5054, alpha: 0.8 });
  return [blob, facet, crack];
}

/** Algues : trois lames ondulées et une pointe claire. */
function algueShapes(frame: Frame): Shape[] {
  const blades = [-0.25, 0, 0.25].map((u) => line(frame, [[u, 0.45], [u - 0.08, 0.1], [u + 0.06, -0.2], [u - 0.02, -0.45]], { width: 1.8, color: 0x3f6b45, alpha: 0.85 }));
  const tip = ell(frame, [-0.02, -0.45], { rx: 0.08, ry: 0.05, color: 0x598a5c, alpha: 0.8 });
  return [...blades, tip];
}

/** Débris : deux planches et un éclat de coque. */
function debrisShapes(frame: Frame): Shape[] {
  const plankA = line(frame, [[-0.45, 0.28], [0.3, 0.02]], { width: 2, color: 0x9a7a4f, alpha: 1 });
  const plankB = line(frame, [[-0.2, 0.45], [0.45, 0.24]], { width: 1.6, color: 0x7d6038, alpha: 1 });
  const nail = ell(frame, [-0.3, 0.24], { rx: 1.2, ry: 0.8, color: 0x3b2c1d, alpha: 0.8 });
  const shard = poly(frame, [[0.5, 0.32], [0.66, 0.22], [0.6, 0.42]], { color: 0x6b6f73, alpha: 0.9 });
  return [plankA, plankB, nail, shard];
}

/** `ponton` ne dessine rien : il marque les cases qui reçoivent le matériau planches. */
function emptyShapes(): Shape[] {
  return [];
}

const BUILDERS: Record<DecorType, (frame: Frame) => Shape[]> = {
  epave: epaveShapes,
  mat: matShapes,
  cordages: cordagesShapes,
  baril: barilShapes,
  caisse: caisseShapes,
  ancre: ancreShapes,
  chaine: chaineShapes,
  rocher: rocherShapes,
  algue: algueShapes,
  debris: debrisShapes,
  ponton: emptyShapes,
};

/** Décor plat posé au sol : il ne masque jamais un acteur, il reste dans la couche de sol. */
const GROUND_DECALS: ReadonlySet<DecorType> = new Set(["ponton", "algue", "debris", "cordages"]);

/** `true` pour un objet qui ne doit pas entrer dans le tri de profondeur des acteurs. */
export function isGroundDecal(type: DecorType): boolean {
  return GROUND_DECALS.has(type);
}

/** Formes procédurales d'un objet de décor, à l'échelle de la caméra. */
export function decorShapes(view: DecorView): Shape[] {
  return BUILDERS[view.type](frameOf(view.center, view.scale));
}
