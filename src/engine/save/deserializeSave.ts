import { parseSaveJson } from "./saveDiagnostics";
import { validateSaveValue } from "./validateSaveValue";
import type { SaveResult } from "./types";

/** Lit une sauvegarde brute sans jamais jeter. */
export function deserializeSave(raw: string): SaveResult {
  const parsed = parseSaveJson(raw);
  if (!parsed.ok) return parsed;
  return validateSaveValue(parsed.value);
}
