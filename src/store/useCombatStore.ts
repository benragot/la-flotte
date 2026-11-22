import { create } from "zustand";
import type { StoreApi } from "zustand";
import mapsYaml from "../../data/maps.yaml";
import monstersYaml from "../../data/monsters.yaml";
import progressionYaml from "../../data/progression.yaml";
import spawnsYaml from "../../data/spawns.yaml";
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
  pickSpawn,
  respawnMonsterGroup,
} from "../engine/exploration";
import type { ExplorationState, MonsterGroup, MonsterSpawn, SpawnPick, SpawnZone } from "../engine/exploration";
import { attemptRoom, currentRoom, healBetweenRooms, isDungeonComplete, roomMonsters } from "../engine/dungeon";
import type { DungeonRoom, DungeonRunState, RoomHeal } from "../engine/dungeon";
import { heroBattleCombatant, setupDungeonBattle } from "../engine/dungeon/combatants";
import { combatantFromHero, heroHpFromCombat } from "../engine/hero/combatant";
import { totalStatsFor } from "../engine/hero/totalStats";
import { parseAsciiMap } from "../engine/grid";
import type { AsciiMap, Position } from "../engine/grid";
import { advanceTurn, buildTimeline, isDefeat, isVictory } from "../engine/multiCombat";
import { activeCombatant } from "../engine/multiCombat/timeline";
import type { AttackSpec, BattleState, CombatantLike, EnemyStrategy, RangeSpec, Rng } from "../engine/multiCombat";
import type { StorageLike } from "../engine/save";
import { mapsFileSchema } from "../schemas/mapSchema";
import { monstersFileSchema } from "../schemas/monsterSchema";
import type { MonsterDef } from "../schemas/monsterSchema";
import { progressionFileSchema } from "../schemas/progressionSchema";
import type { ProgressionDef } from "../schemas/progressionSchema";
import type { SpellDef } from "../schemas/spellSchema";
import { spellsFileSchema } from "../schemas/spellSchema";
import { spawnsFileSchema } from "../schemas/spawnSchema";
import type { DungeonDef } from "../schemas/dungeonSchema";
import {
  appendBattleLog,
  battleAttack as resolveBattleAttack,
  battleEnemyTurn as resolveBattleEnemyTurn,
  castRefusal,
  playEnemyTurns as resolveEnemyTurns,
  rollSpellBase,
  spellCastSpec,
  spellStrategy,
} from "./battleSelectors";
import { GAME_CATALOG, useGameStore } from "./useGameStore";
import { dungeonById, dungeonEntry, fallenMonsterIds } from "./dungeonSelectors";
import type { DungeonEntryOutcome } from "./dungeonSelectors";

export type CombatMode = "exploration" | "combat";

