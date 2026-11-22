import { describeSchemaError, unknownVersionReason } from "./saveDiagnostics";
import { saveDataSchema } from "./saveSchema";
import { SAVE_VERSION } from "./types";
import type { SaveResult } from "./types";

/** Valide la forme d'une sauvegarde et vérifie qu'elle utilise le format courant. */
export function validateSaveValue(value: unknown): SaveResult {
  const parsed = saveDataSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reason: describeSchemaError(parsed.error) };
  if (parsed.data.saveVersion !== SAVE_VERSION) {
    return { ok: false, reason: unknownVersionReason(parsed.data.saveVersion) };
  }
  return { ok: true, save: parsed.data };
}
