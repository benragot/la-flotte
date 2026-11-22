import { describe, expect, it } from "vitest";
import {
  computeApMpLossChance,
  computeCritRate,
  computeDamage,
  computePushbackDamage,
  computeTackleEscapePercent,
} from "../../src/engine/combat";
import { parseAsciiMap } from "../../src/engine/grid";
import {
  activeCombatant,
  advanceTurn,
  approachCell,
  buildTimeline,
  enemiesAct,
  isCritical,
  isDefeat,
  isVictory,
  resolveAttack,
  resolveTackle,
  targetsOf,
} from "../../src/engine/multiCombat";
import type { CombatResistances } from "../../src/engine/combatLoop";
import type { AsciiMap } from "../../src/engine/grid";
import type {
  AttackSpec,
  BattleState,
  CombatantLike,
  EnemyAction,
  Rng,
} from "../../src/engine/multiCombat";

const STATS = { strength: 100, intelligence: 60, chance: 40, agility: 100, wisdom: 80 };
const LEVEL = 10;

function resistances(earthPercent = 0, earthFlat = 0): CombatResistances {
  return {
    flat: { earth: earthFlat, fire: 0, water: 0, air: 0, neutral: 0 },
    percent: { earth: earthPercent, fire: 0, water: 0, air: 0, neutral: 0 },
  };
}

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
    resistances: resistances(),
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

const adjacentDuel = () =>
  duel({ player: { position: { x: 1, y: 1 } }, enemy: { position: { x: 2, y: 1 } } });

const OPEN_MAP: AsciiMap = parseAsciiMap([".......", ".......", "......."]);
const WALL_FIRST_MAP: AsciiMap = parseAsciiMap([".......", "...#...", "......."]);
const WALL_SECOND_MAP: AsciiMap = parseAsciiMap([".......", "....#..", "......."]);

function pushState(map: AsciiMap): BattleState {
  const attacker = makeCombatant({ id: "p1", side: "player", initiative: 300, position: { x: 1, y: 1 } });
  const target = makeCombatant({ id: "e1", side: "enemy", initiative: 60, position: { x: 2, y: 1 } });
  return makeState([attacker, target], { map });
}

function pushedBy(state: BattleState, attack: AttackSpec): BattleState {
  return resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
}

const basePushDamage = (attack: AttackSpec): number =>
  computeDamage({ base: attack.base, stat: STATS.strength });

