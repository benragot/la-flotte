import spritesYaml from "../../data/sprites.yaml";
import { spritesFileSchema } from "../schemas/spriteSchema";
import type { SpriteSheetSpec } from "./sprites/types";

/**
 * Manifeste `data/sprites.yaml` validé une fois pour toutes.
 * C'est la couche de scène (et non `src/renderer/sprites/`) qui consomme les
 * données : les helpers de sprites restent purs, sans YAML ni `window`.
 */
export const SPRITE_SHEETS: readonly SpriteSheetSpec[] = spritesFileSchema.parse(spritesYaml).sprites;
