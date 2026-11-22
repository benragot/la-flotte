import { beforeEach, describe, expect, it } from "vitest";
import { addItem, countItem } from "../../src/engine/inventory";
import {
  MAX_CHARACTERS,
  SAVE_VERSION,
  createSave,
  loadFromStorage,
  migrateSave,
  serializeSave,
} from "../../src/engine/save";
import type { CharacterSnapshot, SaveInput, StorageLike } from "../../src/engine/save";
import { useGameStore } from "../../src/store/useGameStore";

const SAVE_KEY = "la-flotte-roster-slot";
const SAVED_AT = "2026-11-22T10:00:00.000Z";
const LEGACY_VERSION = 1;
const FIRST_MAP = "ile_de_la_coupure";
const SECOND_MAP = "port_de_la_coupure";

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

function heroSnapshot(name: string) {
  return {
    name,
    classId: "iop",
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

function character(id: string, name: string): CharacterSnapshot {
  return {
    id,
    hero: heroSnapshot(name),
    inventory: {
      stacks: [{ itemId: "potion_soin", quantity: 3 }],
      equipment: { amulet: "amulette_boueuse" },
    },
    position: { mapId: FIRST_MAP, x: 2, y: 5 },
  };
}

function makeInput(characters: CharacterSnapshot[]): SaveInput {
  return {
    savedAt: SAVED_AT,
    characters,
    bank: { stacks: [{ itemId: "ferraille_rouillee", quantity: 7 }], equipment: {} },
    flags: { donjon_boueux: true },
    lastPlayedCharacterId: characters[0]?.id ?? null,
  };
}

/** Ancienne sauvegarde v1 : un seul héros, coffre toléré en champ supplémentaire. */
function legacyRaw(): Record<string, unknown> {
  return {
    saveVersion: LEGACY_VERSION,
    savedAt: SAVED_AT,
    hero: heroSnapshot("Anselme"),
    inventory: {
      stacks: [
        { itemId: "potion_soin", quantity: 3 },
        { itemId: "plume_mazoutee", quantity: 2 },
      ],
      equipment: { amulet: "amulette_boueuse", ring1: "anneau_interdit" },
    },
    bank: { stacks: [{ itemId: "ferraille_rouillee", quantity: 9 }], equipment: {} },
    flags: { donjon_boueux: true, ile_coupure: false },
  };
}

function migratedLegacy() {
  const result = migrateSave(JSON.stringify(legacyRaw()));
  if (!result.ok) throw new Error(`migration refusée : ${result.reason}`);
  return result.save;
}

function firstCharacter(save: ReturnType<typeof migratedLegacy>): CharacterSnapshot {
  const [character] = save.characters;
  if (character === undefined) throw new Error("aucun personnage migré");
  return character;
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.setState({ saveKey: SAVE_KEY });
});

function createHero(name: string): string {
  useGameStore.getState().createCharacter({ name, classId: "iop" });
  const id = useGameStore.getState().activeCharacterId;
  if (id === null) throw new Error("personnage non créé");
  return id;
}

function addToBag(itemId: string, quantity: number): void {
  useGameStore.setState((state) => ({
    inventory: addItem({ inventory: state.inventory, itemId, quantity }),
  }));
}

describe("migration v1 → roster", () => {
  it("transforme l'ancien héros en premier personnage, identité identique", () => {
    const legacy = legacyRaw();
    const save = migratedLegacy();
    const migrated = firstCharacter(save);
    expect(save.saveVersion).toBe(SAVE_VERSION);
    expect(save.characters).toHaveLength(1);
    expect(migrated.hero).toEqual(legacy.hero);
    expect(migrated.hero.name).toBe("Anselme");
    expect(migrated.hero.classId).toBe("iop");
    expect(migrated.hero.level).toBe(12);
    expect(migrated.hero.stats).toEqual((legacy.hero as ReturnType<typeof heroSnapshot>).stats);
  });

  it("reprend progression, PV et kamas champ par champ", () => {
    const migrated = firstCharacter(migratedLegacy());
    expect(migrated.hero.xp).toBe(3400);
    expect(migrated.hero.kamas).toBe(1250);
    expect(migrated.hero.hp).toBe(92);
    expect(migrated.hero.maxHp).toBe(120);
    expect(migrated.hero.ap).toBe(6);
    expect(migrated.hero.mp).toBe(3);
    expect(migrated.hero.capitalPoints).toBe(4);
    expect(migrated.hero.spellPoints).toBe(2);
  });
});

describe("migration v1 → roster : inventaire et banque", () => {
  it("reprend l'inventaire complet, pièce illégale comprise, et la banque", () => {
    const legacy = legacyRaw();
    const migrated = firstCharacter(migratedLegacy());
    expect(migrated.inventory).toEqual(legacy.inventory);
    expect(migrated.inventory.stacks).toHaveLength(2);
    expect(migrated.inventory.equipment).toEqual({ amulet: "amulette_boueuse", ring1: "anneau_interdit" });
    expect(migratedLegacy().bank).toEqual(legacy.bank);
    expect(migratedLegacy().flags).toEqual(legacy.flags);
  });

  it("désigne le personnage migré comme dernier joué et sans position", () => {
    const save = migratedLegacy();
    const migrated = firstCharacter(save);
    expect(save.lastPlayedCharacterId).toBe(migrated.id);
    expect(migrated.position).toBeNull();
  });
});

describe("migration v1 → roster depuis le stockage", () => {
  it("migre une sauvegarde ancienne lue depuis le stockage", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify(legacyRaw()));
    const loaded = loadFromStorage({ storage, key: SAVE_KEY });
    expect(loaded.ok).toBe(true);
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(useGameStore.getState().hero?.name).toBe("Anselme");
  });
});

