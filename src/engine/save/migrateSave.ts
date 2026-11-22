import { parseSaveJson, unknownVersionReason } from "./saveDiagnostics";
import { isPlainObject } from "./stableJson";
import { SAVE_ERROR_FUTURE_VERSION, SAVE_VERSION } from "./types";
import { validateSaveValue } from "./validateSaveValue";
import type { JsonRecord } from "./stableJson";
import type { SaveResult } from "./types";

type Migration = (raw: JsonRecord) => JsonRecord;

const FIRST_CHARACTER_ID = "char-1";
const ROSTER_FORMAT_VERSION = 2;

function emptyLegacyInventory(): JsonRecord {
  return { stacks: [], equipment: {} };
}

/** Le champ `bank` n'existait pas en v1 : s'il est là, il est repris tel quel. */
function legacyBank(raw: JsonRecord): unknown {
  const bank = raw["bank"];
  return isPlainObject(bank) ? bank : emptyLegacyInventory();
}

function legacyCharacter(raw: JsonRecord): JsonRecord {
  return { id: FIRST_CHARACTER_ID, hero: raw["hero"], inventory: raw["inventory"], position: null };
}

/** v1 (un héros) → v2 (roster) : le héros devient le premier personnage, sans perte. */
function migrateV1ToV2(raw: JsonRecord): JsonRecord {
  return {
    saveVersion: ROSTER_FORMAT_VERSION,
    savedAt: raw["savedAt"],
    characters: [legacyCharacter(raw)],
    bank: legacyBank(raw),
    flags: raw["flags"] ?? {},
    lastPlayedCharacterId: FIRST_CHARACTER_ID,
  };
}

/**
 * Point d'extension des migrations : `MIGRATIONS[n]` transforme une sauvegarde
 * de version `n` en version `n + 1`.
 */
const MIGRATIONS: Readonly<Record<number, Migration>> = { 1: migrateV1ToV2 };

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
