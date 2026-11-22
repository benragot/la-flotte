import { SAVE_VERSION } from "./types";
import {
  SAVE_ERROR_INVALID_JSON,
  SAVE_ERROR_INVALID_SCHEMA,
  SAVE_ERROR_UNKNOWN_VERSION,
} from "./types";
import type { ParsedJson } from "./types";
import type { z } from "zod";

export function parseSaveJson(raw: string): ParsedJson {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, reason: SAVE_ERROR_INVALID_JSON };
  }
}

/** Détaille le premier problème de schéma pour faciliter le diagnostic. */
export function describeSchemaError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (issue === undefined) return SAVE_ERROR_INVALID_SCHEMA;
  const path = issue.path.length === 0 ? "racine" : issue.path.join(".");
  return `${SAVE_ERROR_INVALID_SCHEMA} (${path} : ${issue.message})`;
}

export function unknownVersionReason(version: number): string {
  return `${SAVE_ERROR_UNKNOWN_VERSION} : ${version} (supporté : ${SAVE_VERSION})`;
}
