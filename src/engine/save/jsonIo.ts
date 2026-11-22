import { deserializeSave } from "./deserializeSave";
import { stableStringify } from "./stableJson";
import type { SaveData, SaveResult } from "./types";

const EXPORT_INDENT = 2;

/** Exporte une sauvegarde dans un JSON lisible, réimportable tel quel. */
export function exportSaveJson(save: SaveData): string {
  return stableStringify(save, EXPORT_INDENT);
}

/** Importe un JSON exporté, avec la même validation qu'une lecture de stockage. */
export function importSaveJson(raw: string): SaveResult {
  return deserializeSave(raw);
}
