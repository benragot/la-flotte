import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { Hero } from "../../src/engine/createHero";
import { createHero } from "../../src/engine/createHero";
import { gainXp } from "../../src/engine/hero";
import { combatantFromHero } from "../../src/engine/hero/combatant";
import { heroFromSnapshot, heroToSnapshot } from "../../src/engine/hero/snapshot";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { addItem, countItem, equipItem } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import { createSave, serializeSave } from "../../src/engine/save";
import type { StorageLike } from "../../src/engine/save";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { emptyInventory } from "../../src/store/gameSelectors";
import { useGameStore } from "../../src/store/useGameStore";

const SAVE_KEY = "la-flotte-test-slot";
const SAVED_AT = "2026-11-22T10:00:00.000Z";
const SET_PIECES = ["chapeau_piou_mazoute", "cape_graisseuse", "amulette_de_la_coupure", "bottes_de_fond_de_cale"];

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const sets = parseSetsYaml(read("sets.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const iop = (): ClassDef => mustFind(classes, "iop");

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

const levelTwoRewards = {
  xpGained: 120,
  totalXp: 120,
  level: 2,
  levelUp: { hp: 5, capitalPoints: 5, spellPoints: 1 },
  prospection: 100,
  drops: ["plume_mazoutee", "objet_fantome"],
};

function equipPieces(itemIds: readonly string[]): InventoryState {
  return itemIds.reduce(
    (inventory, itemId) => equipItem({ inventory, item: mustFind(items, itemId) }),
    emptyInventory(),
  );
}

function createHeroInStore(name = "Anselme"): Hero {
  useGameStore.getState().createCharacter({ name, classId: "iop" });
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros non créé");
  return hero;
}

function addToBag(itemId: string, quantity: number): void {
  useGameStore.setState((state) => ({
    inventory: addItem({ inventory: state.inventory, itemId, quantity }),
  }));
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.setState({ saveKey: SAVE_KEY });
});

describe("useGameStore — création de personnage", () => {
  it("crée un héros niveau 1 avec un sac et des drapeaux vides", () => {
    const hero = createHeroInStore();
    const state = useGameStore.getState();
    expect(hero.level).toBe(1);
    expect(hero.classId).toBe("iop");
    expect(hero.xp).toBe(0);
    expect(state.inventory).toEqual({ stacks: [], equipment: {} });
    expect(state.flags).toEqual({});
  });

  it("ignore une classe inconnue sans jeter", () => {
    useGameStore.getState().createCharacter({ name: "Fantôme", classId: "inconnue" });
    expect(useGameStore.getState().hero).toBeNull();
  });
});

describe("useGameStore — récompenses de combat", () => {
  it("crédite XP, niveau, points et butin sans toucher aux kamas", () => {
    createHeroInStore();
    useGameStore.getState().creditCombatRewards(levelTwoRewards);
    const { hero, inventory } = useGameStore.getState();
    expect(hero?.xp).toBe(120);
    expect(hero?.level).toBe(2);
    expect(hero?.kamas).toBe(0);
    expect(hero?.capitalPoints).toBe(5);
    expect(countItem(inventory, "plume_mazoutee")).toBe(1);
    expect(countItem(inventory, "objet_fantome")).toBe(0);
  });

  it("ignore les récompenses sans héros", () => {
    useGameStore.getState().creditCombatRewards(levelTwoRewards);
    expect(useGameStore.getState().hero).toBeNull();
  });
});

describe("useGameStore — points de capital", () => {
  it("investit des points gagnés dans la caractéristique demandée", () => {
    createHeroInStore();
    useGameStore.getState().creditCombatRewards(levelTwoRewards);
    useGameStore.getState().allocateStat({ stat: "strength", points: 3 });
    const { hero } = useGameStore.getState();
    expect(hero?.strength).toBe(3);
    expect(hero?.capitalPoints).toBe(2);
  });

  it("refuse silencieusement un investissement supérieur aux points disponibles", () => {
    const hero = createHeroInStore();
    useGameStore.getState().allocateStat({ stat: "strength", points: 1 });
    const after = useGameStore.getState().hero;
    expect(after).toBe(hero);
  });
});

describe("useGameStore — inventaire", () => {
  it("équipe puis déséquipe une pièce de panoplie", () => {
    createHeroInStore();
    addToBag("chapeau_piou_mazoute", 1);
    useGameStore.getState().equip({ itemId: "chapeau_piou_mazoute" });
    expect(useGameStore.getState().inventory.equipment.hat).toBe("chapeau_piou_mazoute");
    expect(countItem(useGameStore.getState().inventory, "chapeau_piou_mazoute")).toBe(0);
    useGameStore.getState().unequip({ slot: "hat" });
    expect(useGameStore.getState().inventory.equipment.hat).toBeUndefined();
    expect(countItem(useGameStore.getState().inventory, "chapeau_piou_mazoute")).toBe(1);
  });

  it("ignore un item inconnu du catalogue", () => {
    createHeroInStore();
    const before = useGameStore.getState().inventory;
    useGameStore.getState().equip({ itemId: "objet_fantome" });
    expect(useGameStore.getState().inventory).toBe(before);
  });
});

describe("useGameStore — consommables", () => {
  it("soigne sans dépasser les PV maximum et consomme une unité", () => {
    const hero = createHeroInStore();
    useGameStore.setState({ hero: { ...hero, hp: 40 } });
    addToBag("soupe_de_baleine_tiede", 2);
    useGameStore.getState().drinkConsumable({ itemId: "soupe_de_baleine_tiede" });
    const state = useGameStore.getState();
    expect(state.hero?.hp).toBe(50);
    expect(countItem(state.inventory, "soupe_de_baleine_tiede")).toBe(1);
  });

  it("ne consomme rien à PV plein", () => {
    createHeroInStore();
    addToBag("soupe_de_baleine_tiede", 1);
    const before = useGameStore.getState().inventory;
    useGameStore.getState().drinkConsumable({ itemId: "soupe_de_baleine_tiede" });
    expect(useGameStore.getState().hero?.hp).toBe(50);
    expect(useGameStore.getState().inventory).toBe(before);
  });
});

describe("useGameStore — sauvegarde", () => {
  it("sauvegarde puis relit un état identique", () => {
    createHeroInStore();
    useGameStore.setState({ flags: { quete_coupure: true } });
    addToBag("plume_mazoutee", 2);
    const storage = new MemoryStorage();
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    const before = useGameStore.getState();
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().hero).toBeNull();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const after = useGameStore.getState();
    expect(after.hero).toEqual(before.hero);
    expect(after.inventory).toEqual(before.inventory);
    expect(after.flags).toEqual(before.flags);
  });

  it("ignore les items et emplacements inconnus d'une sauvegarde", () => {
    const hero = createHeroInStore();
    const storage = new MemoryStorage();
    const options = { savedAt: SAVED_AT, flags: {}, hero: heroToSnapshot(hero) };
    const inventory = {
      stacks: [
        { itemId: "plume_mazoutee", quantity: 1 },
        { itemId: "objet_fantome", quantity: 3 },
      ],
      equipment: { hat: "chapeau_piou_mazoute", ring1: "anneau_fantome", gouffre: "x" },
    };
    storage.setItem(SAVE_KEY, serializeSave(createSave({ ...options, inventory })));
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    const loaded = useGameStore.getState().inventory;
    expect(loaded.stacks).toEqual([{ itemId: "plume_mazoutee", quantity: 1 }]);
    expect(loaded.equipment).toEqual({ hat: "chapeau_piou_mazoute" });
  });

  it("renvoie false sans héros ou sans stockage disponible", () => {
    expect(useGameStore.getState().saveGame()).toBe(false);
    createHeroInStore();
    expect(useGameStore.getState().saveGame()).toBe(false);
    expect(useGameStore.getState().loadGame()).toBe(false);
  });

  it("renvoie false quand le stockage refuse l'écriture", () => {
    createHeroInStore();
    expect(useGameStore.getState().saveGame(new FullStorage())).toBe(false);
  });

  it("exporte puis réimporte le même état", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 1);
    const exported = useGameStore.getState().exportJson();
    expect(exported).toBeTypeOf("string");
    const before = useGameStore.getState().hero;
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().importJson(exported ?? "")).toBe(true);
    expect(useGameStore.getState().hero).toEqual(before);
  });

  it("refuse un JSON invalide", () => {
    expect(useGameStore.getState().importJson("pas du json")).toBe(false);
    expect(useGameStore.getState().hero).toBeNull();
  });

  it("remet l'état de jeu à zéro", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 1);
    useGameStore.getState().resetGame();
    const state = useGameStore.getState();
    expect(state.hero).toBeNull();
    expect(state.inventory).toEqual({ stacks: [], equipment: {} });
    expect(state.flags).toEqual({});
  });
});

