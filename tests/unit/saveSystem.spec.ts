import { beforeEach, describe, expect, it } from "vitest";
import {
  SAVE_ERROR_FUTURE_VERSION,
  SAVE_ERROR_INVALID_JSON,
  SAVE_ERROR_INVALID_SCHEMA,
  SAVE_ERROR_MISSING,
  SAVE_ERROR_UNKNOWN_VERSION,
  SAVE_VERSION,
  clearSave,
  createSave,
  deserializeSave,
  exportSaveJson,
  importSaveJson,
  loadFromStorage,
  migrateSave,
  saveToStorage,
  serializeSave,
} from "../../src/engine/save";
import type { SaveData, SaveResult, StorageLike } from "../../src/engine/save";

const SAVE_KEY = "la-flotte-save-slot-1";
const SAVED_AT = "2026-11-22T10:00:00.000Z";

type SaveInput = Omit<SaveData, "saveVersion">;

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

class FullStorage implements StorageLike {
  getItem(): string | null {
    return null;
  }

  setItem(): void {
    throw new Error("QuotaExceededError");
  }

  removeItem(): void {}
}

function makeInput(): SaveInput {
  return {
    savedAt: SAVED_AT,
    hero: {
      name: "Anselme",
      classId: "ecaflip",
      level: 12,
      xp: 3400,
      kamas: 1250,
      hp: 92,
      maxHp: 120,
      ap: 6,
      mp: 3,
      capitalPoints: 4,
      spellPoints: 2,
      stats: {
        vitality: 30,
        wisdom: 12,
        strength: 41,
        intelligence: 8,
        chance: 5,
        agility: 15,
      },
    },
    inventory: {
      stacks: [{ itemId: "potion_soin", quantity: 3 }],
      equipment: { amulet: "amulette_boueuse" },
    },
    flags: { donjon_boueux: true, ile_coupure: false },
  };
}

function makeSave(): SaveData {
  return createSave(makeInput());
}

function deserializeInput(mutator: (draft: SaveInput) => void): SaveResult {
  const draft = makeInput();
  mutator(draft);
  return deserializeSave(JSON.stringify({ ...draft, saveVersion: SAVE_VERSION }));
}

describe("createSave", () => {
  it("force la version de format et conserve savedAt fourni", () => {
    const save = makeSave();
    expect(save.saveVersion).toBe(SAVE_VERSION);
    expect(save.savedAt).toBe(SAVED_AT);
  });

  it("refuse une sauvegarde dont la date n'est pas ISO 8601", () => {
    const input = { ...makeInput(), savedAt: "hier soir" };
    expect(() => createSave(input)).toThrow();
  });
});

describe("serializeSave", () => {
  it("fait un aller-retour identique", () => {
    const save = makeSave();
    const result = deserializeSave(serializeSave(save));
    expect(result).toEqual({ ok: true, save });
  });

  it("sérialise de façon stable et trie les clés", () => {
    const save = makeSave();
    const first = serializeSave(save);
    const second = serializeSave(createSave(makeInput()));
    expect(first).toBe(second);
    expect(first.indexOf('"flags"')).toBeLessThan(first.indexOf('"saveVersion"'));
  });
});

describe("deserializeSave", () => {
  it("retourne ok:false sur un JSON invalide sans jeter", () => {
    const result = deserializeSave("{ pas du json");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_INVALID_JSON) });
  });

  it("refuse une version inconnue plus récente", () => {
    const raw = JSON.stringify({ ...makeInput(), saveVersion: 99 });
    const result = deserializeSave(raw);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_UNKNOWN_VERSION) });
  });
});

describe("deserializeSave — schéma invalide", () => {
  it("retourne ok:false quand le héros est absent", () => {
    const result = deserializeInput((draft) => {
      delete (draft as Partial<SaveInput>).hero;
    });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_INVALID_SCHEMA) });
  });

  it("retourne ok:false quand le niveau est négatif", () => {
    const result = deserializeInput((draft) => {
      draft.hero.level = -1;
    });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_INVALID_SCHEMA) });
  });

  it("retourne ok:false quand classId est vide", () => {
    const result = deserializeInput((draft) => {
      draft.hero.classId = "";
    });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_INVALID_SCHEMA) });
  });
});

describe("migrateSave", () => {
  it("accepte la version courante", () => {
    const save = makeSave();
    expect(migrateSave(serializeSave(save))).toEqual({ ok: true, save });
  });

  it("refuse explicitement une sauvegarde plus récente", () => {
    const raw = JSON.stringify({ ...makeInput(), saveVersion: 99 });
    const result = migrateSave(raw);
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_FUTURE_VERSION) });
  });

  it("propage l'erreur de JSON invalide", () => {
    const result = migrateSave("nope");
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_INVALID_JSON) });
  });
});

describe("stockage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("écrit puis relit une sauvegarde", () => {
    const save = makeSave();
    expect(saveToStorage({ storage, key: SAVE_KEY, save })).toBe(true);
    expect(loadFromStorage({ storage, key: SAVE_KEY })).toEqual({ ok: true, save });
  });

  it("distingue la clé absente d'une sauvegarde corrompue", () => {
    const missing = loadFromStorage({ storage, key: SAVE_KEY });
    expect(missing).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_MISSING) });
    storage.setItem(SAVE_KEY, "<html>");
    const corrupted = loadFromStorage({ storage, key: SAVE_KEY });
    expect(corrupted).toEqual({
      ok: false,
      reason: expect.stringContaining(SAVE_ERROR_INVALID_JSON),
    });
  });
});

describe("stockage — quota et effacement", () => {
  it("renvoie false quand le quota est dépassé sans jeter", () => {
    const full: StorageLike = new FullStorage();
    const save = makeSave();
    expect(() => saveToStorage({ storage: full, key: SAVE_KEY, save })).not.toThrow();
    expect(saveToStorage({ storage: full, key: SAVE_KEY, save })).toBe(false);
  });

  it("efface la sauvegarde", () => {
    const storage = new MemoryStorage();
    const save = makeSave();
    saveToStorage({ storage, key: SAVE_KEY, save });
    clearSave({ storage, key: SAVE_KEY });
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(loadFromStorage({ storage, key: SAVE_KEY })).toEqual({
      ok: false,
      reason: expect.stringContaining(SAVE_ERROR_MISSING),
    });
  });
});

describe("export / import JSON", () => {
  it("exporte en JSON indenté de deux espaces", () => {
    const exported = exportSaveJson(makeSave());
    expect(exported).toContain('\n  "');
    expect(JSON.parse(exported)).toEqual(makeSave());
  });

  it("réimporte un export à l'identique", () => {
    const save = makeSave();
    expect(importSaveJson(exportSaveJson(save))).toEqual({ ok: true, save });
  });

  it("refuse un import invalide sans jeter", () => {
    expect(importSaveJson("[]")).toEqual({
      ok: false,
      reason: expect.stringContaining(SAVE_ERROR_INVALID_SCHEMA),
    });
  });
});
