import { describe, expect, it } from "vitest";
import { isSpellAvailable, recordSpellCast } from "../../src/engine/combat";
import type { SpellLimit, SpellUsageMap } from "../../src/engine/combat";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildTimeline, isAttackAvailable, resolveAttack } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { spellSchema } from "../../src/schemas/spellSchema";

/**
 * Sentinelle 1.29 : `castsPerTurn` et `castsPerTarget` valent `0` pour
 * « aucune limite » (Pression #141 = `0,0`, Mot Curatif #121 = `1,0`). Le
 * schéma doit accepter la valeur et le moteur ne doit jamais la lire comme un
 * quota épuisé (`casts < 0`), sinon une donnée correcte rend le sort injouable.
 */

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const RNG = (): number => 0;
const MAP = parseAsciiMap([".......", ".......", "......."]);

const RAW_SPELL = {
  id: "test_zero",
  name: "Sort Zéro",
  description: "Sort de test, sentinelle de quota pilotée par le cas.",
  classId: "monster",
  kind: "damage",
  element: "neutral",
  apCost: 3,
  minRange: 1,
  maxRange: 1,
  requiresLos: true,
  damage: { min: 10, max: 10 },
};

function combatant(overrides: Partial<CombatantLike>): CombatantLike {
  const base: CombatantLike = {
    id: "base",
    side: "enemy",
    name: "Base",
    level: 20,
    hp: 1_000,
    maxHp: 1_000,
    ap: 12,
    maxAp: 12,
    mp: 3,
    maxMp: 3,
    position: { x: 1, y: 0 },
    stats: { ...STATS },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    initiative: 10,
  };
  return { ...base, ...overrides };
}

const attacker = () => combatant({ id: "e1", name: "Yvon", initiative: 30 });
const ally = (id: string, position: { x: number; y: number }, initiative: number) =>
  combatant({ id, side: "player", name: id, position, initiative });

function stateOf(combatants: readonly CombatantLike[]): BattleState {
  const timeline = buildTimeline(combatants);
  return { turn: 1, ...timeline, combatants: [...combatants], log: [], map: MAP };
}

function withActive(state: BattleState, id: string): BattleState {
  return { ...state, activeIndex: Math.max(0, state.order.indexOf(id)) };
}

function attackOf(apCost: number, limit: SpellLimit, spellId = "test_zero"): AttackSpec {
  return { base: 10, element: "neutral", apCost, spellId, ...limit };
}

function strike(state: BattleState, targetId: string, attack: AttackSpec): BattleState {
  return resolveAttack({ state, attackerId: "e1", targetId, attack, rng: RNG });
}

function hitLog(state: BattleState): number {
  return state.log.filter((line) => line.includes("frappe")).length;
}