interface CombatStore {
  combat: CombatState | null;
  /**
   * NOUVEAU (5B) : combat 1vN de `multiCombat`, alimenté par les donjons.
   * Champ **additif** : `combat` reste la seule source du HUD et du canvas.
   */
  battle: BattleState | null;
  /** Écran courant : exploration libre de la carte ou combat engagé. */
  mode: CombatMode;
  exploration: ExplorationState | null;
  /** Groupe à l'origine du combat courant, nécessaire au respawn. */
  activeGroup: MonsterGroup | null;
  /** Run de donjon en cours (`null` hors donjon) : la clé est déjà consommée. */
  dungeonRun: DungeonRunState | null;
  /** Dernier message de donjon, annoncé par la région `aria-live` du panneau. */
  dungeonNotice: string | null;
  mapId: string;
  selectedSpellId: string | null;
  hoveredCell: Position | null;
  rewards: CombatRewards | null;
  startDemoCombat: () => void;
  /** Entrée en exploration : monstre tiré de `data/spawns.yaml` (rng injectable). */
  startExploration: (rng?: Rng) => void;
  returnToMap: () => void;
  selectSpell: (spellId: string | null) => void;
  setHoveredCell: (pos: Position | null) => void;
  clickCell: (pos: Position) => void;
  endTurn: () => void;
  startDungeonRoom: (input: { room: DungeonRoom }) => void;
  /**
   * NOUVEAU (5D-a) : entrée de donjon par le catalogue réel. Sans la clef, rien
   * n'est modifié (`false`) ; sinon la clef est consommée et la salle 1 démarre.
   * Refusée pendant un 1v1 ou une salle ouverte : les deux HUD ne cohabitent pas.
   */
  enterDungeonRun: (input: { dungeonId: string }) => boolean;
  /** Purge la notice périmée à l'ouverture du panneau ou après une entrée réussie. */
  clearDungeonNotice: () => void;
  /** `rng` injectable (défaut `Math.random`) pour des combats déterministes en test. */
  battleAttack: (input: { targetId: string; attack: AttackSpec; rng?: Rng }) => void;
  battleEnemyTurn: (input: { strategy: EnemyStrategy; rng?: Rng }) => void;
  /**
   * NOUVEAU (5C-c) : joue les tours ennemis jusqu'au retour de la main au
   * héros, avec les sorts réels des monstres (`data/spells.yaml`). Si le héros
   * tombe, aucun `hp: 0` n'est persisté (voir `restoreHeroHp`).
   */
  playEnemyTurns: (input?: { rng?: Rng; storage?: StorageLike }) => void;
  /** Fait tourner la timeline quand l'actif courant ne peut plus rien faire (aucun aléa). */
  advanceBattleTurn: () => void;
  /**
   * NOUVEAU (5C) : attaque 1vN du héros avec son sort de dégâts lu dans
   * `data/spells.yaml`. **Additif** : `battleAttack` reste l'API bas niveau, et
   * l'UI n'invente aucun chiffre de dégâts.
   */
  battleSpellAttack: (input: { targetId: string; rng?: Rng }) => void;
  /**
   * Clôt une salle **gagnée** : reporte les PV restants et applique le soin de
   * franchissement de `healBetweenRooms` (DEC-03) quand une salle suivante
   * existe. Refusée sur une défaite (D29) et idempotente sur un second clic ;
   * la sauvegarde est écrite si `storage` est fourni.
   */
  settleDungeonRoom: (input?: { storage?: StorageLike }) => void;
  endBattle: () => void;
  /**
   * NOUVEAU : remise à zéro complète demandée par « Nouvelle partie ». Les onze
   * champs de données reprennent leur valeur d'ouverture (aucun combat, aucun
   * run, aucune exploration, aucun sort ni case survolée). **Additif** : aucune
   * action existante ne change de comportement.
   */
  resetCombat: () => void;
}

const DEMO_HERO_NAME = "Balthazar";
const DEMO_CLASS_ID = "iop";
/** Placement de départ du héros en 1vN : le placement réel vient de `placeBattle`. */
const BATTLE_ORIGIN: Position = { x: 0, y: 0 };
/**
 * `rng() === 0` sélectionne la **première entrée** de la zone, pas la plus
 * lourde : c'est un tirage au sort, pas un tri par poids. L'ordre de
 * `data/spawns.yaml` est donc significatif et verrouillé par les tests data.
 */
const FIRST_ENTRY_RNG = () => 0;

const maps = mapsFileSchema.parse(mapsYaml).maps;
const monsters = monstersFileSchema.parse(monstersYaml).monsters;
const spells = spellsFileSchema.parse(spellsYaml).spells;
const spawnZones: readonly SpawnZone[] = spawnsFileSchema.parse(spawnsYaml).zones;
const progression: ProgressionDef = progressionFileSchema.parse(progressionYaml);

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`Donnée introuvable: ${id}`);
  return found;
}

/**
 * Carte de départ de la V1 : première entrée de `data/maps.yaml`, donc aucune
 * map nommée en dur ici. DETTE : le choix de zone par le joueur (5C) remplacera
 * cet ordre de fichier par une vraie sélection.
 */
function startMapId(): string {
  const first = maps[0];
  if (first === undefined) throw new Error("data/maps.yaml ne déclare aucune carte");
  return first.id;
}

function mapById(mapId: string): AsciiMap {
  return parseAsciiMap(mustFind(maps, mapId).grid);
}

/** Héros persistant, ou héros de démo créé à la volée pour ne rien casser. */
function demoHero(): Hero {
  const game = useGameStore.getState();
  if (game.hero === null) game.createCharacter({ name: DEMO_HERO_NAME, classId: DEMO_CLASS_ID });
  const { hero } = useGameStore.getState();
  return hero ?? createHero(DEMO_HERO_NAME, mustFind(GAME_CATALOG.classes, DEMO_CLASS_ID));
}

