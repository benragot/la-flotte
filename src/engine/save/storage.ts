import { migrateSave } from "./migrateSave";
import { serializeSave } from "./serializeSave";
import { SAVE_ERROR_MISSING } from "./types";
import type { SaveResult, SaveToStorageInput, StorageLocation } from "./types";

/** Écrit la sauvegarde ; renvoie `false` si le stockage refuse (quota, mode privé). */
export function saveToStorage(input: SaveToStorageInput): boolean {
  try {
    input.storage.setItem(input.key, serializeSave(input.save));
    return true;
  } catch {
    return false;
  }
}

/** Relit la sauvegarde ; migre un ancien format, distingue clé absente et contenu invalide. */
export function loadFromStorage(location: StorageLocation): SaveResult {
  const raw = location.storage.getItem(location.key);
  if (raw === null) return { ok: false, reason: SAVE_ERROR_MISSING };
  return migrateSave(raw);
}

export function clearSave(location: StorageLocation): void {
  location.storage.removeItem(location.key);
}
