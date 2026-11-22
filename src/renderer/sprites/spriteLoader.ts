import { Assets, Rectangle, Texture } from "pixi.js";
import type { TextureSource } from "pixi.js";
import type { FrameRect } from "./frameMath";
import type { SheetPlan } from "./sheetPlan";
import { sheetPlan } from "./sheetPlan";
import type { SpriteSheetFrames, SpriteSheetSpec } from "./types";
import { SPRITE_ANIMATIONS } from "./types";

/** Une requête par feuille : le premier appel charge, les suivants réutilisent. */
const REQUESTS = new Map<string, Promise<SpriteSheetFrames | null>>();
/** Feuilles découpées, prêtes pour la création d'`AnimatedSprite`. */
const READY = new Map<string, SpriteSheetFrames>();
/** Feuilles définitivement indisponibles : on ne réessaie pas à chaque rendu. */
const FAILED = new Set<string>();
/** Feuilles dont la notification de fin de chargement a déjà été programmée. */
const NOTIFIED = new Set<string>();

/** Une texture par frame de l'animation, découpée aux dimensions réelles de la cellule. */
function sliceRow(source: TextureSource, rects: readonly FrameRect[]): Texture[] {
  return rects.map((rect) => new Texture({ source, frame: new Rectangle(rect.x, rect.y, rect.width, rect.height) }));
}

function sliceSheet(source: TextureSource, plan: SheetPlan): SpriteSheetFrames {
  const entries = SPRITE_ANIMATIONS.map((name) => [name, sliceRow(source, plan[name])] as const);
  return Object.fromEntries(entries) as SpriteSheetFrames;
}

async function loadSheet(spec: SpriteSheetSpec): Promise<SpriteSheetFrames> {
  const texture = await Assets.load<Texture>(spec.path);
  const frames = sliceSheet(texture.source, sheetPlan(spec));
  READY.set(spec.path, frames);
  return frames;
}

async function fetchSheet(spec: SpriteSheetSpec): Promise<SpriteSheetFrames | null> {
  try {
    return await loadSheet(spec);
  } catch {
    // Feuille absente ou illisible : le rendu retombe sur un jeton géométrique.
    FAILED.add(spec.path);
    return null;
  }
}

/**
 * Feuille découpée en 4 tableaux de textures, `null` si le chargement échoue
 * (jamais d'exception). Le découpage suit le manifeste (`row`, `frames`,
 * `frameWidth`, `frameHeight`) ; une `.png` de même géométrie passe sans
 * changement de code.
 */
export function loadSpriteSheet(spec: SpriteSheetSpec): Promise<SpriteSheetFrames | null> {
  const cached = REQUESTS.get(spec.path);
  if (cached !== undefined) return cached;
  const request = fetchSheet(spec);
  REQUESTS.set(spec.path, request);
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
export function ensureSpriteSheet(spec: SpriteSheetSpec, onReady: () => void): SpriteSheetFrames | null {
  const frames = peekSpriteSheet(spec.path);
  if (frames !== null || FAILED.has(spec.path)) return frames;
  if (!NOTIFIED.has(spec.path)) {
    NOTIFIED.add(spec.path);
    void loadSpriteSheet(spec).then(() => onReady());
  }
  return null;
}