describe("cap dur à huit personnages", () => {
  it("accepte huit personnages", () => {
    const eight = Array.from({ length: MAX_CHARACTERS }, (_, index) =>
      character(`char-${index + 1}`, `Matelot ${index + 1}`),
    );
    expect(() => createSave(makeInput(eight))).not.toThrow();
  });

  it("lève au neuvième personnage au lieu de tronquer", () => {
    const eight = Array.from({ length: MAX_CHARACTERS }, (_, index) =>
      character(`char-${index + 1}`, `Matelot ${index + 1}`),
    );
    const nine = [...eight, character("char-9", "Neuvième")];
    expect(() => createSave(makeInput(nine))).toThrow();
  });

  it("lève aussi à la création du neuvième personnage dans le store", () => {
    Array.from({ length: MAX_CHARACTERS }, (_, index) => createHero(`Matelot ${index + 1}`));
    expect(() => createHero("Neuvième")).toThrow();
    expect(useGameStore.getState().characters).toHaveLength(MAX_CHARACTERS);
  });
});

describe("schéma strict", () => {
  it("refuse un champ inconnu dans un personnage", () => {
    const [base] = [character("char-1", "Anselme")];
    const polluted = { ...base, guilde: "La Flotte" } as unknown as CharacterSnapshot;
    expect(() => createSave(makeInput([polluted]))).toThrow();
  });
});

describe("idempotence", () => {
  it("relit deux fois un format courant sans re-migrer", () => {
    const input = makeInput([character("char-1", "Anselme"), character("char-2", "Gaspard")]);
    const raw = serializeSave(createSave(input));
    const first = migrateSave(raw);
    const second = migrateSave(raw);
    expect(first).toEqual(second);
    expect(first).toEqual({ ok: true, save: createSave(input) });
  });
});

describe("banque partagée entre personnages", () => {
  it("fait voir le même coffre au personnage suivant", () => {
    const anselme = createHero("Anselme");
    addToBag("plume_mazoutee", 3);
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 3 });
    const gaspard = createHero("Gaspard");
    const state = useGameStore.getState();
    expect(gaspard).not.toBe(anselme);
    expect(countItem(state.bank, "plume_mazoutee")).toBe(3);
    expect(countItem(state.inventory, "plume_mazoutee")).toBe(0);
    expect(useGameStore.getState().switchCharacter(anselme)).toBe(true);
    expect(countItem(useGameStore.getState().bank, "plume_mazoutee")).toBe(3);
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(0);
  });

  it("restaure le coffre sauvegardé sans dupliquer (anti-duplication)", () => {
    const storage = new MemoryStorage();
    createHero("Anselme");
    addToBag("plume_mazoutee", 6);
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 4 });
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    useGameStore.getState().withdrawFromBank({ itemId: "plume_mazoutee", quantity: 4 });
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(6);
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(2);
    expect(countItem(useGameStore.getState().bank, "plume_mazoutee")).toBe(4);
    useGameStore.getState().withdrawFromBank({ itemId: "plume_mazoutee", quantity: 4 });
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(6);
  });
});

describe("dernière position par personnage", () => {
  it("écrit et relit la position de chaque personnage sans effet au démarrage", () => {
    const storage = new MemoryStorage();
    const anselme = createHero("Anselme");
    useGameStore.getState().setLastPosition({ mapId: FIRST_MAP, x: 4, y: 7 });
    const gaspard = createHero("Gaspard");
    useGameStore.getState().setLastPosition({ mapId: SECOND_MAP, x: 1, y: 2 });
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const loaded = useGameStore.getState();
    expect(loaded.activeCharacterId).toBe(gaspard);
    expect(loaded.hero?.name).toBe("Gaspard");
    expect(loaded.lastPosition).toEqual({ mapId: SECOND_MAP, x: 1, y: 2 });
    expect(loaded.switchCharacter(anselme)).toBe(true);
    expect(useGameStore.getState().lastPosition).toEqual({ mapId: FIRST_MAP, x: 4, y: 7 });
  });

  it("relit deux fois la même sauvegarde avec le même roster", () => {
    const storage = new MemoryStorage();
    createHero("Anselme");
    createHero("Gaspard");
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const once = useGameStore.getState();
    const snapshot = { roster: once.characters, active: once.activeCharacterId, hero: once.hero };
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const twice = useGameStore.getState();
    expect({ roster: twice.characters, active: twice.activeCharacterId, hero: twice.hero }).toEqual(snapshot);
  });
});
