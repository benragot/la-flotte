import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { computeProspection } from "../../src/engine/economy";
import { EQUIPMENT_SLOTS, parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { emptyInventory, inventoryFromSnapshot } from "../../src/store/gameSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

const SAVE_KEY = "la-flotte-test-slot";
const SAVED_AT = "2026-11-22T10:00:00.000Z";
const SET_PIECES = ["chapeau_piou_mazoute", "cape_graisseuse", "amulette_de_la_coupure", "bottes_de_fond_de_cale"];

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const sets = parseSetsYaml(read("sets.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));
const recipes = parseRecipesYaml(read("recipes.yaml"));

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

/** Ids du kit de départ, lus depuis le catalogue YAML (jamais en dur dans `src/`). */
function startingItemIds(): string[] {
  return items
    .filter((item) => item.category === "equipment" && item.starting)
    .map((item) => item.id);
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

/** Remplit le sac des ingrédients d'une recette du catalogue, `times` fois de suite. */
function stockIngredients(recipeId: string, times = 1): void {
  const recipe = mustFind(recipes, recipeId);
  recipe.ingredients.forEach(({ itemId, quantity }) => addToBag(itemId, quantity * times));
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.setState({ saveKey: SAVE_KEY });
  useCombatStore.setState({ combat: null, selectedSpellId: null, rewards: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useGameStore — création de personnage", () => {
  it("crée un héros niveau 1 avec des drapeaux vides", () => {
    const hero = createHeroInStore();
    const state = useGameStore.getState();
    expect(hero.level).toBe(1);
    expect(hero.classId).toBe("iop");
    expect(hero.xp).toBe(0);
    expect(state.flags).toEqual({});
  });

  it("sème dans le sac exactement les items marqués starting, quantité 1", () => {
    createHeroInStore();
    const startingIds = startingItemIds();
    const expected = startingIds.map((itemId) => ({ itemId, quantity: 1 }));
    expect(startingIds).toHaveLength(2);
    expect(useGameStore.getState().inventory).toEqual({ stacks: expected, equipment: {} });
  });

  it("équipe le gourdin du kit de départ et les stats totales suivent", () => {
    const hero = createHeroInStore();
    const before = totalStatsFor({ hero, inventory: useGameStore.getState().inventory, items, sets });
    useGameStore.getState().equip({ itemId: "gourdin_du_matelot" });
    const { inventory } = useGameStore.getState();
    expect(inventory.equipment.weapon).toBe("gourdin_du_matelot");
    expect(countItem(inventory, "gourdin_du_matelot")).toBe(0);
    const bonus = equipmentItem("gourdin_du_matelot").stats.strength ?? 0;
    const after = totalStatsFor({ hero, inventory, items, sets });
    expect(after.strength).toBe(before.strength + bonus);
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
  it("équipe puis déséquipe la pièce de panoplie du kit de départ", () => {
    createHeroInStore();
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

describe("useGameStore — persistance", () => {
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

});

describe("useGameStore — stockage indisponible", () => {
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

});

describe("useGameStore — export, import et remise à zéro", () => {
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

describe("useGameStore — coffre de banque : état initial", () => {
  it("démarre vide à la création puis après remise à zéro", () => {
    const empty = { stacks: [], equipment: {} };
    expect(useGameStore.getState().bank).toEqual(empty);
    createHeroInStore();
    expect(useGameStore.getState().bank).toEqual(empty);
    useGameStore.getState().depositToBank({ itemId: "chapeau_piou_mazoute", quantity: 1 });
    expect(countItem(useGameStore.getState().bank, "chapeau_piou_mazoute")).toBe(1);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().bank).toEqual(empty);
  });
});

describe("useGameStore — coffre de banque : dépôts", () => {
  it("déplace la quantité exacte du sac vers le coffre", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 3);
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 2 });
    const { inventory, bank } = useGameStore.getState();
    expect(countItem(inventory, "plume_mazoutee")).toBe(1);
    expect(countItem(bank, "plume_mazoutee")).toBe(2);
    expect(countItem(inventory, "gourdin_du_matelot")).toBe(1);
  });

  it("refuse un dépôt supérieur au stock sans toucher aux deux inventaires", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 1);
    const before = useGameStore.getState();
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 2 });
    const after = useGameStore.getState();
    expect(after.inventory).toBe(before.inventory);
    expect(after.bank).toBe(before.bank);
  });

  it("ignore un dépôt non strictement positif", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 1);
    const before = useGameStore.getState();
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 0 });
    expect(useGameStore.getState().inventory).toBe(before.inventory);
    expect(useGameStore.getState().bank).toBe(before.bank);
  });
});

