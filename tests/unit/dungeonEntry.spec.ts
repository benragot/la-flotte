import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { addItem, countItem } from "../../src/engine/inventory";
import type { InventoryState } from "../../src/engine/inventory";
import { isDefeat, isVictory, livingOf } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import type { RecipeDef } from "../../src/schemas/recipeSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { castRefusal, spellCastSpec } from "../../src/store/battleSelectors";
import {
  canEnterDungeon,
  dungeonEntries,
  levelWarning,
} from "../../src/store/dungeonSelectors";
import { emptyInventory } from "../../src/store/gameSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import { closeBattle } from "../../src/ui/components/battle/closeBattle";
import {
  DungeonEntrySheet,
  DungeonNoticeLine,
} from "../../src/ui/components/dungeon";

/**
 * Vraies données : aucune grille, aucun monstre, aucune clef inventés. Le
 * premier donjon de `data/dungeons.yaml` est le sujet, sa clef et sa recette
 * viennent du même catalogue.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const recipes = parseRecipesYaml(read("recipes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));

const DUNGEON = mustFind(dungeons, "fer_donjon_casse_vis_sans_fin");
const KEY_NAME = mustFind(items, DUNGEON.keyItemId).name;
const DAMAGE_SPELL = mustFind(spells, "pression");
const CAST_SPEC = spellCastSpec(DAMAGE_SPELL, 0);
const MAX_ACTIONS = 300;
/**
 * Fixture de **câblage** (5000 PV / 200 force) : elle isole la mécanique
 * d'entrée/progression. **Un héros de niveau 16 réel perd les salles 3-4**
 * (dette **D71** : 41-43 dégâts subis par tour pour 3 tours de survie, contre
 * 12-13 tours nécessaires). Ces tests ne prouvent **pas** la viabilité du donjon.
 */
const TANK_HP = 5000;

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

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

function heroOrThrow() {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros absent");
  return hero;
}

/** Héros au-dessus du niveau recommandé, avec un capital de PV de test. */
function prepareHero(hp = TANK_HP): void {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter({ name: "Balthazar", classId: "iop" });
  const hero = heroOrThrow();
  useGameStore.setState({ hero: { ...hero, level: 20, hp, maxHp: hp, strength: 200 } });
}

function keyRecipe(): RecipeDef {
  const recipe = recipes.find((entry) => entry.resultItemId === DUNGEON.keyItemId);
  if (recipe === undefined) throw new Error("recette de clef absente de data/recipes.yaml");
  return recipe;
}

/** La clef entre dans le sac par le chemin de production : `craftRecipe`. */
function stockKey(): void {
  const recipe = keyRecipe();
  const inventory = recipe.ingredients.reduce(
    (current, ingredient) => addItem({ inventory: current, ...ingredient }),
    useGameStore.getState().inventory,
  );
  useGameStore.setState({ inventory });
  expect(useGameStore.getState().craftRecipe({ recipeId: recipe.id }).crafted).toBe(1);
}

function enter(): boolean {
  return useCombatStore.getState().enterDungeonRun({ dungeonId: DUNGEON.id });
}

function battleOrThrow(): BattleState {
  const { battle } = useCombatStore.getState();
  if (battle === null) throw new Error("battle absent");
  return battle;
}

