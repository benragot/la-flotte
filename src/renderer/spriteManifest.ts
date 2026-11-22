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

/** Suffixe d'instance du 1vN : `piou_mazoute-0`, `piou_mazoute-1`… */
const INSTANCE_SUFFIX = /-\d+$/;

/**
 * `entityId` réellement présent au manifeste. C'est le seul chemin vers une
 * feuille : un id inconnu retombe explicitement sur le cercle de repli, jamais
 * par accident (le cas `null` est un fallback documenté, pas le défaut).
 */
export function knownSpriteId(candidate: string | null | undefined): string | null {
  if (candidate === null || candidate === undefined) return null;
  return KNOWN_SPRITE_IDS.has(candidate) ? candidate : null;
}

/**
 * Feuille d'un combattant de salle. Les monstres du 1vN portent un suffixe
 * d'instance (`fer_rat_de_cale-0`) : sans cette résolution, chaque ennemi
 * tombait sur le cercle de repli et paraissait absent de la grille.
 */
export function resolveSpriteId(candidate: string | null | undefined): string | null {
  const exact = knownSpriteId(candidate);
  if (exact !== null || candidate === null || candidate === undefined) return exact;
  return knownSpriteId(candidate.replace(INSTANCE_SUFFIX, ""));
}