function combatantOf(state: BattleState, id: string): CombatantLike {
  const found = state.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de la bataille`);
  return found;
}

const positionOf = (state: BattleState, id: string) => combatantOf(state, id).position;

/** Paires de vivants qui partagent une case : doit toujours être vide. */
function sharedCells(state: BattleState): string[] {
  const living = state.combatants.filter((entry) => entry.hp > 0);
  return living.flatMap((first, index) =>
    living
      .slice(index + 1)
      .filter((second) => second.position.x === first.position.x)
      .filter((second) => second.position.y === first.position.y)
      .map((second) => `${first.id}/${second.id}`),
  );
}

function withActive(state: BattleState, id: string): BattleState {
  return { ...state, activeIndex: state.order.indexOf(id) };
}

/** Héros en (1,1), cible en (2,1), tiers en (4,1) : la poussée les sépare de 2 cases. */
function crowdedPushState(): BattleState {
  const attacker = makeCombatant({ id: "p1", side: "player", initiative: 300, position: { x: 1, y: 1 } });
  const target = makeCombatant({ id: "e1", side: "enemy", initiative: 60, position: { x: 2, y: 1 } });
  const third = makeCombatant({ id: "e2", side: "enemy", initiative: 50, position: { x: 4, y: 1 } });
  return makeState([attacker, target, third], { map: OPEN_MAP });
}

/** Incohérence héritée : le rat squatte la case du héros, un second monstre attend au loin. */
function overlapState(): BattleState {
  const hero = makeCombatant({ id: "p1", side: "player", initiative: 300, position: { x: 2, y: 2 } });
  const rat = makeCombatant({ id: "e1", side: "enemy", initiative: 60, position: { x: 2, y: 2 } });
  const other = makeCombatant({ id: "e2", side: "enemy", initiative: 50, position: { x: 6, y: 1 } });
  return withActive(makeState([hero, rat, other], { map: OPEN_MAP }), "e1");
}

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

describe("advanceTurn — bords", () => {
  it("ne fait rien si l'ordre est vide", () => {
    const state = makeState([], { order: [], activeIndex: 0 });
    expect(advanceTurn(state)).toBe(state);
  });

  it("ne fait rien si tous les combattants sont morts", () => {
    const { player, enemy } = duel({ player: { hp: 0 }, enemy: { hp: 0 } });
    const state = makeState([player, enemy]);
    expect(advanceTurn(state)).toBe(state);
  });

  it("ne fait rien quand l'actif est le seul vivant", () => {
    const { player, enemy } = duel({ enemy: { hp: 0 } });
    const state = makeState([player, enemy]);
    expect(advanceTurn(state)).toBe(state);
    expect(advanceTurn(advanceTurn(state)).turn).toBe(1);
  });
});

describe("resolveAttack — refus", () => {
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

  it("refuse l'auto-ciblage sans rembourser les PA", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "p1", attack: attackSpec(), rng: () => 0.99 });
    expect(next).toBe(state);
  });
});

describe("resolveAttack — dégâts", () => {
  it("applique exactement computeDamage et débite les PA", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    const attack = attackSpec();
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
    const expected = computeDamage({ base: attack.base, stat: player.stats.strength });
    expect(next.combatants[1]?.hp).toBe(enemy.hp - expected);
    expect(next.combatants[0]?.ap).toBe(player.ap - attack.apCost);
    expect(next.log).toHaveLength(1);
  });

  it("applique le critique garanti avec le critDamagePct de l'attaque", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    const attack = attackSpec({ baseCrit: 200, critDamagePct: 50 });
    const rng = countingRng(0);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: rng.rng });
    const expected = computeDamage({ base: attack.base, stat: player.stats.strength, percentDmg: 50 });
    expect(next.combatants[1]?.hp).toBe(enemy.hp - expected);
    expect(rng.calls()).toBe(0);
  });
});

describe("resolveAttack — résistances monstre", () => {
  it("applique les 80 % d'un monstre sans plafond", () => {
    const { player, enemy } = duel({ enemy: { resistances: resistances(80) } });
    const state = makeState([player, enemy]);
    const attack = attackSpec();
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
    const expected = computeDamage({ base: attack.base, stat: player.stats.strength, pctRes: 80 });
    expect(expected).toBe(4);
    expect(next.combatants[1]?.hp).toBe(enemy.hp - expected);
  });

  it("retranche les résistances fixes", () => {
    const { player, enemy } = duel({ enemy: { resistances: resistances(0, 5) } });
    const state = makeState([player, enemy]);
    const attack = attackSpec();
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
    const expected = computeDamage({ base: attack.base, stat: player.stats.strength, flatRes: 5 });
    expect(expected).toBe(15);
    expect(next.combatants[1]?.hp).toBe(enemy.hp - expected);
  });

  it("augmente les dégâts sur une faiblesse à -10 %", () => {
    const { player, enemy } = duel({ enemy: { resistances: resistances(-10) } });
    const state = makeState([player, enemy]);
    const attack = attackSpec();
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.99 });
    const expected = computeDamage({ base: attack.base, stat: player.stats.strength, pctRes: -10 });
    expect(expected).toBe(22);
    expect(expected).toBeGreaterThan(basePushDamage(attack));
    expect(next.combatants[1]?.hp).toBe(enemy.hp - expected);
  });
});

describe("resolveAttack — résistances joueur", () => {
  it("plafonne les 80 % d'un joueur à 50 %", () => {
    const { player, enemy } = duel({ player: { resistances: resistances(80) } });
    const state = makeState([player, enemy], { activeIndex: 1 });
    const attack = attackSpec();
    const next = resolveAttack({ state, attackerId: "e1", targetId: "p1", attack, rng: () => 0.99 });
    const expected = computeDamage({ base: attack.base, stat: enemy.stats.strength, pctRes: 80, isPlayer: true });
    expect(expected).toBe(10);
    expect(next.combatants[0]?.hp).toBe(player.hp - expected);
  });
});

describe("crit — branche probabiliste", () => {
  it("tire le critique sous le taux (12 % ici)", () => {
    const rate = computeCritRate({ baseCrit: 20, bonusCrit: 0, agility: 100 });
    expect(rate).toBe(12);
    expect(rate).toBeLessThan(100);
  });

  it("critique quand rng()×100 < taux, sinon non", () => {
    const { player, enemy } = duel({ player: { stats: { ...STATS, agility: 100 } } });
    const state = makeState([player, enemy]);
    const attack = attackSpec({ baseCrit: 20, critDamagePct: 50 });
    const crit = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.05 });
    const normal = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack, rng: () => 0.5 });
    const critDamage = computeDamage({ base: 10, stat: 100, percentDmg: 50 });
    const normalDamage = computeDamage({ base: 10, stat: 100 });
    expect(crit.combatants[1]?.hp).toBe(enemy.hp - critDamage);
    expect(normal.combatants[1]?.hp).toBe(enemy.hp - normalDamage);
  });

  it("place la frontière de isCritical entre 99 et 100", () => {
    expect(isCritical({ baseCrit: 157, agility: 100 })).toBe(false);
    expect(computeCritRate({ baseCrit: 157, bonusCrit: 0, agility: 100 })).toBe(99);
    expect(isCritical({ baseCrit: 158, agility: 100 })).toBe(true);
    expect(computeCritRate({ baseCrit: 158, bonusCrit: 0, agility: 100 })).toBe(100);
  });
});

describe("resolveAttack — mort et poussée", () => {
  it("retire la cible morte des cibles", () => {
    const { player } = duel();
    const weak = makeCombatant({ id: "e1", side: "enemy", hp: 5, maxHp: 5, initiative: 40 });
    const state = makeState([player, weak]);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec(), rng: () => 0.99 });
    expect(next.combatants[1]?.hp).toBe(0);
    expect(targetsOf(next, "player")).toHaveLength(0);
    expect(isVictory(next)).toBe(true);
  });

  it("pushCells 3 : mur à la 1re case, 0 case parcourue", () => {
    const attack = attackSpec({ pushCells: 3, roll: 20 });
    const next = pushedBy(pushState(WALL_FIRST_MAP), attack);
    const collision = computePushbackDamage({ casterLevel: LEVEL, roll: 20, remainingCells: 0 });
    expect(collision).toBe(0);
    expect(next.combatants[1]?.position).toEqual({ x: 2, y: 1 });
    expect(next.combatants[1]?.hp).toBe(200 - basePushDamage(attack) - collision);
  });

  it("pushCells 3 : mur à la 2e case, 1 case parcourue", () => {
    const attack = attackSpec({ pushCells: 3, roll: 20 });
    const next = pushedBy(pushState(WALL_SECOND_MAP), attack);
    const collision = computePushbackDamage({ casterLevel: LEVEL, roll: 20, remainingCells: 1 });
    expect(collision).toBeGreaterThan(0);
    expect(next.combatants[1]?.position).toEqual({ x: 3, y: 1 });
    expect(next.combatants[1]?.hp).toBe(200 - basePushDamage(attack) - collision);
  });

  it("pushCells 3 sans obstruction : 3 cases, aucun dégât de collision", () => {
    const attack = attackSpec({ pushCells: 3, roll: 20 });
    const next = pushedBy(pushState(OPEN_MAP), attack);
    expect(next.combatants[1]?.position).toEqual({ x: 5, y: 1 });
    expect(next.combatants[1]?.hp).toBe(200 - basePushDamage(attack));
  });
});

/**
 * Softlock « deux combattants sur la même case » : `applyPush` ne connaissait que
 * le mur et le lanceur, une poussée posait donc la cible sur un tiers. La cible
 * s'arrête désormais AVANT la case occupée, et les dégâts de collision gardent la
 * convention existante (`remainingCells = travelled`).
 */
describe("applyPush — aucune case partagée", () => {
  it("pushCells 3 : s'arrête avant un tiers au lieu de le traverser", () => {
    const attack = attackSpec({ pushCells: 3, roll: 20 });
    const next = pushedBy(crowdedPushState(), attack);
    const collision = computePushbackDamage({ casterLevel: LEVEL, roll: 20, remainingCells: 1 });
    expect(positionOf(next, "e1")).toEqual({ x: 3, y: 1 });
    expect(positionOf(next, "e2")).toEqual({ x: 4, y: 1 });
    expect(sharedCells(next)).toEqual([]);
    expect(combatantOf(next, "e1").hp).toBe(200 - basePushDamage(attack) - collision);
  });

  it("pushCells 2 : la case d'arrivée ne peut pas être celle du tiers", () => {
    const next = pushedBy(crowdedPushState(), attackSpec({ pushCells: 2, roll: 20 }));
    expect(positionOf(next, "e1")).toEqual({ x: 3, y: 1 });
    expect(sharedCells(next)).toEqual([]);
  });
});

describe("invariant — aucune case partagée", () => {
  it("ni la poussée ni le déplacement ne créent une case partagée", () => {
    const pushed = pushedBy(crowdedPushState(), attackSpec({ pushCells: 2, roll: 20 }));
    expect(sharedCells(pushed)).toEqual([]);
    const strategy = () => ({ kind: "move" as const, to: positionOf(pushed, "e1") });
    const next = enemiesAct({ state: withActive(pushed, "e2"), rng: () => 0.99, strategy });
    expect(positionOf(next, "e2")).toEqual({ x: 4, y: 1 });
    expect(sharedCells(next)).toEqual([]);
  });
});

/**
 * Défense en profondeur : une sauvegarde peut déjà contenir deux vivants sur la
 * même case. Le moteur ne gèle plus : au tour ennemi, l'ennemi qui squatte rejoint
 * la case libre la plus proche (BFS, ordre haut/droite/bas/gauche) ; sans case
 * libre il passe son tour.
 */
describe("case partagée héritée", () => {
  it("le tour ennemi dégage le squatter et la mêlée repart", () => {
    const state = overlapState();
    const next = enemiesAct({ state, rng: () => 0.99, strategy: () => null });
    expect(sharedCells(next)).toEqual([]);
    expect(next).not.toBe(state);
    expect(isVictory(next) || isDefeat(next)).toBe(false);
  });

  it("le héros n'est jamais déplacé : seul l'ennemi squatter se dégage", () => {
    const state = overlapState();
    const next = enemiesAct({ state, rng: () => 0.99, strategy: () => null });
    expect(positionOf(next, "p1")).toEqual(positionOf(state, "p1"));
    expect(positionOf(next, "e1")).not.toEqual(positionOf(state, "e1"));
  });

  it("les autres monstres retrouvent un chemin vers le héros", () => {
    const state = overlapState();
    expect(approachCell({ state, enemy: combatantOf(state, "e2"), target: combatantOf(state, "p1"), cells: 3 })).toBeNull();
    const next = enemiesAct({ state, rng: () => 0.99, strategy: () => null });
    const options = { state: next, enemy: combatantOf(next, "e2"), target: combatantOf(next, "p1"), cells: 3 };
    expect(approachCell(options)).not.toBeNull();
  });
});

describe("resolveTackle — asymétrie du tacle", () => {
  it("fuyard 0 / tacleur 200 : tacle systématique", () => {
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 }, stats: { ...STATS, agility: 0 } },
      enemy: { position: { x: 2, y: 1 }, stats: { ...STATS, agility: 200 } },
    });
    const state = makeState([player, enemy]);
    expect(computeTackleEscapePercent({ fleeAgility: 0, tackleAgility: 200 })).toBe(0);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 1, y: 0 }, rng: sequence(0, 0) });
    expect(result.moved).toBe(false);
    expect(result.apLoss).toBe(1);
  });

  it("fuyard 100 / tacleur 0 : esquive systématique", () => {
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 }, stats: { ...STATS, agility: 100 } },
      enemy: { position: { x: 2, y: 1 }, stats: { ...STATS, agility: 0 } },
    });
    const state = makeState([player, enemy]);
    expect(computeTackleEscapePercent({ fleeAgility: 100, tackleAgility: 0 })).toBe(100);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 1, y: 0 }, rng: sequence(0.99) });
    expect(result.moved).toBe(true);
    expect(result.apLoss).toBe(0);
  });
});

describe("resolveTackle — choix du tacleur", () => {
  it("retient le tacleur le plus agile quand deux adversaires sont adjacents", () => {
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 }, stats: { ...STATS, agility: 0 } },
      enemy: { position: { x: 2, y: 1 }, stats: { ...STATS, agility: 0 } },
    });
    const strong = makeCombatant({
      id: "e0_strong",
      position: { x: 1, y: 2 },
      initiative: 10,
      stats: { ...STATS, agility: 200 },
    });
    const state = makeState([enemy, player, strong]);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 1, y: 0 }, rng: sequence(0.3, 0) });
    expect(result.moved).toBe(false);
    expect(result.apLoss).toBe(1);
  });
});

describe("resolveTackle — contact", () => {
  it("tacle réussi : déplacement refusé et perte de PA", () => {
    const { player, enemy } = adjacentDuel();
    const state = makeState([player, enemy]);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 0, y: 1 }, rng: sequence(0.99, 0) });
    const lossChance = computeApMpLossChance({ casterWisdom: 80, targetWisdom: 80, remaining: 6, max: 6 });
    expect(lossChance).toBeGreaterThan(0);
    expect(result.moved).toBe(false);
    expect(result.apLoss).toBe(1);
    expect(result.state.combatants[0]?.ap).toBe(player.ap - 1);
    expect(result.state.combatants[0]?.position).toEqual(player.position);
  });

  it("tacle raté : le déplacement passe sans perte de PA", () => {
    const { player, enemy } = adjacentDuel();
    const state = makeState([player, enemy]);
    const result = resolveTackle({ state, moverId: "p1", move: { x: 0, y: 1 }, rng: sequence(0) });
    expect(result.moved).toBe(true);
    expect(result.apLoss).toBe(0);
    expect(result.state.combatants[0]?.position).toEqual({ x: 0, y: 1 });
    expect(result.state.combatants[0]?.ap).toBe(player.ap);
  });
});

describe("resolveTackle — refus et absence de contact", () => {
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
    const { player, enemy } = adjacentDuel();
    const state = makeState([player, enemy]);
    const result = resolveTackle({ state, moverId: "e1", move: { x: 3, y: 1 }, rng: sequence(0) });
    expect(result.state).toBe(state);
    expect(result.moved).toBe(false);
    expect(result.apLoss).toBe(0);
  });
});

describe("actif mort", () => {
  it("ne peut ni attaquer ni se déplacer", () => {
    const { player, enemy } = duel();
    const state = makeState([{ ...player, hp: 0 }, enemy]);
    const attack = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec(), rng: () => 0.99 });
    expect(attack).toBe(state);
    const move = resolveTackle({ state, moverId: "p1", move: { x: 1, y: 0 }, rng: sequence(0) });
    expect(move.state).toBe(state);
    expect(move.moved).toBe(false);
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

describe("enemiesAct — bornes", () => {
  it("borne un tour ennemi à 10 actions", () => {
    const base = enemyTurnFixture();
    // Chaque pas consomme des PM (5C-e) : on en donne assez pour éprouver la borne.
    const state = { ...base, combatants: base.combatants.map((entry) => (entry.side === "enemy" ? { ...entry, mp: 40 } : entry)) };
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
});

/** Carte 12×12 vide : les diagonales y sont libres, aucun mur ne fausse la mesure. */
const ROAM_MAP: AsciiMap = parseAsciiMap(Array.from({ length: 12 }, () => "............"));

/** Héros en (0,0) ; l'ennemi en (5,5) : (3,2) est à 3 pas diagonaux, manhattan 5. */
function diagonalFixture(mp: number): BattleState {
  const hero = makeCombatant({ id: "p1", side: "player", initiative: 10, position: { x: 0, y: 0 } });
  const enemy = makeCombatant({ id: "e1", name: "Piou", initiative: 500, position: { x: 5, y: 5 }, mp, maxMp: 3 });
  return makeState([hero, enemy], { map: ROAM_MAP });
}

const JUMP_DIAGONAL = (): EnemyAction => ({ kind: "move", to: { x: 3, y: 2 } });

/** Stratégie de production : approcher d'autant de pas que de PM, sinon refuser. */
function approachStrategy(current: BattleState, enemyId: string): EnemyAction {
  const enemy = combatantOf(current, enemyId);
  const target = combatantOf(current, "p1");
  const cell = approachCell({ state: current, enemy, target, cells: enemy.mp });
  return cell === null ? { kind: "blocked", reason: "chemin absent" } : { kind: "move", to: cell };
}

describe("enemiesAct — facturation du pas diagonal", () => {
  it("paie le chemin (3 pas), pas l'écart orthogonal (manhattan 5)", () => {
    const next = enemiesAct({ state: diagonalFixture(3), rng: () => 0.99, strategy: JUMP_DIAGONAL });
    expect(positionOf(next, "e1")).toEqual({ x: 3, y: 2 });
    expect(combatantOf(next, "e1").mp).toBe(0);
    expect(next.log).toContain("Piou se déplace de 3 case(s).");
    expect(next.log.some((line) => line.includes("ne peut pas atteindre"))).toBe(false);
  });

  it("refuse le même saut avec 2 PM et ne consomme rien", () => {
    const state = diagonalFixture(2);
    const next = enemiesAct({ state, rng: () => 0.99, strategy: JUMP_DIAGONAL });
    expect(next).toBe(state);
    expect(positionOf(next, "e1")).toEqual({ x: 5, y: 5 });
    expect(combatantOf(next, "e1").mp).toBe(2);
  });

  it("journalise le refus quand la stratégie renonce", () => {
    const strategy = (): EnemyAction => ({ kind: "blocked", reason: "PM trop courts" });
    const next = enemiesAct({ state: diagonalFixture(2), rng: () => 0.99, strategy });
    expect(next.log).toContain("Piou ne peut pas atteindre le héros (PM trop courts).");
  });

  it("ne laisse aucun monstre figé quand un chemin existe", () => {
    const spawns = [{ x: 5, y: 5 }, { x: 9, y: 2 }, { x: 10, y: 8 }];
    const enemies = spawns.map((position, index) => makeCombatant({ id: `e${index}`, position, initiative: 100 - index }));
    const hero = makeCombatant({ id: "p1", side: "player", position: { x: 0, y: 0 }, initiative: 10 });
    const state = makeState([hero, ...enemies], { map: ROAM_MAP });
    for (const enemy of enemies) {
      const turn = withActive(state, enemy.id);
      const next = enemiesAct({ state: turn, rng: () => 0.99, strategy: approachStrategy });
      expect(positionOf(next, enemy.id), `${enemy.id} figé`).not.toEqual(enemy.position);
    }
  });
});

describe("enemiesAct — arrêts", () => {
  it("s'arrête quand l'état ne change plus", () => {
    const state = enemyTurnFixture();
    const broke = { ...state, combatants: state.combatants.map((entry) => ({ ...entry, ap: 0 })) };
    const strategy = (): EnemyAction => ({ kind: "attack", targetId: "p1", attack: attackSpec({ apCost: 3 }) });
    expect(enemiesAct({ state: broke, rng: () => 0.99, strategy })).toBe(broke);
  });

  it("ne joue rien hors tour ennemi", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    expect(enemiesAct({ state, rng: () => 0, strategy: () => null })).toBe(state);
  });

  it("ne joue rien si l'ennemi actif est mort", () => {
    const state = enemyTurnFixture();
    const dead = { ...state, combatants: state.combatants.map((e) => (e.id === "e1" ? { ...e, hp: 0 } : e)) };
    let calls = 0;
    const strategy = (): EnemyAction => {
      calls += 1;
      return { kind: "move", to: { x: 8, y: 9 } };
    };
    expect(enemiesAct({ state: dead, rng: () => 0, strategy })).toBe(dead);
    expect(calls).toBe(0);
  });

  it("s'arrête quand la cible visée est déjà morte", () => {
    const state = enemyTurnFixture();
    const dead = { ...state, combatants: state.combatants.map((e) => (e.id === "p1" ? { ...e, hp: 0 } : e)) };
    let calls = 0;
    const strategy = (): EnemyAction => {
      calls += 1;
      return { kind: "attack", targetId: "p1", attack: attackSpec() };
    };
    expect(enemiesAct({ state: dead, rng: () => 0.99, strategy })).toBe(dead);
    expect(calls).toBe(1);
  });
});

describe("enemiesAct — critique ennemi", () => {
  it("transmet critDamagePct depuis l'action ennemie", () => {
    const state = enemyTurnFixture();
    const attack = attackSpec({ baseCrit: 200, critDamagePct: 50 });
    let calls = 0;
    const strategy = (): EnemyAction | null => {
      calls += 1;
      return calls === 1 ? { kind: "attack", targetId: "p1", attack } : null;
    };
    const next = enemiesAct({ state, rng: () => 0.99, strategy });
    const expected = computeDamage({ base: attack.base, stat: STATS.strength, percentDmg: 50, isPlayer: true });
    expect(next.combatants.find((entry) => entry.id === "p1")?.hp).toBe(200 - expected);
  });
});

describe("immuabilité", () => {
  it("ne mute jamais l'état d'entrée", () => {
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 } },
      enemy: { position: { x: 2, y: 1 } },
    });
    const state = makeState([player, enemy], { map: WALL_SECOND_MAP });
    const snapshot = structuredClone(state);
    resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec({ pushCells: 3 }), rng: () => 0.99 });
    advanceTurn(state);
    resolveTackle({ state, moverId: "p1", move: { x: 1, y: 0 }, rng: sequence(0.99, 0) });
    enemiesAct({ state, rng: () => 0, strategy: () => null });
    expect(state).toEqual(snapshot);
  });
});
