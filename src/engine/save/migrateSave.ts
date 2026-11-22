import { parseSaveJson, unknownVersionReason } from "./saveDiagnostics";
import { isPlainObject } from "./stableJson";
import { SAVE_ERROR_FUTURE_VERSION, SAVE_VERSION } from "./types";
import { validateSaveValue } from "./validateSaveValue";
import type { JsonRecord } from "./stableJson";
import type { SaveResult } from "./types";

type Migration = (raw: JsonRecord) => JsonRecord;

/**
 * Point d'extension des migrations : `MIGRATIONS[n]` transforme une sauvegarde
 * de version `n` en version `n + 1`. Vide tant que `SAVE_VERSION` vaut 1.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = {};

function readVersion(value: unknown): number | null {
  if (!isPlainObject(value)) return null;
  const version = value["saveVersion"];
  return typeof version === "number" ? version : null;
}

function isFutureVersion(version: number | null): version is number {
  return version !== null && version > SAVE_VERSION;
}

function futureVersionReason(version: number): string {
  return `${SAVE_ERROR_FUTURE_VERSION} : ${version} (supporté : ${SAVE_VERSION})`;
}

function migrateStep(raw: JsonRecord, version: number): SaveResult {
  const migration = MIGRATIONS[version];
  if (migration === undefined) return { ok: false, reason: unknownVersionReason(version) };
  return migrateToCurrent(migration(raw));
}

function migrateToCurrent(raw: unknown): SaveResult {
  const version = readVersion(raw);
  if (version === null || version >= SAVE_VERSION) return validateSaveValue(raw);
  return migrateStep(raw as JsonRecord, version);
}

/** Migre une sauvegarde vers le format courant, sans jamais jeter. */
export function migrateSave(raw: string): SaveResult {
  const parsed = parseSaveJson(raw);
  if (!parsed.ok) return parsed;
  const version = readVersion(parsed.value);
  if (isFutureVersion(version)) return { ok: false, reason: futureVersionReason(version) };
  return migrateToCurrent(parsed.value);
}
