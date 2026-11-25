import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { computeInitiative } from "../../src/engine/combat/initiative";
import { createHero } from "../../src/engine/createHero";
import { heroBattleCombatant, monsterCombatant, setupDungeonBattle } from "../../src/engine/dungeon/combatants";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { combatantFromHero } from "../../src/engine/hero/combatant";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { activeCombatant, buildTimeline } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike, EnemyStrategy } from "../../src/engine/multiCombat";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { emptyInventory } from "../../src/store/gameSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const iop = (): ClassDef => mustFind(classes, "iop");

const MUD: MonsterDef = {
  id: "mud_test",
  name: "Mud de Test",
  description: "Monstre de test couvert de vase.",
  level: 3,
  hp: 40,
  ap: 6,
  mp: 3,
  stats: { strength: 12, intelligence: 4, chance: 6, agility: 8, wisdom: 2 },
  resistances: {
    flat: { earth: 2, fire: 0, water: 1, air: 0, neutral: 0 },
    percent: { earth: -10, fire: 0, water: 5, air: -5, neutral: 0 },
  },
  baseXp: 10,
  isBoss: false,
  spellIds: [],
  loot: [],
};

const RAT: MonsterDef = {
  ...MUD,
  id: "rat_test",
  name: "Rat de Test",
  level: 6,
  hp: 52,
  ap: 5,
  mp: 4,
  stats: { strength: 20, intelligence: 5, chance: 10, agility: 15, wisdom: 7 },
  resistances: {
    flat: { earth: 1, fire: 0, water: 0, air: 0, neutral: 3 },
    percent: { earth: 4, fire: -5, water: 0, air: 0, neutral: 2 },
  },
};

function makeHero(): CombatantLike {
  return {
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
    initiative: 30,
  };
}

const BIG_ATTACK: AttackSpec = { base: 500, element: "earth", apCost: 3 };
const SMALL_ATTACK: AttackSpec = { base: 10, element: "earth", apCost: 3 };

/** PV IMPAIRS (53) : `floor(hp × 0,5)` vaut 26, un arrondi donnerait 27. */
const ODD: MonsterDef = { ...MUD, id: "odd_test", name: "Odd de Test", hp: 53 };

function asState(combatants: CombatantLike[]): BattleState {
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [] };
}

function heroFirstBattle(): BattleState {
  const hero = { ...makeHero(), initiative: 500 };
  return asState([hero, monsterCombatant({ monster: RAT, index: 0 })]);
}

function enemyFirstBattle(): BattleState {
  const hero = { ...makeHero(), initiative: 1 };
  return asState([hero, monsterCombatant({ monster: RAT, index: 0 })]);
}