describe("hero — pont vers la sauvegarde et le combat", () => {
  it("fait l'aller-retour exact héros → snapshot → héros", () => {
    const base = createHero("Anselme", iop());
    const options = { hero: base, amount: 1500, gainRules: progression.gainRules };
    const hero = gainXp({ ...options, tiers: progression.xpThresholds, apRules: progression.apRules }).hero;
    expect(hero.level).toBe(4);
    expect(heroFromSnapshot(heroToSnapshot(hero), iop())).toEqual(hero);
  });

  it("somme caractéristiques, équipement et paliers de panoplie", () => {
    const hero = createHero("Anselme", iop());
    const inventory = equipPieces(SET_PIECES);
    expect(totalStatsFor({ hero, inventory, items, sets })).toMatchObject({
      ap: 1,
      strength: 10,
      vitality: 43,
      wisdom: 5,
      agility: 2,
      prospection: 15,
      flatRes: 5,
    });
  });

  it("dérive un combattant complet du héros équipé", () => {
    const hero = createHero("Anselme", iop());
    const inventory = equipPieces(SET_PIECES);
    const stats = totalStatsFor({ hero, inventory, items, sets });
    const spellIds = ["pression", "bond", "epee_du_destin"];
    const combatant = combatantFromHero({ hero, stats, position: { x: 3, y: 3 }, spellIds });
    expect(combatant).toMatchObject({
      id: "player",
      kind: "player",
      name: "Anselme",
      level: 1,
      hp: 50,
      maxHp: 50,
      ap: 7,
      maxAp: 7,
      mp: 3,
      maxMp: 3,
      pp: 115,
      accuracyPct: 0,
      position: { x: 3, y: 3 },
      spellIds,
      stats: { strength: 10, intelligence: 0, chance: 0, agility: 2, wisdom: 5 },
    });
    expect(combatant.resistances.flat.earth).toBe(0);
  });

  it("borne les PV courants aux PV maximum", () => {
    const hero = { ...createHero("Anselme", iop()), hp: 40 };
    const stats = totalStatsFor({ hero, inventory: emptyInventory(), items, sets });
    const combatant = combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds: [] });
    expect([combatant.hp, combatant.maxHp]).toEqual([40, 50]);
  });
});