/** Spawn d'exploration dérivé du YAML : aucune donnée métier en dur. */
function spawnOf(monsterId: string): MonsterSpawn {
  const monster = mustFind(monsters, monsterId);
  return { monsterId: monster.id, monsterName: monster.name, level: monster.level };
}

/** Tirage pondéré de la zone de `mapId` ; repli sur la première zone sinon. */
function spawnPick(input: { mapId: string; rng?: Rng }): SpawnPick {
  return pickSpawn({ zones: spawnZones, mapId: input.mapId, rng: input.rng ?? Math.random });
}

/** Monstre de la première entrée de la zone de `mapId` : repli déterministe. */
function defaultSpawn(mapId: string): MonsterSpawn {
  return spawnOf(spawnPick({ mapId, rng: FIRST_ENTRY_RNG }).monsterId);
}

/** Zone absente : le joueur reste sur la carte, le repli est journalisé. */
function fallbackLog(state: ExplorationState, input: { mapId: string; zoneId: string }): ExplorationState {
  const note = `Aucune zone de spawn sur ${input.mapId} : repli sur ${input.zoneId}.`;
  return { ...state, log: [...state.log, note] };
}

function playerFor(hero: Hero, position: Position): CombatantState {
  const { inventory } = useGameStore.getState();
  const stats = totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
  const spellIds = spells.filter((spell) => spell.classId === hero.classId).map((spell) => spell.id);
  return combatantFromHero({ hero, stats, position, spellIds });
}

function buildCombat(input: { hero: Hero; monsterId: string; mapId: string }): CombatState {
  const monster = mustFind(monsters, input.monsterId);
  const base = initCombat({ map: mapById(input.mapId), hero: input.hero, monster, spells });
  return { ...base, player: playerFor(input.hero, base.player.position) };
}

function buildDemoCombat(mapId: string): CombatState {
  return buildCombat({ hero: demoHero(), monsterId: defaultSpawn(mapId).monsterId, mapId });
}

function buildGroupCombat(group: MonsterGroup, mapId: string): CombatState {
  const monsterId = group.monsterIds[0] ?? defaultSpawn(mapId).monsterId;
  const base = buildCombat({ hero: demoHero(), monsterId, mapId });
  return appendLog(base, `Le groupe ${group.id} entre en scène : ${group.monsterIds.join(", ")}.`);
}

function monsterIdFor(group: MonsterGroup | null, mapId: string): string {
  return group?.monsterIds[0] ?? defaultSpawn(mapId).monsterId;
}

function rewardsFor(state: CombatState, group: MonsterGroup | null, mapId: string): CombatRewards {
  const monster = mustFind(monsters, monsterIdFor(group, mapId));
  const heroXp = useGameStore.getState().hero?.xp ?? 0;
  return resolveCombatRewards({ heroXp, hero: state.player, monster, progression, rng: Math.random });
}

/** Crédite la victoire au héros persistant ; un échec de sauvegarde est muet. */
function creditVictory(rewards: CombatRewards): void {
  const game = useGameStore.getState();
  game.creditCombatRewards(rewards);
  game.saveGame();
}

function restoreHeroHp(storage?: StorageLike): void {
  const game = useGameStore.getState();
  if (game.hero === null) return;
  useGameStore.setState({ hero: { ...game.hero, hp: game.hero.maxHp } });
  game.saveGame(storage);
}

function castOrMove(state: CombatState, spellId: string | null, target: Position): CombatState {
  if (spellId === null) return moveActiveEntity(state, target);
  return castSpell({ state, spellId, target, rng: Math.random });
}

function stateUpdate(store: CombatStore, next: CombatState): Partial<CombatStore> {
  if (store.combat === next) return {};
  if (next.phase !== "victory") return { combat: next, selectedSpellId: null };
  const rewards = rewardsFor(next, store.activeGroup, store.mapId);
  creditVictory(rewards);
  return { combat: next, rewards, selectedSpellId: null };
}

/**
 * Clic sur une case sans chemin (mur, eau, hors carte) : sans cette ligne, le
 * joueur cliquait dans le vide et concluait « on peut pas bouger ».
 */
