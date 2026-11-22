import spritesYaml from "../../data/sprites.yaml";
import { spritesFileSchema } from "../schemas/spriteSchema";
import type { SpriteSheetSpec } from "./sprites/types";

/**
 * Manifeste `data/sprites.yaml` validé une fois pour toutes.
 * C'est la couche de scène (et non `src/renderer/sprites/`) qui consomme les
 * données : les helpers de sprites restent purs, sans YAML ni `window`.
 */
export const SPRITE_SHEETS: readonly SpriteSheetSpec[] = spritesFileSchema.parse(spritesYaml).sprites;

const KNOWN_SPRITE_IDS = new Set(SPRITE_SHEETS.map((sheet) => sheet.entityId));

/**
 * `entityId` réellement présent au manifeste. C'est le seul chemin vers une
 * feuille : un id inconnu retombe explicitement sur le cercle de repli, jamais
 * par accident (le cas `null` est un fallback documenté, pas le défaut).
 */
export function knownSpriteId(candidate: string | null | undefined): string | null {
  if (candidate === null || candidate === undefined) return null;
  return KNOWN_SPRITE_IDS.has(candidate) ? candidate : null;
}
