import { create } from "zustand";
import mapsYaml from "../../data/maps.yaml";
import monstersYaml from "../../data/monsters.yaml";
import progressionYaml from "../../data/progression.yaml";
import spellsYaml from "../../data/spells.yaml";
import { castSpell } from "../engine/combatLoop/cast";
import { initCombat } from "../engine/combatLoop/init";
import { appendLog } from "../engine/combatLoop/log";
import { moveActiveEntity } from "../engine/combatLoop/move";
import { resolveCombatRewards } from "../engine/combatLoop/rewards";
import { endPlayerTurn } from "../engine/combatLoop/turn";
import type { CombatantState, CombatRewards, CombatState } from "../engine/combatLoop/types";
import type { Hero } from "../engine/createHero";
import { createHero } from "../engine/createHero";
import {
  defeatGroup,
  getMonsterGroupAt,
  initExploration,
  moveHeroOnMap,
  respawnMonsterGroup,
} from "../engine/exploration";
import type { ExplorationState, MonsterGroup, MonsterSpawn } from "../engine/exploration";
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

export type CombatMode = "exploration" | "combat";

interface CombatStore {
  combat: CombatState | null;
  /** Écran courant : exploration libre de la carte ou combat engagé. */
  mode: CombatMode;
  exploration: ExplorationState | null;
  /** Groupe à l'origine du combat courant, nécessaire au respawn. */
  activeGroup: MonsterGroup | null;
  mapId: string;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  rewards: CombatRewards | null;
  startDemoCombat: () => void;
  startExploration: () => void;
  returnToMap: () => void;
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

/** Spawn d'exploration dérivé du YAML : aucune donnée métier en dur. */
function explorationSpawn(): MonsterSpawn {
  const monster = mustFind(monsters, DEMO_MONSTER_ID);
  return { monsterId: monster.id, monsterName: monster.name, level: monster.level };
}

function playerFor(hero: Hero, position: Position): CombatantState {
  const { inventory } = useGameStore.getState();
  const stats = totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
  const spellIds = spells.filter((spell) => spell.classId === hero.classId).map((spell) => spell.id);
  return combatantFromHero({ hero, stats, position, spellIds });
}

function buildCombat(hero: Hero, monsterId: string): CombatState {
  const base = initCombat({ map: demoMap(), hero, monster: mustFind(monsters, monsterId), spells });
  return { ...base, player: playerFor(hero, base.player.position) };
}

function buildDemoCombat(): CombatState {
  return buildCombat(demoHero(), DEMO_MONSTER_ID);
}

function buildGroupCombat(group: MonsterGroup): CombatState {
  const monsterId = group.monsterIds[0] ?? DEMO_MONSTER_ID;
  const base = buildCombat(demoHero(), monsterId);
  return appendLog(base, `Le groupe ${group.id} entre en scène : ${group.monsterIds.join(", ")}.`);
}

function monsterIdFor(group: MonsterGroup | null): string {
  return group?.monsterIds[0] ?? DEMO_MONSTER_ID;
}

function rewardsFor(state: CombatState, group: MonsterGroup | null): CombatRewards {
  const monster = mustFind(monsters, monsterIdFor(group));
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

function stateUpdate(store: CombatStore, next: CombatState): Partial<CombatStore> {
  if (store.combat === next) return {};
  if (next.phase !== "victory") return { combat: next, selectedSpellId: null };
  const rewards = rewardsFor(next, store.activeGroup);
  creditVictory(rewards);
  return { combat: next, rewards, selectedSpellId: null };
}

function movedUpdate(exploration: ExplorationState, target: Position): Partial<CombatStore> {
  const { state } = moveHeroOnMap(exploration, target);
  if (state === exploration) return {};
  return { exploration: state, hoveredCell: null };
}

function explorationUpdate(store: CombatStore, target: Position): Partial<CombatStore> {
  const exploration = store.exploration;
  if (exploration === null) return {};
  const group = getMonsterGroupAt(exploration, target);
  if (group === null) return movedUpdate(exploration, target);
  const combatBase = { mode: "combat" as const, combat: buildGroupCombat(group), activeGroup: group };
  return { ...combatBase, rewards: null, selectedSpellId: null };
}

function clickUpdate(store: CombatStore, target: Position): Partial<CombatStore> {
  if (store.mode === "exploration") return explorationUpdate(store, target);
  if (store.combat === null) return {};
  return stateUpdate(store, castOrMove(store.combat, store.selectedSpellId, target));
}

function endTurnUpdate(store: CombatStore): Partial<CombatStore> {
  if (store.mode !== "combat" || store.combat === null) return {};
  return stateUpdate(store, endPlayerTurn(store.combat, Math.random));
}

function spawnForGroup(group: MonsterGroup | null): MonsterSpawn {
  const monster = monsters.find((entry) => entry.id === monsterIdFor(group));
  if (monster === undefined) return explorationSpawn();
  return { monsterId: monster.id, monsterName: monster.name, level: monster.level };
}

function groupId(group: MonsterGroup | null): string {
  return group?.id ?? "";
}

function returnUpdate(store: CombatStore): Partial<CombatStore> {
  const { exploration, activeGroup } = store;
  if (store.rewards === null || exploration === null) return {};
  const spawn = spawnForGroup(activeGroup);
  const defeated = defeatGroup(exploration, groupId(activeGroup));
  const next = respawnMonsterGroup({ state: defeated, spawn, rng: Math.random });
  const base = { mode: "exploration" as const, exploration: next, combat: null };
  return { ...base, rewards: null, activeGroup: null, selectedSpellId: null, hoveredCell: null };
}

const DEFAULT_STATE = {
  combat: null,
  mode: "exploration",
  exploration: null,
  activeGroup: null,
  mapId: DEMO_MAP_ID,
  selectedSpellId: null,
  hoveredCell: null,
  rewards: null,
} satisfies Omit<
  CombatStore,
  "startDemoCombat" | "startExploration" | "returnToMap" | "selectSpell" | "setHoveredCell" | "clickCell" | "endTurn"
>;

function demoUpdate(): Partial<CombatStore> {
  const base = { mode: "combat" as const, combat: buildDemoCombat(), activeGroup: null };
  return { ...base, mapId: DEMO_MAP_ID, selectedSpellId: null, hoveredCell: null, rewards: null };
}

function explorationStartUpdate(): Partial<CombatStore> {
  const exploration = initExploration({ map: demoMap(), ...explorationSpawn() });
  const base = { mode: "exploration" as const, exploration, combat: null, activeGroup: null };
  return { ...base, mapId: DEMO_MAP_ID, selectedSpellId: null, hoveredCell: null, rewards: null };
}

function endTurnAction(store: CombatStore): Partial<CombatStore> {
  if (store.mode !== "combat") return store;
  return endTurnUpdate(store);
}

export const useCombatStore = create<CombatStore>((set) => ({
  ...DEFAULT_STATE,
  startDemoCombat: () => set(demoUpdate()),
  startExploration: () => set(explorationStartUpdate()),
  returnToMap: () => set((store) => returnUpdate(store)),
  selectSpell: (spellId) => set({ selectedSpellId: spellId }),
  setHoveredCell: (hoveredCell) => set({ hoveredCell }),
  clickCell: (pos) => set((store) => clickUpdate(store, pos)),
  endTurn: () => set(endTurnAction),
}));

export type { CombatStore };