function battleRoom(): DungeonRoom {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

const nullStrategy: EnemyStrategy = () => null;

const attackingStrategy: EnemyStrategy = () => ({
  kind: "attack",
  targetId: "player",
  attack: SMALL_ATTACK,
});

const findIn = (battle: BattleState | null, id: string) => battle?.combatants.find((entry) => entry.id === id);

const initialState = () => {
  const { combat, mode, exploration, selectedSpellId } = useCombatStore.getState();
  return { combat, mode, exploration, selectedSpellId };
};

beforeEach(() => {
  useCombatStore.setState({
    battle: null,
    combat: null,
    mode: "exploration",
    exploration: null,
    selectedSpellId: null,
    hoveredCell: null,
    rewards: null,
    activeGroup: null,
  });
});

describe("monsterCombatant — identité et pools", () => {
  it("dérive un ennemi du MonsterDef avec un id indexé", () => {
    const combatant = monsterCombatant({ monster: MUD, index: 2 });
    expect(combatant.id).toBe("mud_test-2");
    expect(combatant.side).toBe("enemy");
    expect(combatant.name).toBe(MUD.name);
    expect(combatant.level).toBe(MUD.level);
    expect(combatant.position).toEqual({ x: 0, y: 0 });
  });

  it("recopie ap, mp, hp et leurs maxima exactement", () => {
    const combatant = monsterCombatant({ monster: RAT, index: 0 });
    expect(combatant.ap).toBe(RAT.ap);
    expect(combatant.maxAp).toBe(RAT.ap);
    expect(combatant.mp).toBe(RAT.mp);
    expect(combatant.maxMp).toBe(RAT.mp);
    expect(combatant.hp).toBe(RAT.hp);
    expect(combatant.maxHp).toBe(RAT.hp);
  });
});

describe("monsterCombatant — copie et initiative", () => {
  it("recopie stats et résistances, y compris les négatives", () => {
    const combatant = monsterCombatant({ monster: MUD, index: 1 });
    expect(combatant.stats).toEqual(MUD.stats);
    expect(combatant.resistances.flat).toEqual(MUD.resistances.flat);
    expect(combatant.resistances.percent).toEqual(MUD.resistances.percent);
    expect(combatant.resistances.percent.earth).toBe(-10);
  });

  it("calcule l'initiative avec computeInitiative", () => {
    const combatant = monsterCombatant({ monster: RAT, index: 0 });
    const { strength, intelligence, chance, agility } = RAT.stats;
    const expected = computeInitiative({ strength, intelligence, chance, agility, currentHp: RAT.hp, maxHp: RAT.hp });
    expect(combatant.initiative).toBe(expected);
  });

  it("ne partage aucune référence avec le MonsterDef", () => {
    const combatant = monsterCombatant({ monster: MUD, index: 0 });
    const before = structuredClone(MUD);
    combatant.stats.strength = 999;
    combatant.resistances.percent.earth = 99;
    combatant.position.x = 7;
    expect(MUD).toEqual(before);
  });

  it("honore une position fournie", () => {
    const combatant = monsterCombatant({ monster: MUD, index: 0, position: { x: 3, y: 4 } });
    expect(combatant.position).toEqual({ x: 3, y: 4 });
  });
});

describe("MONSTER-01 — initiative stockée par grade (donjon)", () => {
  it("lit l'initiative 0 du Piou Mazouté, pas les 15 de sa Force", () => {
    const piou = mustFind(monsters, "piou_mazoute");
    expect(piou.initiative).toBe(0);
    expect(monsterCombatant({ monster: piou, index: 0 }).initiative).toBe(0);
  });

  it("garde la formule pour un monstre sans initiative stockée : Rat à 52", () => {
    const rat = mustFind(monsters, "fer_rat_de_cale");
    expect(rat.initiative).toBeUndefined();
    // 22 + 5 + 10 + 15 = 52, PV plein : valeur inchangée par MONSTER-01.
    expect(monsterCombatant({ monster: rat, index: 0 }).initiative).toBe(52);
  });

  it("laisse le héros ouvrir contre le Piou quand sa formule le dépasse", () => {
    const piou = mustFind(monsters, "piou_mazoute");
    const setup = setupDungeonBattle({ hero: { combatant: makeHero() }, monsters: [{ monster: piou, count: 1 }] });
    expect(asState(setup.combatants).order).toEqual(["player", "piou_mazoute-0"]);
  });
});

describe("monsterCombatant — hpScale de salle (DEC-03)", () => {
  it("applique floor(hp × hpScale), jamais un arrondi", () => {
    const combatant = monsterCombatant({ monster: ODD, index: 0, hpScale: 0.5 });
    expect(combatant.hp).toBe(26);
    expect(combatant.maxHp).toBe(26);
  });

  it("laisse les PV intacts quand le facteur est absent", () => {
    const combatant = monsterCombatant({ monster: ODD, index: 0 });
    expect(combatant.hp).toBe(ODD.hp);
    expect(combatant.maxHp).toBe(ODD.hp);
  });

  it("ne touche qu'aux PV : le reste du monstre est identique au monde ouvert", () => {
    const world = monsterCombatant({ monster: MUD, index: 0 });
    const scaled = monsterCombatant({ monster: MUD, index: 0, hpScale: 0.35 });
    /** L'initiative dérive des PV (`computeInitiative`), elle suit le facteur. */
    const withoutHp = (combatant: CombatantLike) => ({ ...combatant, hp: 0, maxHp: 0, initiative: 0 });
    expect(withoutHp(scaled)).toEqual(withoutHp(world));
    expect(scaled.hp).toBe(Math.floor(MUD.hp * 0.35));
    expect(scaled.maxHp).toBe(scaled.hp);
  });

  it("applique le facteur de salle à tous les ennemis du combat", () => {
    const setup = setupDungeonBattle({
      hero: { combatant: makeHero() },
      monsters: [{ monster: ODD, count: 2 }],
      hpScale: 0.5,
    });
    const hp = setup.combatants.filter((entry) => entry.side === "enemy").map((entry) => entry.hp);
    expect(hp).toEqual([26, 26]);
  });
});

describe("setupDungeonBattle — composition", () => {
  it("crée count copies par monstre plus le héros, avec des ids uniques", () => {
    const hero = makeHero();
    const setup = setupDungeonBattle({
      hero: { combatant: hero },
      monsters: [
        { monster: MUD, count: 3 },
        { monster: RAT, count: 2 },
      ],
    });
    const enemies = setup.combatants.filter((entry) => entry.side === "enemy");
    expect(enemies.length).toBe(5);
    expect(setup.combatants.length).toBe(6);
    expect(new Set(enemies.map((entry) => entry.id)).size).toBe(5);
    expect(setup.combatants.filter((entry) => entry.side === "player").length).toBe(1);
  });

  it("expose le héros comme playerId", () => {
    const setup = setupDungeonBattle({ hero: { combatant: makeHero() }, monsters: [{ monster: MUD, count: 1 }] });
    expect(setup.playerId).toBe("player");
  });
});

describe("setupDungeonBattle — positions et immuabilité", () => {
  it("applique les positions de départ quand elles sont fournies", () => {
    const setup = setupDungeonBattle({
      hero: { combatant: makeHero() },
      monsters: [{ monster: MUD, count: 2 }],
      startingPositions: { hero: { x: 1, y: 1 }, monsters: [{ x: 5, y: 1 }, { x: 6, y: 1 }] },
    });
    const heroes = setup.combatants.filter((entry) => entry.side === "player");
    expect(heroes[0]?.position).toEqual({ x: 1, y: 1 });
    expect(setup.combatants.slice(1).map((entry) => entry.position)).toEqual([
      { x: 5, y: 1 },
      { x: 6, y: 1 },
    ]);
  });

  it("ne mute ni les MonsterDef ni le héros fournis", () => {
    const hero = makeHero();
    const groups = [{ monster: MUD, count: 2 }];
    const beforeMonster = structuredClone(MUD);
    const beforeHero = structuredClone(hero);
    setupDungeonBattle({ hero: { combatant: hero }, monsters: groups });
    expect(MUD).toEqual(beforeMonster);
    expect(hero).toEqual(beforeHero);
  });
});

describe("heroBattleCombatant — pont héros", () => {
  it("calcule l'initiative du héros via computeInitiative", () => {
    const hero = createHero("Balthazar", iop());
    const stats = totalStatsFor({ hero, inventory: emptyInventory(), items: [], sets: [] });
    const state = combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds: [] });
    const combatant = heroBattleCombatant({ combatant: state });
    const { strength, intelligence, chance, agility } = state.stats;
    const expected = computeInitiative({
      strength,
      intelligence,
      chance,
      agility,
      currentHp: state.hp,
      maxHp: state.maxHp,
    });
    expect(combatant.initiative).toBe(expected);
    expect(combatant.side).toBe("player");
  });
});

