import { describe, expect, it } from "vitest";
import {
  computeApMpLossChance,
  computeDamage,
  computePushbackDamage,
  computeTackleEscapePercent,
} from "../../src/engine/combat";
import { parseAsciiMap } from "../../src/engine/grid";
import {
  activeCombatant,
  advanceTurn,
  buildTimeline,
  enemiesAct,
  isDefeat,
  isVictory,
  resolveAttack,
  resolveTackle,
  targetsOf,
} from "../../src/engine/multiCombat";
import type {
  AttackSpec,
  BattleState,
  CombatantLike,
  EnemyAction,
  Rng,
} from "../../src/engine/multiCombat";

const STATS = { strength: 100, intelligence: 60, chance: 40, agility: 100, wisdom: 80 };
const LEVEL = 10;

function makeCombatant(overrides: Partial<CombatantLike> = {}): CombatantLike {
  return {
    id: "base",
    side: "enemy",
    name: "Base",
    level: LEVEL,
    hp: 200,
    maxHp: 200,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { ...STATS },
    initiative: 50,
    ...overrides,
  };
}

function makeState(combatants: CombatantLike[], extra: Partial<BattleState> = {}): BattleState {
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [], ...extra };
}

function attackSpec(overrides: Partial<AttackSpec> = {}): AttackSpec {
  return { base: 10, element: "earth", baseCrit: 0, apCost: 3, ...overrides };
}

