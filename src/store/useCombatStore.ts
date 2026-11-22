import { create } from "zustand";
import mapsYaml from "../../data/maps.yaml";
import monstersYaml from "../../data/monsters.yaml";
import progressionYaml from "../../data/progression.yaml";
import spellsYaml from "../../data/spells.yaml";
import { castSpell } from "../engine/combatLoop/cast";
import { initCombat } from "../engine/combatLoop/init";
import { moveActiveEntity } from "../engine/combatLoop/move";
import { resolveCombatRewards } from "../engine/combatLoop/rewards";
import { endPlayerTurn } from "../engine/combatLoop/turn";
import type { CombatantState, CombatRewards, CombatState } from "../engine/combatLoop/types";
import type { Hero } from "../engine/createHero";
import { createHero } from "../engine/createHero";
import { combatantFromHero } from "../engine/hero/combatant";
import { totalStatsFor } from "../engine/hero/totalStats";
import { parseAsciiMap } from "../engine/grid";
import type { AsciiMap, Position } from "../engine/grid";
import { mapsFileSchema } from "../schemas/mapSchema";
import { monstersFileSchema } from "../schemas/monsterSchema";
import { progressionFileSchema } from "../schemas/progressionSchema";
import type { ProgressionDef } from "../schemas/progressionSchema";
import { spellsFileSchema } from "../schemas/spellSchema";
import { GAME_CATALOG, useGameStore } from "./useGameStore";

interface CombatStore {
  combat: CombatState | null;
  mapId: string;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  rewards: CombatRewards | null;
  startDemoCombat: () => void;
  selectSpell: (spellId: string | null) => void;
  setHoveredCell: (pos: Position | null) => void;
  clickCell: (pos: Position) => void;
  endTurn: () => void;
}

const DEMO_HERO_NAME = "Balthazar";
const DEMO_CLASS_ID = "iop";
const DEMO_MAP_ID = "ferraille_plage_01";
const DEMO_MONSTER_ID = "piou_mazoute";

const maps = mapsFileSchema.parse(mapsYaml).maps;
const monsters = monstersFileSchema.parse(monstersYaml).monsters;
const spells = spellsFileSchema.parse(spellsYaml).spells;
const progression: ProgressionDef = progressionFileSchema.parse(progressionYaml);

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`Donnée introuvable: ${id}`);
  return found;
}

function demoMap(): AsciiMap {
  const def = mustFind(maps, DEMO_MAP_ID);
  return parseAsciiMap(def.grid);
}

/** Héros persistant, ou héros de démo créé à la volée pour ne rien casser. */
function demoHero(): Hero {
  const game = useGameStore.getState();
  if (game.hero === null) game.createCharacter({ name: DEMO_HERO_NAME, classId: DEMO_CLASS_ID });
  const { hero } = useGameStore.getState();
  return hero ?? createHero(DEMO_HERO_NAME, mustFind(GAME_CATALOG.classes, DEMO_CLASS_ID));
}

function playerFor(hero: Hero, position: Position): CombatantState {
  const { inventory } = useGameStore.getState();
  const stats = totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
  const spellIds = spells.filter((spell) => spell.classId === hero.classId).map((spell) => spell.id);
  return combatantFromHero({ hero, stats, position, spellIds });
}

function buildDemoCombat(): CombatState {
  const hero = demoHero();
  const monster = mustFind(monsters, DEMO_MONSTER_ID);
  const base = initCombat({ map: demoMap(), hero, monster, spells });
  return { ...base, player: playerFor(hero, base.player.position) };
}

function demoRewards(state: CombatState): CombatRewards {
  const monster = mustFind(monsters, DEMO_MONSTER_ID);
  const heroXp = useGameStore.getState().hero?.xp ?? 0;
  return resolveCombatRewards({ heroXp, hero: state.player, monster, progression, rng: Math.random });
}

/** Crédite la victoire au héros persistant ; un échec de sauvegarde est muet. */
function creditVictory(rewards: CombatRewards): void {
  const game = useGameStore.getState();
  game.creditCombatRewards(rewards);
  game.saveGame();
}

function castOrMove(state: CombatState, spellId: string | null, target: Position): CombatState {
  if (spellId === null) return moveActiveEntity(state, target);
  return castSpell({ state, spellId, target, rng: Math.random });
}

function stateUpdate(previous: CombatState, next: CombatState): Partial<CombatStore> {
  if (next === previous) return {};
  if (next.phase !== "victory") return { combat: next, selectedSpellId: null };
  const rewards = demoRewards(next);
  creditVictory(rewards);
  return { combat: next, rewards, selectedSpellId: null };
}

function clickUpdate(store: CombatStore, target: Position): Partial<CombatStore> {
  const combat = store.combat;
  if (combat === null) return {};
  return stateUpdate(combat, castOrMove(combat, store.selectedSpellId, target));
}

function endTurnUpdate(store: CombatStore): Partial<CombatStore> {
  const combat = store.combat;
  if (combat === null) return {};
  return stateUpdate(combat, endPlayerTurn(combat, Math.random));
}

const DEFAULT_STATE = {
  combat: null,
  mapId: DEMO_MAP_ID,
  selectedSpellId: null,
  hoveredCell: null,
  rewards: null,
} satisfies Omit<CombatStore, "startDemoCombat" | "selectSpell" | "setHoveredCell" | "clickCell" | "endTurn">;

function startDemoUpdate(): Partial<CombatStore> {
  return { combat: buildDemoCombat(), mapId: DEMO_MAP_ID, selectedSpellId: null, hoveredCell: null, rewards: null };
}

export const useCombatStore = create<CombatStore>((set) => ({
  ...DEFAULT_STATE,
  startDemoCombat: () => set(startDemoUpdate()),
  selectSpell: (spellId) => set({ selectedSpellId: spellId }),
  setHoveredCell: (hoveredCell) => set({ hoveredCell }),
  clickCell: (pos) => set((store) => clickUpdate(store, pos)),
  endTurn: () => set((store) => endTurnUpdate(store)),
}));

export type { CombatStore };