describe("useCombatStore — salle de donjon", () => {
  it("construit le battle d'une vraie salle sans toucher au 1v1", () => {
    const room = battleRoom();
    const before = initialState();
    useCombatStore.getState().startDungeonRoom({ room });
    const state = useCombatStore.getState();
    const enemies = state.battle?.combatants.filter((entry) => entry.side === "enemy") ?? [];
    expect(roomMonsters(room).length).toBeGreaterThan(0);
    expect(state.battle).not.toBeNull();
    expect(enemies.length).toBe(3);
    expect(state.battle?.turn).toBe(1);
    expect(state.battle?.activeIndex).toBe(0);
    expect(state.battle?.log.length).toBeGreaterThan(0);
    expect(state.combat).toBe(before.combat);
    expect(state.mode).toBe(before.mode);
    expect(state.exploration).toBe(before.exploration);
    expect(state.selectedSpellId).toBe(before.selectedSpellId);
  });

  it("utilise les MonsterDef de data/monsters.yaml pour la salle 1", () => {
    useCombatStore.getState().startDungeonRoom({ room: battleRoom() });
    const battle = useCombatStore.getState().battle;
    const ids = battle?.combatants.map((entry) => entry.id) ?? [];
    // Index courant sur toute la salle : l'unicité tient même si deux groupes
    // référencent le même monstre.
    expect(ids).toEqual(["player", "piou_mazoute-0", "piou_mazoute-1", "fer_rat_de_cale-2"]);
    const rat = mustFind(monsters, "fer_rat_de_cale");
    expect(findIn(battle, "fer_rat_de_cale-2")?.hp).toBe(rat.hp);
  });
});

