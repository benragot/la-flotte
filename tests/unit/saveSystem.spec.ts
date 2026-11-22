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

function makeHero() {
  return {
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
    stats: { vitality: 30, wisdom: 12, strength: 41, intelligence: 8, chance: 5, agility: 15 },
  };
}

function makeInput(): SaveInput {
  return {
    savedAt: SAVED_AT,
    characters: [
      {
        id: "char-1",
        hero: makeHero(),
        inventory: {
          stacks: [{ itemId: "potion_soin", quantity: 3 }],
          equipment: { amulet: "amulette_boueuse" },
        },
        position: { mapId: "ile_de_la_coupure", x: 2, y: 5 },
      },
    ],
    bank: { stacks: [], equipment: {} },
    flags: { donjon_boueux: true, ile_coupure: false },
    lastPlayedCharacterId: "char-1",
  };
}

/** Le premier personnage du brouillon, pour cibler les mutations de schéma. */
function firstCharacter(draft: SaveInput): SaveInput["characters"][number] {
  const [character] = draft.characters;
  if (character === undefined) throw new Error("personnage de test manquant");
  return character;
}

function makeSave(): SaveData {
  return createSave(makeInput());
}

function makeSaveWithStacks(itemIds: readonly string[]): SaveData {
  const input = makeInput();
  const stacks = itemIds.map((itemId) => ({ itemId, quantity: 1 }));
  const character = { ...firstCharacter(input), inventory: { equipment: {}, stacks } };
  return createSave({ ...input, characters: [character] });
}

function deserializeInput(mutator: (draft: SaveInput) => void): SaveResult {
  const draft = makeInput();
  mutator(draft);
  return deserializeSave(JSON.stringify({ ...draft, saveVersion: SAVE_VERSION }));
}

/** Personnage au sac/équipement inversés alphabétiquement : vérifie le tri profond. */
function makeNestedSave(): SaveData {
  const input = makeInput();
  const inventory = { stacks: [], equipment: { z_emplacement: "potion_soin", a_emplacement: "amulette_boueuse" } };
  const character = { ...firstCharacter(input), inventory };
  const flags = { z_derniere_ile: true, a_premier_donjon: false };
  return createSave({ ...input, flags, characters: [character] });
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

  it("préserve l'ordre des tableaux et trie les objets en profondeur", () => {
    const forward = serializeSave(makeSaveWithStacks(["potion_soin", "amulette_boueuse"]));
    const backward = serializeSave(makeSaveWithStacks(["amulette_boueuse", "potion_soin"]));
    expect(forward.indexOf('"potion_soin"')).toBeLessThan(forward.indexOf('"amulette_boueuse"'));
    expect(backward.indexOf('"amulette_boueuse"')).toBeLessThan(backward.indexOf('"potion_soin"'));
    const nested = makeNestedSave();
    const json = serializeSave(nested);
    expect(json.indexOf('"a_premier_donjon"')).toBeLessThan(json.indexOf('"z_derniere_ile"'));
    expect(json.indexOf('"a_emplacement"')).toBeLessThan(json.indexOf('"z_emplacement"'));
    expect(json.indexOf('"agility"')).toBeLessThan(json.indexOf('"wisdom"'));
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
  it("retourne ok:false quand le roster est absent", () => {
    const result = deserializeInput((draft) => {
      delete (draft as Partial<SaveInput>).characters;
    });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_INVALID_SCHEMA) });
  });

  it("retourne ok:false quand le niveau est négatif", () => {
    const result = deserializeInput((draft) => {
      firstCharacter(draft).hero.level = -1;
    });
    expect(result).toEqual({ ok: false, reason: expect.stringContaining(SAVE_ERROR_INVALID_SCHEMA) });
  });

  it("retourne ok:false quand classId est vide", () => {
    const result = deserializeInput((draft) => {
      firstCharacter(draft).hero.classId = "";
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
