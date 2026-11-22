import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { addItem } from "../../src/engine/inventory";
import type { StorageLike } from "../../src/engine/save";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { startNewGame, startNewGameIfConfirmed } from "../../src/store/newGame";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import { appScreen } from "../../src/ui/appRouting";
import { NewGameAccess, NewGameConfirmDialog } from "../../src/ui/components/NewGameButton";

const SAVE_KEY = "la-flotte-test-slot";
const SPELL_ID = "pression";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const recipes = parseRecipesYaml(read("recipes.yaml"));

const DUNGEON = dungeons[0];

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

function dungeonOrThrow() {
  if (DUNGEON === undefined) throw new Error("data/dungeons.yaml ne déclare aucun donjon");
  return DUNGEON;
}

function createHero(): void {
  useGameStore.getState().createCharacter({ name: "Balthazar", classId: "iop" });
}

/** La clef entre dans le sac par le chemin de production : `craftRecipe`. */
function stockKey(): void {
  const dungeon = dungeonOrThrow();
  const recipe = recipes.find((entry) => entry.resultItemId === dungeon.keyItemId);
  if (recipe === undefined) throw new Error("recette de clef absente de data/recipes.yaml");
  const inventory = recipe.ingredients.reduce(
    (current, ingredient) => addItem({ inventory: current, ...ingredient }),
    useGameStore.getState().inventory,
  );
  useGameStore.setState({ inventory });
  expect(useGameStore.getState().craftRecipe({ recipeId: recipe.id }).crafted).toBe(1);
}

/** Exploration + clic sur un groupe de monstres : 1vN engagé, pas seulement ouvert. */
function openExplorationCombat(): void {
  createHero();
  useCombatStore.getState().startExploration(() => 0);
  const [group] = useCombatStore.getState().exploration?.monsterGroups ?? [];
  if (group === undefined) throw new Error("aucun groupe de monstres sur la carte");
  useCombatStore.getState().clickCell(group.pos);
  useCombatStore.getState().selectSpell(SPELL_ID);
  useCombatStore.getState().setHoveredCell({ x: 1, y: 1 });
}

/** Run de donjon ouvert : `dungeonRun` et la salle 1 combattue par `battle`. */
function openDungeonRun(): void {
  createHero();
  stockKey();
  expect(useCombatStore.getState().enterDungeonRun({ dungeonId: dungeonOrThrow().id })).toBe(true);
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.setState({ saveKey: SAVE_KEY });
  useCombatStore.setState({
    battle: null,
    combat: null,
    mode: "exploration",
    exploration: null,
    activeGroup: null,
    dungeonRun: null,
    dungeonNotice: null,
    selectedSpellId: null,
    hoveredCell: null,
    rewards: null,
  });
});

describe("nouvelle partie — reset complet des deux stores", () => {
  it("remet tout à zéro après exploration, 1vN et sort sélectionné", () => {
    const gameInitial = useGameStore.getState();
    const combatInitial = useCombatStore.getState();
    const storage = new MemoryStorage();
    openExplorationCombat();
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    const dirty = useCombatStore.getState();
    expect([dirty.mode, dirty.combat, dirty.activeGroup]).not.toEqual([null, null, null]);
    startNewGame(storage);
    expect(useGameStore.getState()).toEqual(gameInitial);
    expect(useCombatStore.getState()).toEqual(combatInitial);
  });

  it("remet tout à zéro après un run de donjon et sa bataille de salle", () => {
    const gameInitial = useGameStore.getState();
    const combatInitial = useCombatStore.getState();
    const storage = new MemoryStorage();
    openDungeonRun();
    const dirty = useCombatStore.getState();
    expect(dirty.dungeonRun).not.toBeNull();
    expect(dirty.battle).not.toBeNull();
    startNewGame(storage);
    expect(useGameStore.getState()).toEqual(gameInitial);
    expect(useCombatStore.getState()).toEqual(combatInitial);
  });
});

describe("nouvelle partie — annulation", () => {
  it("ne touche à aucun des deux états quand la confirmation est refusée", () => {
    const storage = new MemoryStorage();
    openExplorationCombat();
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    const gameBefore = useGameStore.getState();
    const combatBefore = useCombatStore.getState();
    startNewGameIfConfirmed(false, storage);
    expect(useGameStore.getState()).toBe(gameBefore);
    expect(useCombatStore.getState()).toBe(combatBefore);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });
});

describe("nouvelle partie — la création redevient atteignable", () => {
  it("revient à l'écran de création puis crée un héros neuf", () => {
    openDungeonRun();
    startNewGame(new MemoryStorage());
    expect(appScreen(useGameStore.getState().hero !== null)).toBe("creation");
    createHero();
    const { hero, inventory } = useGameStore.getState();
    expect(appScreen(hero !== null)).toBe("arena");
    expect([hero?.level, hero?.xp, hero?.kamas]).toEqual([1, 0, 0]);
    expect(inventory).toEqual({ stacks: expect.any(Array), equipment: {} });
    expect(inventory.stacks.length).toBeGreaterThan(0);
  });
});

describe("nouvelle partie — sauvegarde effacée", () => {
  it("ne laisse aucune sauvegarde que `loadGame` pourrait ressusciter", () => {
    const storage = new MemoryStorage();
    openExplorationCombat();
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    startNewGame(storage);
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(useGameStore.getState().loadGame(storage)).toBe(false);
    expect(useGameStore.getState().hero).toBeNull();
  });
});

describe("nouvelle partie — markup et câblage", () => {
  it("expose un bouton visible et une confirmation destructrice annulable", () => {
    const access = renderToStaticMarkup(createElement(NewGameAccess, { onRequest: () => undefined }));
    expect(access).toContain("Nouvelle partie");
    expect(access).toContain("<button");
    const dialog = renderToStaticMarkup(
      createElement(NewGameConfirmDialog, { onConfirm: () => undefined, onCancel: () => undefined }),
    );
    expect(dialog).toContain('role="alertdialog"');
    expect(dialog).toContain("effacera ta progression non sauvegardée");
    expect(dialog).toContain("Continuer");
    expect(dialog).toContain("Annuler");
  });

  it("est branché sur la barre d'accès de l'arène, pas sur un raccourci secret", () => {
    const source = readFileSync(join(process.cwd(), "src/ui/components/OverlayPanels.tsx"), "utf8");
    expect(source).toContain("<NewGameButton");
  });
});