function sequence(...values: number[]): Rng {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

function countingRng(value: number): { rng: Rng; calls: () => number } {
  let calls = 0;
  const rng = () => {
    calls += 1;
    return value;
  };
  return { rng, calls: () => calls };
}

interface DuelOverrides {
  player?: Partial<CombatantLike>;
  enemy?: Partial<CombatantLike>;
}

function duel(overrides: DuelOverrides = {}): { player: CombatantLike; enemy: CombatantLike } {
  const player = makeCombatant({
    id: "p1",
    side: "player",
    name: "Iop",
    initiative: 120,
    ...overrides.player,
  });
  const enemy = makeCombatant({
    id: "e1",
    side: "enemy",
    name: "Piou",
    initiative: 40,
    ...overrides.enemy,
  });
  return { player, enemy };
}

const WALL_MAP = parseAsciiMap([".....", "...#."]);
const FREE_MAP = parseAsciiMap([".....", "....."]);

function pushState(map: typeof WALL_MAP): BattleState {
  const attacker = makeCombatant({ id: "p1", side: "player", initiative: 300, position: { x: 1, y: 1 } });
  const target = makeCombatant({ id: "e1", side: "enemy", initiative: 60, position: { x: 2, y: 1 } });
  return makeState([attacker, target], { map });
}

describe("buildTimeline", () => {
  it("trie par initiative décroissante et départage par id croissant", () => {
    const fast = makeCombatant({ id: "zz_fast", initiative: 300 });
    const tieA = makeCombatant({ id: "aaa_tie", initiative: 120 });
    const tieB = makeCombatant({ id: "bbb_tie", initiative: 120 });
    const timeline = buildTimeline([fast, tieB, tieA]);
    expect(timeline.order).toEqual(["zz_fast", "aaa_tie", "bbb_tie"]);
    expect(timeline.activeIndex).toBe(0);
  });

  it("ne trie pas le tableau d'entrée", () => {
    const slow = makeCombatant({ id: "slow", initiative: 10 });
    const quick = makeCombatant({ id: "quick", initiative: 90 });
    const input = [slow, quick];
    buildTimeline(input);
    expect(input.map((entry) => entry.id)).toEqual(["slow", "quick"]);
  });
});

describe("activeCombatant", () => {
  it("renvoie l'entité active, null pour une timeline vide", () => {
    const { player, enemy } = duel();
    expect(activeCombatant(makeState([player, enemy]))?.id).toBe("p1");
    expect(activeCombatant(makeState([], { order: [], activeIndex: 0 }))).toBeNull();
  });
});

describe("targetsOf", () => {
  it("renvoie les vivants du camp opposé", () => {
    const { player, enemy } = duel({ enemy: { hp: 0 } });
    const ally = makeCombatant({ id: "p2", side: "player", initiative: 10 });
    const state = makeState([player, enemy, ally]);
    expect(targetsOf(state, "player").map((entry) => entry.id)).toEqual([]);
    expect(targetsOf(state, "enemy").map((entry) => entry.id)).toEqual(["p1", "p2"]);
  });
});

describe("advanceTurn", () => {
  it("saute un mort, incrémente le tour au bouclage et restaure PA/PM", () => {
    const first = makeCombatant({ id: "p1", side: "player", initiative: 300, ap: 1, mp: 0 });
    const dead = makeCombatant({ id: "e_dead", side: "enemy", initiative: 200, hp: 0 });
    const last = makeCombatant({ id: "e2", side: "enemy", initiative: 100, ap: 0, mp: 0 });
    const state = makeState([first, dead, last]);
    const next = advanceTurn(state);
    expect(next.activeIndex).toBe(2);
    expect(next.turn).toBe(1);
    expect(next.combatants[2]?.ap).toBe(6);
    expect(next.combatants[2]?.mp).toBe(3);
    expect(state.combatants[2]?.ap).toBe(0);
  });

  it("incrémente le tour en revenant au premier vivant", () => {
    const first = makeCombatant({ id: "p1", side: "player", initiative: 300, ap: 0 });
    const second = makeCombatant({ id: "e1", side: "enemy", initiative: 200 });
    const state = makeState([first, second]);
    const wrapped = advanceTurn(advanceTurn(state));
    expect(wrapped.activeIndex).toBe(0);
    expect(wrapped.turn).toBe(2);
    expect(wrapped.combatants[0]?.ap).toBe(6);
  });
});

describe("resolveAttack", () => {
  it("refuse un attaquant non actif (même référence)", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    const next = resolveAttack({ state, attackerId: "e1", targetId: "p1", attack: attackSpec(), rng: () => 0.99 });
    expect(next).toBe(state);
  });

  it("refuse un coup dont le coût dépasse les PA restants", () => {
    const { player, enemy } = duel({ player: { ap: 2 } });
    const state = makeState([player, enemy]);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec({ apCost: 3 }), rng: () => 0.99 });
    expect(next).toBe(state);
  });

  it("refuse une cible déjà morte", () => {
    const { player, enemy } = duel({ enemy: { hp: 0 } });
    const state = makeState([player, enemy]);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec(), rng: () => 0.99 });
    expect(next).toBe(state);
  });

  it("applique exactement computeDamage et débite les PA", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    const attack = attackSpec();
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
    const expected = computeDamage({ base: attack.base, stat: player.stats.strength, isPlayer: true });
    expect(next.combatants[1]?.hp).toBe(enemy.hp - expected);
    expect(next.combatants[0]?.ap).toBe(player.ap - attack.apCost);
    expect(next.log).toHaveLength(1);
  });

  it("applique le critique au-delà de 100 de taux avec critDamagePct", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    const attack = attackSpec({ baseCrit: 200 });
    const rng = countingRng(0);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: rng.rng, critDamagePct: 50 });
    const expected = computeDamage({ base: attack.base, stat: player.stats.strength, percentDmg: 50 });
    expect(next.combatants[1]?.hp).toBe(enemy.hp - expected);
    expect(rng.calls()).toBe(0);
  });

  it("retire la cible morte des cibles", () => {
    const { player } = duel();
    const weak = makeCombatant({ id: "e1", side: "enemy", hp: 5, maxHp: 5, initiative: 40 });
    const state = makeState([player, weak]);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec(), rng: () => 0.99 });
    expect(next.combatants[1]?.hp).toBe(0);
    expect(targetsOf(next, "player")).toHaveLength(0);
    expect(isVictory(next)).toBe(true);
  });

  it("ajoute les dégâts de collision quand la poussée touche un mur", () => {
    const state = pushState(WALL_MAP);
    const attack = attackSpec({ pushCells: 1, roll: 20 });
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
    const collision = computePushbackDamage({ casterLevel: LEVEL, roll: 20, remainingCells: 1 });
    expect(collision).toBeGreaterThan(0);
    const base = computeDamage({ base: attack.base, stat: STATS.strength, isPlayer: true });
    expect(next.combatants[1]?.hp).toBe(200 - base - collision);
  });

  it("n'ajoute rien quand la poussée est libre", () => {
    const state = pushState(FREE_MAP);
    const attack = attackSpec({ pushCells: 1, roll: 20 });
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
    const base = computeDamage({ base: attack.base, stat: STATS.strength, isPlayer: true });
    expect(next.combatants[1]?.hp).toBe(200 - base);
  });
});