function combatantIn(state: BattleState, id: string): CombatantLike {
  const found = state.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de la bataille`);
  return found;
}

function duel(): BattleState {
  return withActive(stateOf([attacker(), ally("p1", { x: 0, y: 0 }, 20)]), "e1");
}

function trio(): BattleState {
  const group = [attacker(), ally("p1", { x: 0, y: 0 }, 20), ally("p2", { x: 2, y: 0 }, 10)];
  return withActive(stateOf(group), "e1");
}

function castTimes(state: BattleState, targetId: string, attack: AttackSpec, times: number): BattleState {
  return Array.from({ length: times }, () => attack).reduce((acc, spec) => strike(acc, targetId, spec), state);
}

const FREE_TURN = { castsPerTurn: 0 } as const;
const ZERO_THREE = attackOf(3, FREE_TURN);

describe("schéma — la sentinelle `0` est une valeur légale", () => {
  it("accepte castsPerTurn: 0 et castsPerTarget: 0", () => {
    const parsed = spellSchema.parse({ ...RAW_SPELL, castsPerTurn: 0, castsPerTarget: 0 });
    expect([parsed.castsPerTurn, parsed.castsPerTarget]).toEqual([0, 0]);
  });

  it("refuse toujours un quota négatif", () => {
    expect(spellSchema.safeParse({ ...RAW_SPELL, castsPerTurn: -1 }).success).toBe(false);
  });
});

describe("moteur — castsPerTurn: 0 vaut illimité", () => {
  it("T1 : 12 PA, sort 3 PA à 0 : 4 lancers, 0 PA, 5e refusé par les PA", () => {
    const four = castTimes(duel(), "p1", ZERO_THREE, 4);
    expect([hitLog(four), combatantIn(four, "p1").hp, combatantIn(four, "e1").ap]).toEqual([4, 960, 0]);
    const fifth = strike(four, "p1", ZERO_THREE);
    expect(fifth).toBe(four);
    expect(isAttackAvailable({ state: four, casterId: "e1", attack: ZERO_THREE, targetId: "p1" })).toBe(true);
  });

  it("T2 : champs absents, 12 PA : 4 lancers (non-régression)", () => {
    const bare = attackOf(3, {}, "test_sans_quota");
    const four = castTimes(duel(), "p1", bare, 4);
    expect([hitLog(four), combatantIn(four, "e1").ap]).toEqual([4, 0]);
    const fifth = strike(four, "p1", bare);
    expect(fifth).toBe(four);
    expect(isAttackAvailable({ state: four, casterId: "e1", attack: bare, targetId: "p1" })).toBe(true);
  });

  it("T3 : castsPerTurn: 1, 12 PA : 1 lancer, 9 PA, second refusé", () => {
    const capped = attackOf(3, { castsPerTurn: 1 });
    const first = strike(duel(), "p1", capped);
    expect([hitLog(first), combatantIn(first, "e1").ap]).toEqual([1, 9]);
    const second = strike(first, "p1", capped);
    expect(second).toBe(first);
    expect(isAttackAvailable({ state: first, casterId: "e1", attack: capped, targetId: "p1" })).toBe(false);
  });

  it("T4 : castsPerTurn: 0, castsPerTarget: 2, 12 PA : A×2 puis B×1, A×3 refusé", () => {
    const pair = attackOf(4, { castsPerTurn: 0, castsPerTarget: 2 });
    const afterA = castTimes(trio(), "p1", pair, 2);
    const afterB = strike(afterA, "p2", pair);
    expect([hitLog(afterB), combatantIn(afterB, "e1").ap]).toEqual([3, 0]);
    const forbidden = strike(afterB, "p1", pair);
    expect(forbidden).toBe(afterB);
    expect(isAttackAvailable({ state: afterB, casterId: "e1", attack: pair, targetId: "p1" })).toBe(false);
    expect(isAttackAvailable({ state: afterB, casterId: "e1", attack: pair, targetId: "p2" })).toBe(true);
  });
});

interface Attempt {
  usage: SpellUsageMap;
  cast: boolean;
}

const KEY = "e1:test_recharge";
const NO_USAGE: SpellUsageMap = {};

function attempt(state: Attempt, limit: SpellLimit, turn: number): Attempt {
  const input = { usage: state.usage, key: KEY, limit, turn };
  if (!isSpellAvailable(input)) return { usage: state.usage, cast: false };
  return { usage: recordSpellCast(input), cast: true };
}

describe("moteur — la sentinelle ne casse ni recharge ni remise à zéro", () => {
  it("T5 : cooldown: 2 : lancer au tour 1, rien en 2 et 3, lancer au tour 4", () => {
    const limit = { castsPerTurn: 1, cooldown: 2 };
    const one = attempt({ usage: NO_USAGE, cast: false }, limit, 1);
    const two = attempt(one, limit, 2);
    const three = attempt(two, limit, 3);
    const four = attempt(three, limit, 4);
    expect([one.cast, two.cast, three.cast, four.cast]).toEqual([true, false, false, true]);
  });

  it("T6 : castsPerTurn: 1 : compteur remis à zéro du tour 3 au tour 4", () => {
    const limit = { castsPerTurn: 1 };
    const first = attempt({ usage: NO_USAGE, cast: false }, limit, 3);
    const again = attempt(first, limit, 3);
    const nextTurn = attempt(again, limit, 4);
    expect([first.cast, again.cast, nextTurn.cast]).toEqual([true, false, true]);
  });

  it("cooldown seul (sans castsPerTurn) : chaque lancer arme la recharge", () => {
    const limit = { cooldown: 2 };
    const one = attempt({ usage: NO_USAGE, cast: false }, limit, 1);
    const two = attempt(one, limit, 2);
    expect([one.cast, two.cast]).toEqual([true, false]);
  });
});
