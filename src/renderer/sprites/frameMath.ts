/**
 * Découpeur pur des feuilles de sprites : format imposé 256 × 256,
 * grille 4 × 4 de cellules 64 × 64 (une ligne par animation).
 * Aucune dépendance PixiJS ni DOM : testable en Node.
 */

/** Côté d'une cellule de feuille, en pixels. */
export const SPRITE_FRAME_SIZE = 64;
/** Nombre de colonnes (frames) par animation. */
export const SPRITE_COLUMNS = 4;

/** Nombre de frames d'une animation, pour `animationFrames`. */
export interface AnimationCount {
  row: number;
  frames: number;
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

/** Les `frames` rectangles d'une ligne, colonnes 0 à n-1. */
export function animationFrames(animation: AnimationCount): FrameRect[] {
  const size = { frameWidth: SPRITE_FRAME_SIZE, frameHeight: SPRITE_FRAME_SIZE };
  return columns(animation.frames).map((column) => frameRect({ ...animation, ...size, column }));
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