describe("useGameStore — coffre de banque : gardes de quantité", () => {
  it("refuse une quantité NaN sans corrompre les piles", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 1);
    const before = useGameStore.getState();
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: Number.NaN });
    const after = useGameStore.getState();
    expect(after.inventory).toBe(before.inventory);
    expect(after.bank).toBe(before.bank);
  });

  it("refuse une quantité négative", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 3);
    const before = useGameStore.getState();
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: -3 });
    const after = useGameStore.getState();
    expect(after.inventory).toBe(before.inventory);
    expect(after.bank).toBe(before.bank);
  });
});

describe("useGameStore — coffre de banque : retraits", () => {
  it("retire du coffre vers le sac", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 3);
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 3 });
    useGameStore.getState().withdrawFromBank({ itemId: "plume_mazoutee", quantity: 2 });
    const { inventory, bank } = useGameStore.getState();
    expect(countItem(inventory, "plume_mazoutee")).toBe(2);
    expect(countItem(bank, "plume_mazoutee")).toBe(1);
  });

  it("refuse un retrait supérieur au contenu du coffre", () => {
    createHeroInStore();
    const before = useGameStore.getState();
    useGameStore.getState().withdrawFromBank({ itemId: "plume_mazoutee", quantity: 1 });
    const after = useGameStore.getState();
    expect(after.inventory).toBe(before.inventory);
    expect(after.bank).toBe(before.bank);
  });
});

describe("useGameStore — coffre de banque : invariants", () => {
  it("fait l'aller-retour dépôt puis retrait sans changer le sac", () => {
    createHeroInStore();
    addToBag("ferraille_rouillee", 2);
    const { inventory } = useGameStore.getState();
    useGameStore.getState().depositToBank({ itemId: "ferraille_rouillee", quantity: 2 });
    useGameStore.getState().withdrawFromBank({ itemId: "ferraille_rouillee", quantity: 2 });
    expect(useGameStore.getState().inventory).toEqual(inventory);
    expect(useGameStore.getState().bank).toEqual({ stacks: [], equipment: {} });
  });

  it("accepte les équipements comme les ressources, sans filtre", () => {
    createHeroInStore();
    useGameStore.getState().depositToBank({ itemId: "chapeau_piou_mazoute", quantity: 1 });
    expect(countItem(useGameStore.getState().bank, "chapeau_piou_mazoute")).toBe(1);
    expect(countItem(useGameStore.getState().inventory, "chapeau_piou_mazoute")).toBe(0);
  });
});

describe("useGameStore — coffre de banque : immuabilité", () => {
  it("ne mute pas l'inventaire d'entrée lors d'un dépôt", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 2);
    const previous = useGameStore.getState().inventory;
    const frozen = structuredClone(previous);
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 1 });
    expect(previous).toEqual(frozen);
  });

  it("ne mute pas le coffre d'entrée lors d'un retrait", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 2);
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 2 });
    const previous = useGameStore.getState().bank;
    const frozen = structuredClone(previous);
    useGameStore.getState().withdrawFromBank({ itemId: "plume_mazoutee", quantity: 1 });
    expect(previous).toEqual(frozen);
  });
});

describe("useGameStore — coffre de banque : sauvegarde", () => {
  it("vide le coffre à l'import d'une sauvegarde (anti-duplication)", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 10);
    const exported = useGameStore.getState().exportJson() ?? "";
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 10 });
    expect(countItem(useGameStore.getState().bank, "plume_mazoutee")).toBe(10);
    expect(useGameStore.getState().importJson(exported)).toBe(true);
    expect(countItem(useGameStore.getState().bank, "plume_mazoutee")).toBe(0);
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(10);
    useGameStore.getState().withdrawFromBank({ itemId: "plume_mazoutee", quantity: 10 });
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(10);
  });

  it("vide le coffre au chargement d'une sauvegarde", () => {
    createHeroInStore();
    addToBag("plume_mazoutee", 4);
    const storage = new MemoryStorage();
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    useGameStore.getState().depositToBank({ itemId: "plume_mazoutee", quantity: 4 });
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(useGameStore.getState().bank).toEqual({ stacks: [], equipment: {} });
    expect(countItem(useGameStore.getState().inventory, "plume_mazoutee")).toBe(4);
  });
});

