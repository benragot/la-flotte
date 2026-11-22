import { Assets, Rectangle, Texture } from "pixi.js";
import type { TextureSource } from "pixi.js";
import { SPRITE_COLUMNS, animationFrames } from "./frameMath";
import type { SpriteSheetFrames } from "./types";
import { SPRITE_ANIMATIONS } from "./types";

/** Une requête par feuille : le premier appel charge, les suivants réutilisent. */
const REQUESTS = new Map<string, Promise<SpriteSheetFrames | null>>();
/** Feuilles découpées, prêtes pour la création d'`AnimatedSprite`. */
const READY = new Map<string, SpriteSheetFrames>();
/** Feuilles définitivement indisponibles : on ne réessaie pas à chaque rendu. */
const FAILED = new Set<string>();
/** Feuilles dont la notification de fin de chargement a déjà été programmée. */
const NOTIFIED = new Set<string>();

/**
 * Une ligne = une animation : l'index de `SPRITE_ANIMATIONS` est la ligne,
 * ce qui rend `loadSpriteSheet(path)` suffisant pour découper la feuille.
 */
function sliceRow(source: TextureSource, row: number): Texture[] {
  const frames = animationFrames({ row, frames: SPRITE_COLUMNS });
  return frames.map((frame) => new Texture({ source, frame: new Rectangle(frame.x, frame.y, frame.width, frame.height) }));
}

function sliceSheet(source: TextureSource): SpriteSheetFrames {
  const rows = SPRITE_ANIMATIONS.map((animation, row) => [animation, sliceRow(source, row)] as const);
  return Object.fromEntries(rows) as SpriteSheetFrames;
}

async function loadSheet(path: string): Promise<SpriteSheetFrames> {
  const texture = await Assets.load<Texture>(path);
  const frames = sliceSheet(texture.source);
  READY.set(path, frames);
  return frames;
}

async function fetchSheet(path: string): Promise<SpriteSheetFrames | null> {
  try {
    return await loadSheet(path);
  } catch {
    // Feuille absente ou illisible : le rendu retombe sur un jeton géométrique.
    FAILED.add(path);
    return null;
  }
}

/** Feuille découpée en 4 × `frames` textures, `null` si le chargement échoue (jamais d'exception). */
export function loadSpriteSheet(path: string): Promise<SpriteSheetFrames | null> {
  const cached = REQUESTS.get(path);
  if (cached !== undefined) return cached;
  const request = fetchSheet(path);
  REQUESTS.set(path, request);
  return request;
}

/** Lecture synchrone du cache : `null` tant que la feuille n'est pas prête (ou si elle a échoué). */
export function peekSpriteSheet(path: string): SpriteSheetFrames | null {
  return READY.get(path) ?? null;
}

/**
 * Demande le chargement si nécessaire et notifie `onReady` une seule fois,
 * succès comme échec : le caller redessine avec la feuille ou son repli.
 */
export function ensureSpriteSheet(path: string, onReady: () => void): SpriteSheetFrames | null {
  const frames = peekSpriteSheet(path);
  if (frames !== null || FAILED.has(path)) return frames;
  if (!NOTIFIED.has(path)) {
    NOTIFIED.add(path);
    void loadSpriteSheet(path).then(() => onReady());
  }
  return null;
}
