import { stableStringify } from "./stableJson";
import type { SaveData } from "./types";

/** Sérialise une sauvegarde en JSON compact, clés triées pour un diff stable. */
export function serializeSave(save: SaveData): string {
  return stableStringify(save, 0);
}