describe("useGameStore — craft : catalogue connu", () => {
  it("connaît toutes les recettes du catalogue YAML", () => {
    const expected = recipes.map((recipe) => recipe.id).sort();
    expect([...useGameStore.getState().knownRecipeIds].sort()).toEqual(expected);
  });
});

describe("useGameStore — craft : fabrication", () => {
  it("fabrique une fois, consomme les ingrédients et ajoute le résultat", () => {
    const recipe = mustFind(recipes, "recette_boulon_ressoude");
    stockIngredients(recipe.id);
    const { crafted } = useGameStore.getState().craftRecipe({ recipeId: recipe.id });
    const { inventory } = useGameStore.getState();
    expect(crafted).toBe(1);
    expect(countItem(inventory, recipe.resultItemId)).toBe(recipe.resultQuantity);
    recipe.ingredients.forEach(({ itemId }) => expect(countItem(inventory, itemId)).toBe(0));
  });

  it("fabrique `times` fois quand le stock le permet", () => {
    const recipe = mustFind(recipes, "recette_boulon_ressoude");
    stockIngredients(recipe.id, 2);
    const result = useGameStore.getState().craftRecipe({ recipeId: recipe.id, times: 2 });
    const { inventory } = useGameStore.getState();
    expect(result.crafted).toBe(2);
    expect(countItem(inventory, recipe.resultItemId)).toBe(2 * recipe.resultQuantity);
  });

  it("ne mute pas l'inventaire d'entrée après un craft", () => {
    const recipe = mustFind(recipes, "recette_boulon_ressoude");
    stockIngredients(recipe.id);
    const previous = useGameStore.getState().inventory;
    const frozen = structuredClone(previous);
    useGameStore.getState().craftRecipe({ recipeId: recipe.id });
    expect(previous).toEqual(frozen);
  });
});

describe("useGameStore — craft : arrêt partiel", () => {
  it("s'arrête à la première fabrication quand le stock n'en permet qu'une", () => {
    const recipe = mustFind(recipes, "recette_boulon_ressoude");
    stockIngredients(recipe.id);
    const result = useGameStore.getState().craftRecipe({ recipeId: recipe.id, times: 2 });
    const { inventory } = useGameStore.getState();
    expect(result.crafted).toBe(1);
    expect(countItem(inventory, recipe.resultItemId)).toBe(recipe.resultQuantity);
    recipe.ingredients.forEach(({ itemId }) => expect(countItem(inventory, itemId)).toBe(0));
  });
});

describe("useGameStore — craft : refus", () => {
  it("s'arrête sans rien changer quand les ingrédients manquent", () => {
    const recipe = mustFind(recipes, "recette_boulon_ressoude");
    addToBag("ferraille_rouillee", 1);
    const before = useGameStore.getState().inventory;
    expect(useGameStore.getState().craftRecipe({ recipeId: recipe.id }).crafted).toBe(0);
    expect(useGameStore.getState().inventory).toBe(before);
  });

  it("ignore une recette absente du catalogue", () => {
    const before = useGameStore.getState().inventory;
    expect(useGameStore.getState().craftRecipe({ recipeId: "recette_fantome" }).crafted).toBe(0);
    expect(useGameStore.getState().inventory).toBe(before);
  });
});

describe("hero — snapshot de sauvegarde", () => {
  it("fait l'aller-retour exact héros → snapshot → héros", () => {
    const base = createHero("Anselme", iop());
    const options = { hero: base, amount: 1500, gainRules: progression.gainRules };
    const hero = gainXp({ ...options, tiers: progression.xpThresholds, apRules: progression.apRules }).hero;
    expect(hero.level).toBe(4);
    expect(heroFromSnapshot(heroToSnapshot(hero), iop())).toEqual(hero);
  });

});

describe("hero — statistiques totales", () => {
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

});

describe("hero — projection en combattant", () => {
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
      // 50 PV de base + 43 Vitalité des 4 pièces (5+10+8 objets, +20 panoplie) × 1 PV.
      hp: 93,
      maxHp: 93,
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

});

