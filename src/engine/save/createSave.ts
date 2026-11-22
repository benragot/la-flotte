import { saveDataSchema } from "./saveSchema";
import { SAVE_VERSION } from "./types";
import type { SaveData, SaveInput } from "./types";

/**
 * Construit une sauvegarde validée. `savedAt` est injecté par l'appelant pour
 * rester déterministe ; `saveVersion` est toujours forcé au format courant.
 * Jette une `ZodError` si l'entrée est invalide (erreur de programmation).
 */
export function createSave(input: SaveInput): SaveData {
  return saveDataSchema.parse({ ...input, saveVersion: SAVE_VERSION });
}