export const BLOCKED_MOVE_LOG = "Le chemin est bloqué : impossible d’aller là.";

function blockedUpdate(exploration: ExplorationState): Partial<CombatStore> {
  if (exploration.log.at(-1) === BLOCKED_MOVE_LOG) return {};
  return { exploration: { ...exploration, log: [...exploration.log, BLOCKED_MOVE_LOG] }, hoveredCell: null };
}

function movedUpdate(exploration: ExplorationState, target: Position): Partial<CombatStore> {
  const { state, path } = moveHeroOnMap(exploration, target);
  if (path.length === 0) return blockedUpdate(exploration);
  return { exploration: state, hoveredCell: null };
}

function explorationUpdate(store: CombatStore, target: Position): Partial<CombatStore> {
  const exploration = store.exploration;
  if (exploration === null) return {};
  const group = getMonsterGroupAt(exploration, target);
  if (group === null) return movedUpdate(exploration, target);
  const combatBase = { mode: "combat" as const, combat: buildGroupCombat(group, store.mapId), activeGroup: group };
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

function spawnForGroup(group: MonsterGroup | null, mapId: string): MonsterSpawn {
  return spawnOf(monsterIdFor(group, mapId));
}

function groupId(group: MonsterGroup | null): string {
  return group?.id ?? "";
}

function explorationReturn(exploration: ExplorationState | null): Partial<CombatStore> {
  const base = { mode: "exploration" as const, exploration, combat: null };
  return { ...base, rewards: null, activeGroup: null, selectedSpellId: null, hoveredCell: null };
}

function victoryReturn(store: CombatStore): Partial<CombatStore> {
  const { exploration, activeGroup } = store;
  if (exploration === null || store.rewards === null) return {};
  const defeated = defeatGroup(exploration, groupId(activeGroup));
  const spawn = spawnForGroup(activeGroup, store.mapId);
  return explorationReturn(respawnMonsterGroup({ state: defeated, spawn, rng: Math.random }));
}

/** Défaite : PV restaurés au max (D29) pour ne pas enchaîner sur un héros à 0 PV. */
function defeatReturn(store: CombatStore): Partial<CombatStore> {
  restoreHeroHp();
  return explorationReturn(store.exploration);
}

function returnUpdate(store: CombatStore): Partial<CombatStore> {
  const combat = store.combat;
  if (combat === null) return {};
  if (combat.phase === "victory") return victoryReturn(store);
  if (combat.phase !== "defeat") return {};
  return defeatReturn(store);
}

type RoomBattleGroup = { monster: MonsterDef; count: number };

function roomBattleMonsters(room: DungeonRoom): RoomBattleGroup[] {
  return roomMonsters(room).map((group) => ({ monster: mustFind(monsters, group.monsterId), count: group.count }));
}

/** Portée du sort de dégâts du héros : le panneau la lit dans le battle, pas ici. */
function battleRange(): RangeSpec | undefined {
  const spell = heroDamageSpell();
  if (spell === null) return undefined;
  return { min: spell.minRange, max: spell.maxRange, requiresLos: spell.requiresLos };
}

/** Battle d'une salle : la grille de `mapId` entre dans l'état et place les combattants. */
function battleFromRoom(room: DungeonRoom, opening: string | null = null): BattleState {
  const map = mapById(room.mapId);
  const hero = heroBattleCombatant({ combatant: playerFor(demoHero(), BATTLE_ORIGIN) });
  const { combatants } = setupDungeonBattle({ hero: { combatant: hero }, monsters: roomBattleMonsters(room), map });
  const log = opening === null ? [`Entrée dans ${room.name}`] : [opening, `Entrée dans ${room.name}`];
  const base = { turn: 1, ...buildTimeline(combatants), combatants, log, map };
  const castRange = battleRange();
  return castRange === undefined ? base : { ...base, castRange };
}

function battleUpdate(previous: BattleState | null, next: BattleState | null): Partial<CombatStore> {
  if (previous === next) return {};
  return { battle: next };
}

/** Sort de dégâts du héros, lu dans `data/spells.yaml` : l'UI n'invente aucun chiffre. */
function heroDamageSpell(): SpellDef | null {
  const classId = useGameStore.getState().hero?.classId;
  return spells.find((entry) => entry.classId === classId && entry.kind === "damage") ?? null;
}

/** Refus si ce n'est pas au camp du héros de jouer : la timeline reste maîtresse. */
function canCastHeroSpell(state: BattleState, spell: SpellDef | null): spell is SpellDef {
  return spell !== null && activeCombatant(state)?.side === "player";
}

/** Le refus géométrique est journalisé : le joueur voit pourquoi son clic ne fait rien. */
function castHeroSpell(state: BattleState, input: { targetId: string; rng?: Rng }, spell: SpellDef): BattleState {
  const rng = input.rng ?? Math.random;
  const attack = spellCastSpec(spell, rollSpellBase(spell, rng));
  const refusal = castRefusal(state, input.targetId, attack);
  if (refusal !== null) return appendBattleLog(state, refusal);
  return resolveBattleAttack({ state, targetId: input.targetId, attack, rng });
}

function spellAttackUpdate(store: CombatStore, input: { targetId: string; rng?: Rng }): Partial<CombatStore> {
  const state = store.battle;
  const spell = heroDamageSpell();
  if (state === null || !canCastHeroSpell(state, spell)) return {};
  return battleUpdate(state, castHeroSpell(state, input, spell));
}

/** Aucun `set` utile quand `resolveAttack` refuse le coup (même référence). */
function attackUpdate(
  store: CombatStore,
  input: { targetId: string; attack: AttackSpec; rng?: Rng },
): Partial<CombatStore> {
  const state = store.battle;
  if (state === null) return {};
  const options = { state, targetId: input.targetId, attack: input.attack, rng: input.rng ?? Math.random };
  return battleUpdate(state, resolveBattleAttack(options));
}

function enemyTurnUpdate(
  store: CombatStore,
  input: { strategy: EnemyStrategy; rng?: Rng },
): Partial<CombatStore> {
  const state = store.battle;
  if (state === null) return {};
  return battleUpdate(state, resolveBattleEnemyTurn({ state, strategy: input.strategy, rng: input.rng ?? Math.random }));
}

function advanceTurnUpdate(store: CombatStore): Partial<CombatStore> {
  const state = store.battle;
  if (state === null) return {};
  return battleUpdate(state, advanceTurn(state));
}

/** Sorts du combattant ennemi, résolus par id dans `data/spells.yaml`. */
function enemySpells(enemy: CombatantLike): SpellDef[] {
  const ids = enemy.spellIds ?? [];
  return ids.flatMap((id) => spells.filter((spell) => spell.id === id));
}

function strategyForEnemy(enemy: CombatantLike, rng: Rng): EnemyStrategy {
  return spellStrategy({ spells: enemySpells(enemy), rng });
}

function battleFinished(state: BattleState): boolean {
  return isDefeat(state) || isVictory(state);
}

function wonBattle(state: BattleState | null): state is BattleState {
  if (state === null) return false;
  return isVictory(state) && !isDefeat(state);
}

/** Les ennemis ripostent ; une défaite passe par `restoreHeroHp`, jamais par `hp: 0`. */
function playEnemyTurnsUpdate(store: CombatStore, rng: Rng, storage?: StorageLike): Partial<CombatStore> {
  const state = store.battle;
  if (state === null) return {};
  if (battleFinished(state)) return {};
  const strategyFor = (enemy: CombatantLike) => strategyForEnemy(enemy, rng);
  const next = resolveEnemyTurns({ state, strategyFor, rng });
  if (isDefeat(next)) restoreHeroHp(storage);
  return battleUpdate(state, next);
}

function heroStatsFor(hero: Hero) {
  const { inventory } = useGameStore.getState();
  return totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}

/**
 * Reporte les PV du combat (domaine effectif) vers le héros persisté (domaine
 * de niveau), sans soin : le bonus d'objets/Vitalité est retiré, puis le
 * maximum de niveau borne. `hpPool` le rajoute à la salle suivante.
 */
function carryOverBattleHp(hp: number): void {
  const game = useGameStore.getState();
  if (game.hero === null) return;
  const levelHp = heroHpFromCombat(hp, game.hero, heroStatsFor(game.hero));
  useGameStore.setState({ hero: { ...game.hero, hp: levelHp } });
}

/** Pool EFFECTIF du héros dans la salle : le seul que le soin de franchissement lit. */
interface HeroPool {
  hp: number;
  maxHp: number;
}

interface WonRoom {
  state: BattleState;
  pool: HeroPool;
}

function battleHeroPool(state: BattleState): HeroPool | null {
  const player = state.combatants.find((entry) => entry.side === "player");
  return player === undefined ? null : { hp: player.hp, maxHp: player.maxHp };
}

/** Salle gagnée ET pool lisible : les deux préconditions du report et du soin. */
function wonRoom(state: BattleState | null): WonRoom | null {
  if (!wonBattle(state)) return null;
  const pool = battleHeroPool(state);
  return pool === null ? null : { state, pool };
}

/**
 * DEC-03 : soin uniquement au franchissement d'une salle — jamais à l'entrée du
 * donjon, en cours de salle, après la dernière salle, ni au rechargement. Le
 * ratio est une donnée du donjon (`healBetweenRooms`), pas une constante.
 */
function crossingHeal(advance: RoomAdvance | null, pool: HeroPool): RoomHeal {
  if (advance === null || !advance.cleared || advance.complete) return { hp: pool.hp, healed: 0 };
  return healBetweenRooms({ ...pool, ratio: advance.dungeon.healBetweenRooms });
}

/** Ligne de journal du franchissement : dit ce qui se passe ET combien est rendu. */
function healLine(healed: number): string | null {
  if (healed <= 0) return null;
  return `Le quartier-maître réquisitionne une lampée de tafia : ${healed} PV repris avant la salle suivante.`;
}

const ROOM_REFUSED = "La salle n'est pas nettoyée : le donjon reste ouvert.";
const DUNGEON_LEFT = "Donjon quitté : la salle reste aux monstres.";
const UNKNOWN_DUNGEON = "Donjon inconnu.";
const COMBAT_REFUSED = "Entrée refusée : termine le combat en cours d'abord.";

interface RoomAdvance {
  run: DungeonRunState;
  dungeon: DungeonDef;
  cleared: boolean;
  complete: boolean;
}

/** Valide la salle avec les vaincus **lus dans le battle**, puis mesure l'avancement. */
function attemptCurrentRoom(store: CombatStore, state: BattleState): RoomAdvance | null {
  const run = store.dungeonRun;
  if (run === null) return null;
  const dungeon = dungeonById(run.dungeonId);
  if (dungeon === null) return null;
  const attempt = attemptRoom({ run, dungeon, defeatedMonsterIds: fallenMonsterIds(state) });
  return { run: attempt.run, dungeon, cleared: attempt.cleared, complete: isDungeonComplete(attempt.run, dungeon) };
}

/** Battle de la salle courante, `null` quand le run est terminé. */
function roomBattleAt(run: DungeonRunState, dungeon: DungeonDef, opening: string | null = null): BattleState | null {
  const room = currentRoom(run, dungeon);
  return room === null ? null : battleFromRoom(room, opening);
}

function nextRoomNotice(run: DungeonRunState, dungeon: DungeonDef): string {
  const room = currentRoom(run, dungeon);
  return room === null ? DUNGEON_LEFT : `Salle gagnée. La suivante t'attend : ${room.name}.`;
}

/** Progression : salle suivante, refus ou victoire de donjon (message + sortie). */
function progressedUpdate(advance: RoomAdvance | null, opening: string | null): Partial<CombatStore> {
  if (advance === null) return { battle: null };
  if (!advance.cleared) return { battle: null, dungeonRun: advance.run, dungeonNotice: ROOM_REFUSED };
  if (advance.complete) return { battle: null, dungeonRun: null, dungeonNotice: `Donjon terminé : ${advance.dungeon.name}.` };
  const battle = roomBattleAt(advance.run, advance.dungeon, opening);
  return { battle, dungeonRun: advance.run, dungeonNotice: nextRoomNotice(advance.run, advance.dungeon) };
}

/**
 * Salle gagnée : les PV effectifs sont soignés du ratio du donjon (DEC-03), puis
 * reportés dans le domaine de niveau, la sauvegarde est écrite, et la salle
 * suivante démarre (ou le donjon se ferme). Une défaite est refusée ici :
 * c'est `endBattle` qui sort proprement (D44). Un second clic ne peut pas
 * soigner deux fois : `wonBattle` est faux dès que la salle suivante est ouverte.
 */
function settleUpdate(store: CombatStore, storage?: StorageLike): Partial<CombatStore> {
  const won = wonRoom(store.battle);
  if (won === null) return {};
  const advance = attemptCurrentRoom(store, won.state);
  const crossing = crossingHeal(advance, won.pool);
  carryOverBattleHp(crossing.hp);
  useGameStore.getState().saveGame(storage);
  return progressedUpdate(advance, healLine(crossing.healed));
}

/** Sortie du donjon (défaite ou abandon) : le run est oublié, aucun 0 PV persisté. */
function endBattleUpdate(store: CombatStore): Partial<CombatStore> {
  if (store.dungeonRun === null) return { battle: null };
  return { battle: null, dungeonRun: null, dungeonNotice: DUNGEON_LEFT };
}

/** Refus d'entrée lisible : le nom du donjon vient du YAML, la clef aussi. */
function keyRefusal(dungeon: DungeonDef): string {
  return `Entrée refusée : il manque la clef de ${dungeon.name}.`;
}

/** Entrée acceptée : la clef est déjà consommée par `dungeonEntry`, la salle 1 démarre. */
function startedRunUpdate(outcome: DungeonEntryOutcome): Partial<CombatStore> {
  const { dungeon, result } = outcome;
  if (result.run === null) return { dungeonNotice: keyRefusal(dungeon) };
  useGameStore.setState({ inventory: result.inventory });
  const battle = roomBattleAt(result.run, dungeon);
  return { dungeonRun: result.run, battle, dungeonNotice: null };
}

/** Un 1v1 ou une salle de donjon déjà ouverte interdit l'entrée. */
function inLiveCombat(store: CombatStore): boolean {
  return store.combat !== null || store.battle !== null;
}

/** Entrée : catalogue déjà parsé, aucun id de donjon ni de clef écrit ici. */
function enterUpdate(store: CombatStore, input: { dungeonId: string }): Partial<CombatStore> {
  if (store.dungeonRun !== null) return {};
  if (inLiveCombat(store)) return { dungeonNotice: COMBAT_REFUSED };
  const inventory = useGameStore.getState().inventory;
  const outcome = dungeonEntry({ dungeonId: input.dungeonId, inventory });
  return outcome === null ? { dungeonNotice: UNKNOWN_DUNGEON } : startedRunUpdate(outcome);
}

type StoreSetter = StoreApi<CombatStore>["setState"];

type MapActions = Pick<
  CombatStore,
  "startDemoCombat" | "startExploration" | "returnToMap" | "selectSpell" | "setHoveredCell" | "clickCell" | "endTurn"
>;

function mapStartActions(set: StoreSetter) {
  return {
    startDemoCombat: () => set((store) => demoUpdate(store.mapId)),
    startExploration: (rng?: Rng) => set((store) => explorationStartUpdate({ mapId: store.mapId, rng })),
    returnToMap: () => set((store) => returnUpdate(store)),
    endTurn: () => set(endTurnAction),
  };
}

function mapClickActions(set: StoreSetter) {
  return {
    selectSpell: (spellId: string | null) => set({ selectedSpellId: spellId }),
    setHoveredCell: (hoveredCell: Position | null) => set({ hoveredCell }),
    clickCell: (pos: Position) => set((store) => clickUpdate(store, pos)),
  };
}

function mapActions(set: StoreSetter): MapActions {
  return { ...mapStartActions(set), ...mapClickActions(set) };
}

type BattleActions = Pick<
  CombatStore,
  "startDungeonRoom" | "battleAttack" | "battleEnemyTurn" | "playEnemyTurns" | "advanceBattleTurn" | "settleDungeonRoom" | "endBattle"
>;

function battlePlayActions(set: StoreSetter) {
  return {
    startDungeonRoom: (input: { room: DungeonRoom }) => set({ battle: battleFromRoom(input.room) }),
    battleAttack: (input: { targetId: string; attack: AttackSpec; rng?: Rng }) =>
      set((store) => attackUpdate(store, input)),
    battleEnemyTurn: (input: { strategy: EnemyStrategy; rng?: Rng }) =>
      set((store) => enemyTurnUpdate(store, input)),
  };
}

function battleTurnActions(set: StoreSetter) {
  return {
    playEnemyTurns: (input?: { rng?: Rng; storage?: StorageLike }) =>
      set((store) => playEnemyTurnsUpdate(store, input?.rng ?? Math.random, input?.storage)),
    advanceBattleTurn: () => set((store) => advanceTurnUpdate(store)),
  };
}

/** Attaque 1vN data-driven (5C), isolée pour garder chaque fabrique sous 10 lignes. */
function battleSpellActions(set: StoreSetter) {
  return {
    battleSpellAttack: (input: { targetId: string; rng?: Rng }) => set((store) => spellAttackUpdate(store, input)),
  };
}

function battleCloseActions(set: StoreSetter) {
  return {
    settleDungeonRoom: (input?: { storage?: StorageLike }) => set((store) => settleUpdate(store, input?.storage)),
    endBattle: () => set((store) => endBattleUpdate(store)),
  };
}

function battleActions(set: StoreSetter): BattleActions {
  return { ...battlePlayActions(set), ...battleTurnActions(set), ...battleCloseActions(set) };
}

type DungeonActions = Pick<CombatStore, "enterDungeonRun" | "clearDungeonNotice">;

/** Entrée de donjon : l'action rend `true` seulement si un run a démarré (clef consommée). */
function dungeonActions(set: StoreSetter, get: () => CombatStore): DungeonActions {
  return {
    enterDungeonRun: (input) => {
      const update = enterUpdate(get(), input);
      set(update);
      return update.dungeonRun !== null && update.dungeonRun !== undefined;
    },
    clearDungeonNotice: () => set({ dungeonNotice: null }),
  };
}

const DEFAULT_STATE = {
  combat: null,
  battle: null,
  mode: "exploration",
  exploration: null,
  activeGroup: null,
  dungeonRun: null,
  dungeonNotice: null,
  mapId: startMapId(),
  selectedSpellId: null,
  hoveredCell: null,
  rewards: null,
} satisfies Omit<
  CombatStore,
  | "startDemoCombat"
  | "startExploration"
  | "returnToMap"
  | "selectSpell"
  | "setHoveredCell"
  | "clickCell"
  | "endTurn"
  | "startDungeonRoom"
  | "enterDungeonRun"
  | "clearDungeonNotice"
  | "battleAttack"
  | "battleSpellAttack"
  | "battleEnemyTurn"
  | "playEnemyTurns"
  | "advanceBattleTurn"
  | "settleDungeonRoom"
  | "endBattle"
  | "resetCombat"
>;

/** État neuf rendu par copie : une remise à zéro ne partage aucun objet mutable. */
function defaultCombatState() {
  return { ...DEFAULT_STATE };
}

type ResetActions = Pick<CombatStore, "resetCombat">;

/** « Nouvelle partie » : les onze champs de données reprennent leur valeur d'ouverture. */
function resetActions(set: StoreSetter): ResetActions {
  return { resetCombat: () => set(defaultCombatState()) };
}

function demoUpdate(mapId: string): Partial<CombatStore> {
  const base = { mode: "combat" as const, combat: buildDemoCombat(mapId), activeGroup: null };
  return { ...base, mapId, selectedSpellId: null, hoveredCell: null, rewards: null };
}

/** Zone de spawn choisie par le `mapId` courant du store, jamais par une constante. */
function explorationStartUpdate(input: { mapId: string; rng?: Rng }): Partial<CombatStore> {
  const pick = spawnPick(input);
  const base = initExploration({ map: mapById(input.mapId), ...spawnOf(pick.monsterId) });
  const context = { mapId: input.mapId, zoneId: pick.zoneId };
  const exploration = pick.fallback ? fallbackLog(base, context) : base;
  const header = { mode: "exploration" as const, exploration, combat: null, activeGroup: null };
  return { ...header, mapId: input.mapId, selectedSpellId: null, hoveredCell: null, rewards: null };
}

function endTurnAction(store: CombatStore): Partial<CombatStore> {
  if (store.mode !== "combat") return store;
  return endTurnUpdate(store);
}

export const useCombatStore = create<CombatStore>((set, get) => ({
  ...DEFAULT_STATE,
  ...mapActions(set),
  ...battleActions(set),
  ...battleSpellActions(set),
  ...dungeonActions(set, get),
  ...resetActions(set),
}));

export type { CombatStore };