describe("useCombatStore — attaques 1vN", () => {
  it("tue la cible attaquée et journalise la victoire", () => {
    useCombatStore.setState({ battle: heroFirstBattle() });
    useCombatStore.getState().battleAttack({ targetId: "rat_test-0", attack: BIG_ATTACK });
    const battle = useCombatStore.getState().battle;
    expect(findIn(battle, "rat_test-0")?.hp).toBe(0);
    expect(battle?.log.length).toBeGreaterThan(0);
  });

  it("garde la même référence quand la cible est refusée", () => {
    const battle = heroFirstBattle();
    useCombatStore.setState({ battle });
    const activeId = activeCombatant(battle)?.id ?? "";
    useCombatStore.getState().battleAttack({ targetId: activeId, attack: BIG_ATTACK });
    expect(useCombatStore.getState().battle).toBe(battle);
    useCombatStore.getState().battleAttack({ targetId: "cible_absente", attack: BIG_ATTACK });
    expect(useCombatStore.getState().battle).toBe(battle);
  });

  it("garde la même référence quand la stratégie ennemie rend null", () => {
    const battle = enemyFirstBattle();
    useCombatStore.setState({ battle });
    useCombatStore.getState().battleEnemyTurn({ strategy: nullStrategy });
    expect(useCombatStore.getState().battle).toBe(battle);
  });

  it("délègue le tour ennemi à enemiesAct", () => {
    useCombatStore.setState({ battle: enemyFirstBattle() });
    useCombatStore.getState().battleEnemyTurn({ strategy: attackingStrategy });
    const hero = findIn(useCombatStore.getState().battle, "player");
    expect(hero?.hp).toBeLessThan(60);
  });
});

describe("useCombatStore — clôture et invariants", () => {
  it("clôt le battle sans toucher au 1v1", () => {
    useCombatStore.setState({ battle: heroFirstBattle() });
    useCombatStore.getState().endBattle();
    const state = useCombatStore.getState();
    expect(state.battle).toBeNull();
    expect(state.combat).toBeNull();
    expect(state.mode).toBe("exploration");
  });

  it("préserve combat, mode, exploration et sort sélectionné sur toute la séquence", () => {
    const before = initialState();
    const store = useCombatStore.getState();
    store.startDungeonRoom({ room: battleRoom() });
    store.battleAttack({ targetId: "piou_mazoute-0", attack: SMALL_ATTACK });
    store.battleEnemyTurn({ strategy: nullStrategy });
    store.endBattle();
    expect(initialState()).toEqual(before);
  });
});