describe("hero — PV courants bornés", () => {
  it("borne les PV courants aux PV maximum", () => {
    const hero = { ...createHero("Anselme", iop()), hp: 40 };
    const stats = totalStatsFor({ hero, inventory: emptyInventory(), items, sets });
    const combatant = combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds: [] });
    expect([combatant.hp, combatant.maxHp]).toEqual([40, 50]);
  });
});

describe("inventaire — slots canoniques du schéma", () => {
  it("accepte chacun des slots du tuple EQUIPMENT_SLOTS", () => {
    const stacks = [{ itemId: "chapeau_piou_mazoute", quantity: 1 }];
    EQUIPMENT_SLOTS.forEach((slot) => {
      const equipment = { [slot]: "chapeau_piou_mazoute" };
      expect(inventoryFromSnapshot({ stacks, equipment }, items, 1).equipment).toEqual(equipment);
    });
  });

  it("rejette un slot absent du tuple et un item inconnu", () => {
    const equipment = { gouffre: "chapeau_piou_mazoute", hat: "objet_fantome" };
    expect(inventoryFromSnapshot({ stacks: [], equipment }, items, 1).equipment).toEqual({});
  });
});

describe("arène — câblage du héros persistant", () => {
  it("construit le joueur depuis le héros équipé, pas depuis le héros de démo", () => {
    createHeroInStore("Anselme");
    // Les pièces de panoplie sont niveau 2 : le héros doit l'être aussi pour les porter.
    useGameStore.getState().creditCombatRewards(levelTwoRewards);
    SET_PIECES.forEach((itemId) => {
      addToBag(itemId, 1);
      useGameStore.getState().equip({ itemId });
    });
    const hero = useGameStore.getState().hero;
    if (hero === null) throw new Error("héros attendu après création");
    useCombatStore.getState().startDemoCombat();
    const player = useCombatStore.getState().combat?.player;
    if (player === undefined) throw new Error("combat de démonstration attendu");
    expect(player.name).toBe("Anselme");
    expect(player.ap).toBe(hero.ap + 1);
    expect(player.maxHp).toBe(hero.maxHp + weaponHpBonus() + equipVitality());
    expect(player.pp).toBe(expectedProspection(hero));
  });
});

function equipmentItem(itemId: string) {
  const item = mustFind(items, itemId);
  if (item.category !== "equipment") throw new Error(`${itemId} n'est pas un équipement`);
  return item;
}

function weaponHpBonus(): number {
  const hp = SET_PIECES.map((itemId) => equipmentItem(itemId).stats.hp ?? 0);
  return hp.reduce((total, value) => total + value, 0);
}

/** Palier de panoplie actif avec les 4 pièces, tous rangs confondus. */
function setVitalityBonus(): number {
  const set = mustFind(sets, "panoplie_piou_mazoute");
  const active = set.bonuses.filter((bonus) => bonus.pieces <= SET_PIECES.length);
  return active.map((bonus) => bonus.stats.vitality ?? 0).reduce((total, value) => total + value, 0);
}

/** Vitalité des 4 pièces + panoplie : 1 point = 1 PV depuis D45. */
function equipVitality(): number {
  const pieces = SET_PIECES.map((itemId) => equipmentItem(itemId).stats.vitality ?? 0);
  return pieces.reduce((total, value) => total + value, setVitalityBonus());
}

function expectedProspection(hero: Hero): number {
  const amulet = equipmentItem("amulette_de_la_coupure");
  const set = mustFind(sets, "panoplie_piou_mazoute");
  const tier = set.bonuses.find((bonus) => bonus.pieces === 4);
  const bonusPp = (amulet.stats.prospection ?? 0) + (tier?.stats.prospection ?? 0);
  return computeProspection({ basePp: hero.pp, chance: hero.chance, bonusPp });
}

describe("sauvegarde — localStorage inaccessible", () => {
  it("renvoie false quand l'accès à window.localStorage jette", () => {
    createHeroInStore();
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("SecurityError: localStorage interdit");
      },
    });
    expect(() => useGameStore.getState().saveGame()).not.toThrow();
    expect(useGameStore.getState().saveGame()).toBe(false);
    expect(useGameStore.getState().loadGame()).toBe(false);
  });
});