describe("resolveTackle", () => {
  const adjacent = () => duel({ player: { position: { x: 1, y: 1 } }, enemy: { position: { x: 2, y: 1 } } });

  it("tacle réussi : déplacement refusé et perte de PA", () => {
    const { player, enemy } = adjacent();
    const state = makeState([player, enemy]);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 0, y: 1 }, rng: sequence(0.99, 0) });
    const escaped = computeTackleEscapePercent({ fleeAgility: 100, tackleAgility: 100 });
    const lossChance = computeApMpLossChance({ casterWisdom: 80, targetWisdom: 80, remaining: 6, max: 6 });
    expect(escaped).toBe(50);
    expect(lossChance).toBeGreaterThan(0);
    expect(result.moved).toBe(false);
    expect(result.apLoss).toBe(1);
    expect(result.state.combatants[0]?.ap).toBe(player.ap - 1);
    expect(result.state.combatants[0]?.position).toEqual(player.position);
  });

  it("tacle raté : le déplacement passe sans perte de PA", () => {
    const { player, enemy } = adjacent();
    const state = makeState([player, enemy]);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 0, y: 1 }, rng: sequence(0) });
    expect(result.moved).toBe(true);
    expect(result.apLoss).toBe(0);
    expect(result.state.combatants[0]?.position).toEqual({ x: 0, y: 1 });
    expect(result.state.combatants[0]?.ap).toBe(player.ap);
  });

  it("sans adversaire adjacent : déplacement libre sans jet", () => {
    const { player, enemy } = duel({ player: { position: { x: 1, y: 1 } }, enemy: { position: { x: 5, y: 5 } } });
    const state = makeState([player, enemy]);
    const rng = countingRng(0);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 0, y: 1 }, rng: rng.rng });
    expect(rng.calls()).toBe(0);
    expect(result.moved).toBe(true);
    expect(result.apLoss).toBe(0);
  });

  it("refuse un déplacement si l'entité n'est pas active", () => {
    const { player, enemy } = adjacent();
    const state = makeState([player, enemy]);
    const result = resolveTackle({ state, moverId: "e1", move: { x: 3, y: 1 }, rng: sequence(0) });
    expect(result.state).toBe(state);
    expect(result.moved).toBe(false);
    expect(result.apLoss).toBe(0);
  });
});

describe("isVictory / isDefeat", () => {
  it("détecte la fin de combat des deux côtés", () => {
    const { player, enemy } = duel();
    const alive = makeState([player, enemy]);
    expect(isVictory(alive)).toBe(false);
    expect(isDefeat(alive)).toBe(false);
    expect(isVictory(makeState([player, { ...enemy, hp: 0 }]))).toBe(true);
    expect(isDefeat(makeState([{ ...player, hp: 0 }, enemy]))).toBe(true);
  });
});

function enemyTurnFixture(): BattleState {
  const player = makeCombatant({ id: "p1", side: "player", initiative: 10, position: { x: 0, y: 0 } });
  const enemy = makeCombatant({
    id: "e1",
    side: "enemy",
    initiative: 500,
    position: { x: 9, y: 9 },
    ap: 100,
    maxAp: 100,
  });
  return makeState([player, enemy]);
}

describe("enemiesAct", () => {
  it("borne un tour ennemi à 10 actions", () => {
    const state = enemyTurnFixture();
    let calls = 0;
    const strategy = (current: BattleState): EnemyAction => {
      calls += 1;
      const atLeft = activeCombatant(current)?.position.x === 4;
      return { kind: "move", to: { x: atLeft ? 5 : 4, y: 9 } };
    };
    const next = enemiesAct({ state, rng: () => 0.99, strategy });
    expect(calls).toBe(10);
    expect(next).not.toBe(state);
  });

  it("s'arrête sur null (même référence)", () => {
    const state = enemyTurnFixture();
    expect(enemiesAct({ state, rng: () => 0, strategy: () => null })).toBe(state);
  });

  it("s'arrête quand la cible meurt", () => {
    const state = enemyTurnFixture();
    let calls = 0;
    const strategy = (): EnemyAction => {
      calls += 1;
      return { kind: "attack", targetId: "p1", attack: attackSpec({ base: 5000, apCost: 3 }) };
    };
    const next = enemiesAct({ state, rng: () => 0.99, strategy });
    expect(calls).toBe(1);
    expect(next.combatants.find((entry) => entry.id === "p1")?.hp).toBe(0);
    expect(isDefeat(next)).toBe(true);
  });

  it("s'arrête quand l'état ne change plus", () => {
    const state = enemyTurnFixture();
    const broke = { ...state, combatants: state.combatants.map((entry) => ({ ...entry, ap: 0 })) };
    const strategy = (): EnemyAction => ({
      kind: "attack",
      targetId: "p1",
      attack: attackSpec({ apCost: 3 }),
    });
    expect(enemiesAct({ state: broke, rng: () => 0.99, strategy })).toBe(broke);
  });

  it("ne joue rien hors tour ennemi", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    expect(enemiesAct({ state, rng: () => 0, strategy: () => null })).toBe(state);
  });
});

describe("immuabilité", () => {
  it("ne mute jamais l'état d'entrée", () => {
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 } },
      enemy: { position: { x: 2, y: 1 } },
    });
    const state = makeState([player, enemy]);
    const snapshot = structuredClone(state);
    resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec(), rng: () => 0.99 });
    advanceTurn(state);
    resolveTackle({ state, moverId: "p1", move: { x: 1, y: 0 }, rng: sequence(0.99, 0) });
    enemiesAct({ state, rng: () => 0, strategy: () => null });
    expect(state).toEqual(snapshot);
  });
});