function combatantIn(state: BattleState, id: string): CombatantLike {
  const found = state.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent du battle`);
  return found;
}

function battleHpOrNull(): number | null {
  const { battle } = useCombatStore.getState();
  return battle === null ? null : combatantIn(battle, "player").hp;
}

function roomEnemies(room: DungeonRoom): number {
  return room.monsters.reduce((total, group) => total + group.count, 0);
}

/** Cibles atteignables par le sort de dégâts du héros (même lecture que battleRange). */
function castableEnemies(state: BattleState): CombatantLike[] {
  return livingOf(state, "enemy").filter((enemy) => castRefusal(state, enemy.id, CAST_SPEC) === null);
}

function weakestEnemy(state: BattleState): CombatantLike | null {
  const rank = (best: CombatantLike | null, enemy: CombatantLike) =>
    best === null || enemy.hp < best.hp ? enemy : best;
  return castableEnemies(state).reduce<CombatantLike | null>(rank, null);
}

function castPhase(): void {
  const target = weakestEnemy(battleOrThrow());
  if (target === null) return;
  useCombatStore.getState().battleSpellAttack({ targetId: target.id, rng: () => 0.5 });
}

/** Joue la salle courante jusqu'à victoire ou défaite, borné par `MAX_ACTIONS`. */
function playToOutcome(storage?: StorageLike): number {
  let actions = 0;
  while (actions < MAX_ACTIONS && !isVictory(battleOrThrow()) && !isDefeat(battleOrThrow())) {
    castPhase();
    castPhase();
    useCombatStore.getState().playEnemyTurns({ rng: () => 0.5, storage });
    actions += 1;
  }
  return actions;
}

/** Clôture de salle identique au panneau : `closeBattle` puis report ou abandon. */
function closeRoom(storage?: StorageLike): void {
  const store = useCombatStore.getState();
  closeBattle(battleOrThrow(), {
    settle: () => store.settleDungeonRoom({ storage }),
    abandon: () => store.endBattle(),
  });
}

interface RoomStep {
  roomIndex: number;
  hpStart: number;
  hpEnd: number;
  hpNext: number | null;
  /** Maximum effectif de la salle : la base du soin de franchissement (DEC-03). */
  maxHp: number;
  actions: number;
}

/** Parcours par le chemin de production, salle après salle, sans reconstruire d'ids. */
function runDungeon(limit: number, storage?: StorageLike): RoomStep[] {
  expect(enter()).toBe(true);
  const steps: RoomStep[] = [];
  for (const room of DUNGEON.rooms.slice(0, limit)) {
    expect(useCombatStore.getState().dungeonRun?.roomIndex).toBe(room.roomNumber - 1);
    expect(livingOf(battleOrThrow(), "enemy").length).toBe(roomEnemies(room));
    steps.push(stepFor(room, storage));
  }
  return steps;
}

function stepFor(room: DungeonRoom, storage?: StorageLike): RoomStep {
  const player = combatantIn(battleOrThrow(), "player");
  const hpStart = player.hp;
  const actions = playToOutcome();
  const hpEnd = combatantIn(battleOrThrow(), "player").hp;
  closeRoom(storage);
  return { roomIndex: room.roomNumber - 1, hpStart, hpEnd, hpNext: battleHpOrNull(), maxHp: player.maxHp, actions };
}

function sheetMarkup(inventory: InventoryState, heroLevel: number, notice: string | null = null): string {
  const entries = dungeonEntries({ dungeons, items, inventory });
  const props = { entries, heroLevel, notice, onEnter: () => undefined, onClose: () => undefined };
  return renderToStaticMarkup(createElement(DungeonEntrySheet, props));
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useCombatStore.setState({
    battle: null,
    combat: null,
    mode: "exploration",
    exploration: null,
    dungeonRun: null,
    dungeonNotice: null,
  });
});

describe("dungeonEntry — le catalogue réel reste cohérent", () => {
  it("chaque salle référence une carte et des monstres de data/", () => {
    for (const room of DUNGEON.rooms) {
      expect(maps.some((map) => map.id === room.mapId)).toBe(true);
      for (const group of room.monsters) {
        expect(monsters.some((monster) => monster.id === group.monsterId)).toBe(true);
      }
    }
  });
});

describe("entrée sans clef — refus explicite, état intact", () => {
  it("ne démarre aucune bataille et rend l'inventaire par identité", () => {
    prepareHero();
    const inventory = useGameStore.getState().inventory;
    const hero = useGameStore.getState().hero;
    const snapshot = structuredClone(inventory);
    expect(enter()).toBe(false);
    const state = useCombatStore.getState();
    expect(state.battle).toBeNull();
    expect(state.dungeonRun).toBeNull();
    expect(state.dungeonNotice).toContain(DUNGEON.name);
    expect(useGameStore.getState().inventory).toBe(inventory);
    expect(useGameStore.getState().hero).toBe(hero);
    expect(useGameStore.getState().inventory).toEqual(snapshot);
  });
});

describe("entrée avec clef — consommée, salle 1 lancée", () => {
  it("retire exactement une clef et démarre la salle 1 du YAML", () => {
    prepareHero();
    stockKey();
    expect(countItem(useGameStore.getState().inventory, DUNGEON.keyItemId)).toBe(1);
    expect(enter()).toBe(true);
    expect(countItem(useGameStore.getState().inventory, DUNGEON.keyItemId)).toBe(0);
    const state = useCombatStore.getState();
    expect(state.dungeonRun).toMatchObject({ dungeonId: DUNGEON.id, roomIndex: 0, keysConsumed: 1 });
    const firstRoom = DUNGEON.rooms[0];
    if (firstRoom === undefined) throw new Error("salle 1 absente");
    expect(livingOf(battleOrThrow(), "enemy").length).toBe(roomEnemies(firstRoom));
    expect(combatantIn(battleOrThrow(), "player").hp).toBe(heroOrThrow().hp);
  });

  it("refuse une seconde entrée tant qu'un run est en cours", () => {
    prepareHero();
    stockKey();
    expect(enter()).toBe(true);
    expect(enter()).toBe(false);
    expect(countItem(useGameStore.getState().inventory, DUNGEON.keyItemId)).toBe(0);
  });
});

describe("progression — les 4 salles par le chemin de production", () => {
  it("enchaîne les salles vaincues jusqu'à la victoire de donjon", () => {
    prepareHero();
    stockKey();
    const steps = runDungeon(DUNGEON.rooms.length);
    const state = useCombatStore.getState();
    expect(steps.map((step) => step.roomIndex)).toEqual([0, 1, 2, 3]);
    steps.forEach((step) => {
      expect(step.actions).toBeGreaterThan(0);
      expect(step.actions).toBeLessThan(MAX_ACTIONS);
      expect(step.hpEnd).toBeLessThan(step.hpStart);
    });
    expect(state.dungeonRun).toBeNull();
    expect(state.battle).toBeNull();
    expect(state.dungeonNotice).toContain("Donjon terminé");
    expect(heroOrThrow().hp).toBeGreaterThan(0);
  });

  it("rend exactement ceil(max × ratio) de PV à chaque franchissement (DEC-03)", () => {
    prepareHero();
    stockKey();
    const steps = runDungeon(DUNGEON.rooms.length);
    steps.slice(1).forEach((step, index) => {
      const previous = steps[index];
      if (previous === undefined) throw new Error("salle précédente absente");
      const healed = Math.ceil(step.maxHp * DUNGEON.healBetweenRooms);
      expect(step.hpStart).toBe(Math.min(step.maxHp, previous.hpEnd + healed));
    });
  });
});

describe("rechargement en cours de donjon — aucun soin supplémentaire", () => {
  it("restaure exactement les PV du franchissement, jamais un second soin", () => {
    prepareHero();
    stockKey();
    const storage = new MemoryStorage();
    useGameStore.getState().saveGame(storage);
    const steps = runDungeon(1, storage);
    const crossing = steps[0];
    if (crossing === undefined) throw new Error("aucune salle jouée");
    const healed = heroOrThrow().hp;
    expect(healed).toBeGreaterThan(crossing.hpEnd);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBe(healed);
    expect(heroOrThrow().hp).toBeLessThanOrEqual(heroOrThrow().maxHp);
  });
});

describe("défaite — sortie propre, aucun 0 PV persisté", () => {
  it("quitte le donjon et sauvegarde un héros vivant", () => {
    prepareHero();
    stockKey();
    useGameStore.setState({ hero: { ...heroOrThrow(), hp: 5 } });
    const storage = new MemoryStorage();
    expect(enter()).toBe(true);
    playToOutcome(storage);
    expect(isDefeat(battleOrThrow())).toBe(true);
    closeRoom(storage);
    const state = useCombatStore.getState();
    expect(state.battle).toBeNull();
    expect(state.dungeonRun).toBeNull();
    expect(state.dungeonNotice).toContain("Donjon quitté");
    expect(heroOrThrow().hp).toBeGreaterThan(0);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBeGreaterThan(0);
  });
});

describe("panneau d'entrée — niveau recommandé et état de la clef", () => {
  it("affiche le niveau recommandé, le niveau du héros et la clef manquante", () => {
    const markup = sheetMarkup(emptyInventory(), 1);
    expect(markup).toContain(`Niveau recommandé ${DUNGEON.recommendedLevel}`);
    expect(markup).toContain("niveau 1");
    expect(markup).toContain(`Clef : ${KEY_NAME} — manquante`);
    expect(markup).toContain("Entrer");
  });

  it("avertit sous le niveau recommandé sans bloquer l'entrée (D67)", () => {
    const below = DUNGEON.recommendedLevel - 1;
    const markup = sheetMarkup(emptyInventory(), below);
    expect(levelWarning({ recommendedLevel: DUNGEON.recommendedLevel, heroLevel: below })).not.toBeNull();
    expect(markup).toContain("en dessous");
    expect(markup).toContain("Entrer");
  });

  it("marque la clef possédée quand le sac la contient", () => {
    const inventory = addItem({ inventory: emptyInventory(), itemId: DUNGEON.keyItemId, quantity: 1 });
    expect(sheetMarkup(inventory, DUNGEON.recommendedLevel)).toContain("possédée");
  });
});

describe("panneau d'entrée — hors contexte et accessibilité", () => {
  it("ne rend rien sans donjon disponible", () => {
    const props = { entries: [], heroLevel: 1, notice: null, onEnter: () => undefined, onClose: () => undefined };
    expect(renderToStaticMarkup(createElement(DungeonEntrySheet, props))).toBe("");
  });

  it("annonce les messages du donjon dans une région aria-live", () => {
    const markup = renderToStaticMarkup(createElement(DungeonNoticeLine, { notice: "Entrée dans la Casse." }));
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("Entrée dans la Casse.");
  });

  it("se ferme hors contexte : sans héros, run en cours, combat ou catalogue vide", () => {
    expect(canEnterDungeon({ hasHero: false, runActive: false, inCombat: false, dungeonCount: 1 })).toBe(false);
    expect(canEnterDungeon({ hasHero: true, runActive: true, inCombat: false, dungeonCount: 1 })).toBe(false);
    expect(canEnterDungeon({ hasHero: true, runActive: false, inCombat: true, dungeonCount: 1 })).toBe(false);
    expect(canEnterDungeon({ hasHero: true, runActive: false, inCombat: false, dungeonCount: 0 })).toBe(false);
    expect(canEnterDungeon({ hasHero: true, runActive: false, inCombat: false, dungeonCount: 1 })).toBe(true);
  });
});

describe("refus d'entrée — rendu dans la fiche, jamais derrière la nappe", () => {
  const REFUSAL = "Entrée refusée : il manque la clef.";
  const REFUSAL_BLOCK = 'aria-label="Refus d’entrée"';

  it("affiche le refus en role=alert sous la ligne de clef", () => {
    const markup = sheetMarkup(emptyInventory(), 1, REFUSAL);
    expect(markup).toContain(REFUSAL_BLOCK);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain(REFUSAL);
    expect(markup).toContain("bg-[#b83b3b]");
    expect(markup.indexOf("manquante")).toBeLessThan(markup.indexOf(REFUSAL));
  });

  it("ne rend aucun refus quand la notice est purgée", () => {
    expect(sheetMarkup(emptyInventory(), 1)).not.toContain(REFUSAL_BLOCK);
  });
});

describe("notice de donjon — purgée à l'ouverture et au succès", () => {
  it("clearDungeonNotice remet la notice à zéro", () => {
    useCombatStore.setState({ dungeonNotice: "vieux message" });
    useCombatStore.getState().clearDungeonNotice();
    expect(useCombatStore.getState().dungeonNotice).toBeNull();
  });

  it("une entrée réussie ne laisse aucun message périmé", () => {
    prepareHero();
    stockKey();
    useCombatStore.setState({ dungeonNotice: "vieux message" });
    expect(enter()).toBe(true);
    expect(useCombatStore.getState().dungeonNotice).toBeNull();
  });
});

describe("entrée interdite pendant un combat", () => {
  it("refuse l'entrée en 1v1 sans toucher au combat ni à l'inventaire", () => {
    prepareHero();
    stockKey();
    useCombatStore.getState().startDemoCombat();
    const combat = useCombatStore.getState().combat;
    const inventory = useGameStore.getState().inventory;
    expect(combat).not.toBeNull();
    expect(enter()).toBe(false);
    expect(useCombatStore.getState().combat).toBe(combat);
    expect(useCombatStore.getState().battle).toBeNull();
    expect(useGameStore.getState().inventory).toBe(inventory);
    expect(countItem(inventory, DUNGEON.keyItemId)).toBe(1);
    expect(useCombatStore.getState().dungeonNotice).toContain("combat");
  });
});

describe("panneau d'entrée — câblage dans l'exploration", () => {
  it("est branché sur l'écran d'exploration, pas caché", () => {
    const source = readFileSync(join(process.cwd(), "src/ui/components/OverlayPanels.tsx"), "utf8");
    expect(source).toContain("Donjons");
    expect(source).toContain("<DungeonEntryPanel");
    expect(source).toContain("<DungeonNotice");
    expect(source).toContain("combat en cours");
    expect(source).toContain("disabled");
    expect(source).toContain("clearDungeonNotice");
  });
});
