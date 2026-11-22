import { migrateSave } from "./migrateSave";
import { stableStringify } from "./stableJson";
import type { SaveData, SaveResult } from "./types";

const EXPORT_INDENT = 2;

/** Exporte une sauvegarde dans un JSON lisible, réimportable tel quel. */
export function exportSaveJson(save: SaveData): string {
  return stableStringify(save, EXPORT_INDENT);
}

/** Importe un JSON exporté (migré si ancien), avec la même validation qu'une lecture. */
export function importSaveJson(raw: string): SaveResult {
  return migrateSave(raw);
}
