import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { setupDungeonBattle } from "../../src/engine/dungeon/combatants";
import { getCell, isWalkableCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { buildTimeline, isDefeat, isVictory, livingOf, resolveAttack } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { battleViewModel } from "../../src/renderer/battleViewModel";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { castRefusal, spellCastSpec } from "../../src/store/battleSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * Vraies données : aucune grille inventée. La salle 1 (`fer_salle_cour_volatiles`)
 * porte quatre murs intérieurs — dont le pilier `#` en (3,3), utilisé pour la LoS.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const maps = parseMapsYaml(read("maps.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const MAP_ID = "fer_salle_cour_volatiles";
const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const MAP = parseAsciiMap(mustFind(maps, MAP_ID).grid);
const PRESSION = mustFind(spells, "pression");
/** Sort de jet à `minRange: 2` : sert à prouver la borne basse sans empiler deux combattants. */
const JET_DECROU = mustFind(spells, "fer_spell_lancer_decrou");

const HERO: CombatantLike = {
  id: "player",
  side: "player",
  name: "Balthazar",
  level: 1,
  hp: 60,
  maxHp: 60,
  ap: 6,
  maxAp: 6,
  mp: 3,
  maxMp: 3,
  position: { x: 0, y: 0 },
  stats: { strength: 20, intelligence: 0, chance: 0, agility: 10, wisdom: 0 },
  resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
  initiative: 500,
};

function roomOne(): DungeonRoom {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

function roomGroups(): { monster: MonsterDef; count: number }[] {
  return roomMonsters(roomOne()).map((group) => ({ monster: mustFind(monsters, group.monsterId), count: group.count }));
}

function placeWithMap() {
  return setupDungeonBattle({ hero: { combatant: HERO }, monsters: roomGroups(), map: MAP });
}

function placedBattle(): BattleState {
  const setup = placeWithMap();
  return { turn: 1, ...buildTimeline(setup.combatants), combatants: setup.combatants, log: [], map: setup.map };
}

/** Déplace des combattants identifiés par leur id, sans muter l'état d'entrée. */
function moved(state: BattleState, positions: Record<string, Position>): BattleState {
  const combatants = state.combatants.map((entry) => {
    const position = positions[entry.id];
    return position === undefined ? entry : { ...entry, position };
  });
  return { ...state, combatants };
}

function heroTurn(state: BattleState): BattleState {
  return { ...state, activeIndex: Math.max(0, state.order.indexOf("player")) };
}

function combatantIn(state: BattleState | null, id: string): CombatantLike {
  const found = state?.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent du battle`);
  return found;
}

const battle = (): BattleState | null => useCombatStore.getState().battle;

function battleOrThrow(): BattleState {
  const state = battle();
  if (state === null) throw new Error("battle absent");
  return state;
}

function attackOn(state: BattleState, targetId: string, attack = spellCastSpec(PRESSION, 8)): BattleState {
  return resolveAttack({ state, attackerId: "player", targetId, attack, rng: () => 0 });
}

const cellKey = (position: Position): string => `${position.x},${position.y}`;

function castStore(targetId: string): BattleState {
  useCombatStore.getState().battleSpellAttack({ targetId, rng: () => 0 });
  return battleOrThrow();
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter({ name: "Balthazar", classId: "iop" });
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null });
});

describe("setupDungeonBattle — la carte entre dans la bataille", () => {
  it("rend la grille de la salle 1 et la pose dans le BattleState", () => {
    const setup = placeWithMap();
    expect(setup.map?.width).toBe(12);
    expect(setup.map?.height).toBe(12);
  });

  it("place les quatre combattants sur des cases praticables et distinctes", () => {
    const positions = placeWithMap().combatants.map((entry) => entry.position);
    expect(new Set(positions.map(cellKey)).size).toBe(4);
    for (const position of positions) {
      expect(isWalkableCell(MAP, position)).toBe(true);
      expect(getCell(MAP, position)).not.toBe("#");
      expect(getCell(MAP, position)).not.toBe("~");
    }
  });

  it("est déterministe : deux appels rendent exactement les mêmes positions", () => {
    const first = placeWithMap().combatants.map((entry) => entry.position);
    const second = placeWithMap().combatants.map((entry) => entry.position);
    expect(first).toEqual(second);
  });

  it("pose le héros sur une case P et chaque monstre sur une case M de la carte", () => {
    const combatants = placeWithMap().combatants;
    const hero = combatants.find((entry) => entry.side === "player");
    if (hero === undefined) throw new Error("héros absent");
    expect(MAP.playerSpawns.some((cell) => samePosition(cell, hero.position))).toBe(true);
    const enemies = combatants.filter((entry) => entry.side === "enemy");
    for (const enemy of enemies) {
      expect(MAP.monsterSpawns.some((cell) => samePosition(cell, enemy.position))).toBe(true);
    }
  });

  it("n'occupe jamais la case d'un autre combattant ni un mur", () => {
    const cells = placeWithMap().combatants.map((entry) => entry.position);
    cells.forEach((cell) => {
      expect(cells.filter((other) => cellKey(other) === cellKey(cell))).toHaveLength(1);
      expect(getCell(MAP, cell) === "#" || getCell(MAP, cell) === "~").toBe(false);
    });
  });
});

describe("useCombatStore.startDungeonRoom — carte et portée du sort", () => {
  it("pose la map de la salle et la portée lue dans data/spells.yaml", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const state = battleOrThrow();
    expect(state.map?.width).toBe(MAP.width);
    expect(state.castRange).toEqual({ min: PRESSION.minRange, max: PRESSION.maxRange, requiresLos: PRESSION.requiresLos });
  });

  it("place le héros sur une case P de la carte, libre et praticable", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const state = battleOrThrow();
    const hero = combatantIn(state, "player");
    expect(isWalkableCell(MAP, hero.position)).toBe(true);
    expect(MAP.playerSpawns.some((cell) => samePosition(cell, hero.position))).toBe(true);
    const occupied = state.combatants.filter((entry) => entry.id !== hero.id).map((entry) => entry.position);
    expect(occupied.some((cell) => cellKey(cell) === cellKey(hero.position))).toBe(false);
  });
});

describe("portée — refus avant tout PA", () => {
  it("refuse une cible à maxRange + 1 : même état par identité, PA intacts", () => {
    const state = heroTurn(moved(placedBattle(), { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 4, y: 1 } }));
    const before = structuredClone(state);
    const next = attackOn(state, "piou_mazoute-0");
    expect(next).toBe(state);
    expect(state).toEqual(before);
    expect(combatantIn(next, "player").ap).toBe(HERO.ap);
  });

  it("accepte une cible exactement à maxRange et ne paie qu'une fois", () => {
    const state = heroTurn(moved(placedBattle(), { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 3, y: 1 } }));
    const next = attackOn(state, "piou_mazoute-0");
    expect(next).not.toBe(state);
    expect(combatantIn(next, "player").ap).toBe(HERO.ap - PRESSION.apCost);
    expect(combatantIn(next, "piou_mazoute-0").hp).toBeLessThan(combatantIn(state, "piou_mazoute-0").hp);
  });

  it("refuse une cible sous minRange pour un sort à minRange 2", () => {
    const state = heroTurn(moved(placedBattle(), { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 2, y: 1 } }));
    const attack = spellCastSpec(JET_DECROU, 8);
    expect(JET_DECROU.minRange).toBe(2);
    expect(castRefusal(state, "piou_mazoute-0", attack)).toContain("hors portée");
    expect(attackOn(state, "piou_mazoute-0", attack)).toBe(state);
  });

  it("accepte la même cible à minRange exactement", () => {
    const state = heroTurn(moved(placedBattle(), { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 3, y: 1 } }));
    const attack = spellCastSpec(JET_DECROU, 8);
    expect(attackOn(state, "piou_mazoute-0", attack)).not.toBe(state);
  });
});

describe("ligne de vue — le pilier (3,3) de la vraie salle 1", () => {
  it("a bien un mur # entre les deux cases testées", () => {
    expect(getCell(MAP, { x: 3, y: 3 })).toBe("#");
    expect(isWalkableCell(MAP, { x: 2, y: 3 })).toBe(true);
    expect(isWalkableCell(MAP, { x: 4, y: 3 })).toBe(true);
  });

  it("refuse la cible derrière le mur, sans dépenser de PA", () => {
    const state = heroTurn(moved(placedBattle(), { player: { x: 2, y: 3 }, "piou_mazoute-0": { x: 4, y: 3 } }));
    const next = attackOn(state, "piou_mazoute-0");
    expect(next).toBe(state);
    expect(combatantIn(next, "player").ap).toBe(HERO.ap);
    expect(castRefusal(state, "piou_mazoute-0", spellCastSpec(PRESSION, 8))).toContain("ligne de vue bloquée");
  });

  it("accepte la même cible quand aucun mur ne s'interpose", () => {
    const state = heroTurn(moved(placedBattle(), { player: { x: 2, y: 3 }, "piou_mazoute-0": { x: 2, y: 2 } }));
    const next = attackOn(state, "piou_mazoute-0");
    expect(next).not.toBe(state);
    expect(combatantIn(next, "player").ap).toBe(HERO.ap - PRESSION.apCost);
  });

  it("ignore la géométrie quand le battle n'a pas de carte (comportement 5C-c)", () => {
    const setup = setupDungeonBattle({ hero: { combatant: HERO }, monsters: roomGroups() });
    const base = heroTurn(
      moved(
        { turn: 1, ...buildTimeline(setup.combatants), combatants: setup.combatants, log: [] },
        { player: { x: 0, y: 0 }, "piou_mazoute-0": { x: 9, y: 9 } },
      ),
    );
    expect(attackOn(base, "piou_mazoute-0")).not.toBe(base);
  });
});

describe("useCombatStore.battleSpellAttack — le joueur comprend le refus", () => {
  it("journalise « hors portée » et ne touche ni PV ni PA", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const base = heroTurn(battleOrThrow());
    const far = moved(base, { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 4, y: 1 } });
    useCombatStore.setState({ battle: far });
    const hpBefore = combatantIn(far, "piou_mazoute-0").hp;
    const next = castStore("piou_mazoute-0");
    expect(next.log.at(-1)).toContain("hors portée");
    expect(combatantIn(next, "player").ap).toBe(combatantIn(far, "player").ap);
    expect(combatantIn(next, "piou_mazoute-0").hp).toBe(hpBefore);
  });

  it("journalise « ligne de vue bloquée » derrière le pilier", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const base = heroTurn(battleOrThrow());
    const hidden = moved(base, { player: { x: 2, y: 3 }, "piou_mazoute-0": { x: 4, y: 3 } });
    useCombatStore.setState({ battle: hidden });
    const next = castStore("piou_mazoute-0");
    expect(next.log.at(-1)).toContain("ligne de vue bloquée");
    expect(combatantIn(next, "player").ap).toBe(combatantIn(hidden, "player").ap);
  });

  it("dépense exactement le coût du sort sur un cast accepté", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const base = heroTurn(moved(battleOrThrow(), { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 2, y: 1 } }));
    useCombatStore.setState({ battle: base });
    const next = castStore("piou_mazoute-0");
    expect(combatantIn(next, "player").ap).toBe(combatantIn(base, "player").ap - PRESSION.apCost);
    expect(combatantIn(next, "piou_mazoute-0").hp).toBeLessThan(combatantIn(base, "piou_mazoute-0").hp);
  });
});

describe("battleViewModel — la cible invalide est visible", () => {
  it("marque hors portée et expose la raison", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const far = heroTurn(moved(battleOrThrow(), { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 4, y: 1 } }));
    const view = battleViewModel(far).find((entry) => entry.id === "piou_mazoute-0");
    expect(view?.isTargetable).toBe(false);
    expect(view?.blockedReason).toBe("out-of-range");
  });

  it("marque sans ligne de vue derrière le pilier", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const hidden = heroTurn(moved(battleOrThrow(), { player: { x: 2, y: 3 }, "piou_mazoute-0": { x: 4, y: 3 } }));
    const view = battleViewModel(hidden).find((entry) => entry.id === "piou_mazoute-0");
    expect(view?.isTargetable).toBe(false);
    expect(view?.blockedReason).toBe("no-los");
  });

  it("garde ciblable une cible à portée et sans mur", () => {
    useCombatStore.getState().startDungeonRoom({ room: roomOne() });
    const near = heroTurn(moved(battleOrThrow(), { player: { x: 1, y: 1 }, "piou_mazoute-0": { x: 2, y: 1 } }));
    const view = battleViewModel(near).find((entry) => entry.id === "piou_mazoute-0");
    expect(view?.isTargetable).toBe(true);
    expect(view?.blockedReason).toBeNull();
  });
});

const MAX_ACTIONS = 300;

function roomAt(roomNumber: number): DungeonRoom {
  const room = mustFind(dungeons, DUNGEON_ID).rooms[roomNumber - 1];
  if (room === undefined) throw new Error(`salle ${roomNumber} absente`);
  return room;
}

/** Héros de test endurant : on mesure la géométrie et l'IA, pas l'équilibrage du donjon. */
function durableHero(): void {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros absent");
  useGameStore.setState({ hero: { ...hero, level: 16, hp: 400, maxHp: 400, strength: 120 } });
}

function battleOver(state: BattleState): boolean {
  return isVictory(state) || isDefeat(state);
}

function anyMonsterMoved(initial: BattleState, current: BattleState): boolean {
  const enemies = current.combatants.filter((entry) => entry.side === "enemy");
  return enemies.some((enemy) => {
    const start = initial.combatants.find((entry) => entry.id === enemy.id);
    return start !== undefined && !samePosition(start.position, enemy.position);
  });
}

function castableEnemies(state: BattleState): CombatantLike[] {
  const attack = spellCastSpec(PRESSION, 0);
  return livingOf(state, "enemy").filter((enemy) => castRefusal(state, enemy.id, attack) === null);
}

function weakestEnemy(state: BattleState): CombatantLike | null {
  const rank = (best: CombatantLike | null, enemy: CombatantLike) => (best === null || enemy.hp < best.hp ? enemy : best);
  return castableEnemies(state).reduce<CombatantLike | null>(rank, null);
}

function castAtWeakest(): void {
  const target = weakestEnemy(battleOrThrow());
  if (target !== null) useCombatStore.getState().battleSpellAttack({ targetId: target.id, rng: () => 0.5 });
}

/** Deux casts par tour au plus : c'est ce que paient les 6 PA du héros de test. */
function castPhase(): void {
  castAtWeakest();
  castAtWeakest();
}

interface RoomRun {
  battle: BattleState;
  actions: number;
  moved: boolean;
  heroStart: number;
}

function playRoomToEnd(room: DungeonRoom): RoomRun {
  useCombatStore.getState().startDungeonRoom({ room });
  const initial = battleOrThrow();
  const heroStart = combatantIn(initial, "player").hp;
  let actions = 0;
  while (actions < MAX_ACTIONS && !battleOver(battleOrThrow())) {
    castPhase();
    useCombatStore.getState().playEnemyTurns({ rng: () => 0.5 });
    actions += 1;
  }
  const battle = battleOrThrow();
  return { battle, actions, moved: anyMonsterMoved(initial, battle), heroStart };
}

describe("viabilité — les 4 salles se terminent par le chemin de production", () => {
  beforeEach(durableHero);

  for (const roomNumber of [1, 2, 3, 4]) {
    it(`salle ${roomNumber} : victoire, approche ennemie et riposte subie`, () => {
      const run = playRoomToEnd(roomAt(roomNumber));
      expect(run.actions).toBeLessThan(MAX_ACTIONS);
      expect(isVictory(run.battle)).toBe(true);
      expect(run.moved).toBe(true);
      expect(run.battle.log.some((line) => line.includes("se déplace de"))).toBe(true);
      expect(combatantIn(run.battle, "player").hp).toBeLessThan(run.heroStart);
    });
  }
});
