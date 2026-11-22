/**
 * Découpeur pur des feuilles de sprites : format imposé 512 × 512,
 * grille 4 × 4 de cellules 128 × 128 (feuilles générées à 2×),
 * une ligne par animation. Aucune dépendance PixiJS ni DOM : testable en Node.
 */

/** Côté d'une cellule de feuille, en pixels : feuilles générées à 2×. */
export const SPRITE_FRAME_SIZE = 128;

/** Largeur affichée de référence, en px monde, d'une frame à l'échelle 1. */
export const SPRITE_DISPLAY_SIZE = 64;

/** Nombre de frames d'une animation, pour `animationFrames`. */
export interface AnimationCount {
  row: number;
  frames: number;
}

/** Une animation telle que la décrit le manifeste, avec la taille réelle de ses cellules. */
export interface AnimationLayout {
  row: number;
  frames: number;
  frameWidth: number;
  frameHeight: number;
}

/** Cellule source d'une frame dans la feuille. */
export interface FrameCell {
  row: number;
  column: number;
  frameWidth: number;
  frameHeight: number;
}

/** Rectangle `x, y, width, height` consommable par `new Texture({ frame })`. */
export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Rectangle source d'une cellule : `x = column × width`, `y = row × height`. */
export function frameRect(input: FrameCell): FrameRect {
  const { row, column, frameWidth, frameHeight } = input;
  return { x: column * frameWidth, y: row * frameHeight, width: frameWidth, height: frameHeight };
}

function columns(count: number): number[] {
  return Array.from({ length: count }, (_, column) => column);
}

/** Les `frames` rectangles d'une ligne, colonnes 0 à n-1, à la taille de cellule déclarée. */
export function animationRects(layout: AnimationLayout): FrameRect[] {
  return columns(layout.frames).map((column) => frameRect({ ...layout, column }));
}

/** Variante historique : cellules carrées au format de la feuille courante. */
export function animationFrames(animation: AnimationCount): FrameRect[] {
  return animationRects({ ...animation, frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE });
}

/**
 * Échelle Pixi d'un acteur : `frameWidth × displayScaleFor(...)` vaut toujours
 * `SPRITE_DISPLAY_SIZE × decorScale`. Passer la feuille à 2× ne double donc
 * jamais l'encombrement du personnage dans sa case.
 */
export function displayScaleFor(frameWidth: number, decorScale = 1): number {
  if (frameWidth <= 0) return decorScale;
  return (decorScale * SPRITE_DISPLAY_SIZE) / frameWidth;
}

/** Index borné circulairement : `-1` → dernière frame, `frames` → première. */
export function frameIndexAt(index: number, frames: number): number {
  const safe = Math.max(1, Math.trunc(frames));
  const remainder = Math.trunc(index) % safe;
  return remainder < 0 ? remainder + safe : remainder;
}

/** Rectangle de la frame `index` d'une animation, index bouclé modulo `frames`. */
export function frameAt(animation: AnimationCount, index: number): FrameRect {
  const frames = animationFrames(animation);
  const safe = frameIndexAt(index, frames.length);
  const rect = frames[safe];
  return rect ?? frameRect({ row: animation.row, column: 0, frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE });
}
