import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { castSpell } from "../../src/engine/combatLoop/cast";
import type { CombatantState, CombatState } from "../../src/engine/combatLoop/types";
import { parseAsciiMap } from "../../src/engine/grid";
import { advanceTurn, buildTimeline, enemiesAct, resolveAttack, resolveHeal } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike, HealSpec } from "../../src/engine/multiCombat";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { spellCastSpec, spellStrategy } from "../../src/store/battleSelectors";

/**
 * Règle 1.29 déclarée dans `data/spells.yaml` mais jamais consommée par le
 * moteur (SPELL-05) : `castsPerTurn` borne les **lancers du tour**, et
 * `castsPerTarget` borne les lancers sur une **même cible**. Un sort
 * `castsPerTurn: 2, castsPerTarget: 1` ne peut donc frapper la même cible
 * qu'une fois : le second lancer est refusé **par identité** (aucun PA, aucun
 * journal, aucune mutation), et la cible redevient légale au tour suivant.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const spells = parseSpellsYaml(read("spells.yaml"));

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const RNG = (): number => 0;
const MAP = parseAsciiMap([".......", ".......", "......."]);

function mustFind(id: string): SpellDef {
  const found = spells.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

/** Sort de test : 10 dégâts fixes, quotas pilotés par le cas. */
function testSpell(overrides: Partial<SpellDef> = {}): SpellDef {
  const base: SpellDef = {
    id: "test_sort",
    name: "Sort de Test",
    description: "Sort de test déterministe, quotas pilotés par le cas.",
    classId: "monster",
    kind: "damage",
    element: "neutral",
    apCost: 2,
    minRange: 1,
    maxRange: 1,
    requiresLos: true,
    damage: { min: 10, max: 10 },
  };
  return { ...base, ...overrides };
}

function combatant(overrides: Partial<CombatantLike>): CombatantLike {
  const base: CombatantLike = {
    id: "base",
    side: "enemy",
    name: "Base",
    level: 20,
    hp: 1_000,
    maxHp: 1_000,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 1, y: 0 },
    stats: { ...STATS },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    initiative: 10,
  };
  return { ...base, ...overrides };
}

const hero = (overrides: Partial<CombatantLike> = {}) =>
  combatant({ id: "player", side: "player", name: "Anselme", position: { x: 0, y: 0 }, initiative: 100, ...overrides });

const enemy = (overrides: Partial<CombatantLike> = {}) =>
  combatant({ id: "e1", name: "Yvon", position: { x: 1, y: 0 }, ...overrides });

function stateOf(combatants: readonly CombatantLike[], turn = 1): BattleState {
  return { turn, ...buildTimeline(combatants), combatants: [...combatants], log: [], map: MAP };
}

function withActive(state: BattleState, id: string): BattleState {
  return { ...state, activeIndex: Math.max(0, state.order.indexOf(id)) };
}

/** Spec d'attaque portée par le moteur, quotas compris. */
function attackOf(spell: SpellDef): AttackSpec {
  const base = { base: 10, element: "neutral" as const, apCost: spell.apCost, spellId: spell.id };
  return { ...base, castsPerTurn: spell.castsPerTurn, castsPerTarget: spell.castsPerTarget };
}

function strike(state: BattleState, targetId: string, attack: AttackSpec): BattleState {
  return resolveAttack({ state, attackerId: "e1", targetId, attack, rng: RNG });
}

function combatantIn(state: BattleState, id: string): CombatantLike {
  const found = state.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de la bataille`);
  return found;
}

function saturation(state: BattleState, key: string, targetId: string): BattleState {
  const usage = { casts: 1, turn: state.turn, readyAt: 0, castsByTarget: { [targetId]: 1 } };
  return { ...state, spellUsage: { [key]: usage } };
}

const DUO = testSpell({ id: "test_duo", apCost: 2, castsPerTurn: 2, castsPerTarget: 1 });
const PAIR = testSpell({ id: "test_pair", apCost: 2, castsPerTurn: 2, castsPerTarget: 2 });

function threeWay(): BattleState {
  const three = [enemy({ initiative: 30 }), hero({ id: "p1", initiative: 20 }), hero({ id: "p2", initiative: 10 })];
  return withActive(stateOf(three), "e1");
}

describe("castsPerTarget — moteur 1vN", () => {
  it("2e lancer sur la même cible refusé par identité, une autre cible reste légale", () => {
    const first = strike(threeWay(), "p1", attackOf(DUO));
    const second = strike(first, "p1", attackOf(DUO));
    expect(second).toBe(first);
    expect([combatantIn(second, "p1").hp, combatantIn(second, "e1").ap]).toEqual([990, 4]);
    expect(second.log).toHaveLength(first.log.length);
    const other = strike(first, "p2", attackOf(DUO));
    expect(other).not.toBe(first);
    expect(combatantIn(other, "p2").hp).toBe(990);
  });

  it("la cible saturée redevient légale au tour suivant du lanceur", () => {
    const first = strike(threeWay(), "p1", attackOf(DUO));
    const nextTurn = advanceTurn(advanceTurn(advanceTurn(first)));
    expect(nextTurn.turn).toBe(2);
    const again = strike(nextTurn, "p1", attackOf(DUO));
    expect(again).not.toBe(nextTurn);
    expect(combatantIn(again, "p1").hp).toBe(980);
  });

  it("castsPerTarget: 2 avec castsPerTurn: 2 : deux lancers sur la même cible", () => {
    const first = strike(threeWay(), "p1", attackOf(PAIR));
    const second = strike(first, "p1", attackOf(PAIR));
    expect(second).not.toBe(first);
    expect(combatantIn(second, "p1").hp).toBe(980);
  });
});

describe("castsPerTarget — champ optionnel et donnée réelle", () => {
  it("sort sans castsPerTarget : comportement inchangé et aucun état de cible", () => {
    const free = testSpell({ id: "test_libre", apCost: 2, castsPerTurn: 2 });
    const first = strike(threeWay(), "p1", attackOf(free));
    const second = strike(first, "p1", attackOf(free));
    expect(second).not.toBe(first);
    expect(combatantIn(second, "p1").hp).toBe(980);
    expect(Object.values(second.spellUsage ?? {})[0]?.castsByTarget).toBeUndefined();
  });

  it("donnée réelle `lancer_de_pieces` (sans castsPerTurn) : 3 lancers max par cible", () => {
    const pieces = mustFind("lancer_de_pieces");
    const attack = spellCastSpec(pieces, 1);
    const base = withActive(stateOf([enemy({ ap: 10, maxAp: 10, initiative: 30 }), hero({ id: "p1", initiative: 20 })]), "e1");
    const three = [1, 2, 3].reduce<BattleState>((state) => strike(state, "p1", attack), base);
    expect(combatantIn(three, "p1").hp).toBe(997);
    const fourth = strike(three, "p1", attack);
    expect(fourth).toBe(three);
    expect(combatantIn(fourth, "e1").ap).toBe(4);
  });
});

describe("IA — aucune action sélectionnée que le moteur refuserait", () => {
  const SAT = testSpell({ id: "test_sature", apCost: 2, castsPerTurn: 2, castsPerTarget: 1 });
  const FRESH = testSpell({ id: "test_frais", apCost: 3, damage: { min: 20, max: 20 }, castsPerTurn: 1 });

  it("le sort le moins cher est saturé : le monstre prend l'autre sort", () => {
    const e1 = enemy({ spellIds: [SAT.id, FRESH.id], initiative: 30 });
    const state = saturation(withActive(stateOf([hero(), e1]), "e1"), `e1:${SAT.id}`, "player");
    const next = enemiesAct({ state, rng: RNG, strategy: spellStrategy({ spells: [SAT, FRESH] }) });
    expect(combatantIn(next, "player").hp).toBe(980);
    expect(next.log.some((line) => line.includes(FRESH.name))).toBe(true);
  });

  it("seul sort saturé et hors contact : il avance au lieu de perdre son tour", () => {
    const long = testSpell({ id: "test_long", maxRange: 6, castsPerTurn: 2, castsPerTarget: 1 });
    const far = enemy({ position: { x: 5, y: 1 }, mp: 2, maxMp: 2, spellIds: [long.id], initiative: 30 });
    const state = saturation(withActive(stateOf([hero(), far]), "e1"), `e1:${long.id}`, "player");
    const next = enemiesAct({ state, rng: RNG, strategy: spellStrategy({ spells: [long] }) });
    expect(combatantIn(next, "e1").position).not.toEqual({ x: 5, y: 1 });
    expect(next.log.filter((line) => line.includes("frappe"))).toHaveLength(0);
  });
});

describe("soin 1vN — même règle par cible", () => {
  const HEAL: HealSpec = { id: "test_soin", name: "Soin", apCost: 2, min: 10, max: 10, castsPerTurn: 2, castsPerTarget: 1 };

  it("2e soin sur le même allié refusé, un autre allié reste légal", () => {
    const group = [hero({ id: "healer" }), hero({ id: "ally", hp: 950, initiative: 20 }), enemy({ initiative: 10 })];
    const base = withActive(stateOf(group), "healer");
    const first = resolveHeal({ state: base, healerId: "healer", targetId: "ally", heal: HEAL, rng: RNG });
    const second = resolveHeal({ state: first, healerId: "healer", targetId: "ally", heal: HEAL, rng: RNG });
    expect(second).toBe(first);
    expect(combatantIn(second, "ally").hp).toBe(960);
    const other = resolveHeal({ state: first, healerId: "healer", targetId: "healer", heal: HEAL, rng: RNG });
    expect(other).not.toBe(first);
  });
});

function sampleCombatant(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    id: "player",
    kind: "player",
    name: "Balthazar",
    level: 1,
    hp: 60,
    maxHp: 60,
    ap: 12,
    maxAp: 12,
    mp: 3,
    maxMp: 3,
    accuracyPct: 100,
    pp: 100,
    percentDmg: 0,
    position: { x: 0, y: 0 },
    stats: { ...STATS },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    spellIds: [],
    ...overrides,
  };
}

function combatFor(spell: SpellDef): CombatState {
  return {
    phase: "player_turn",
    turn: 1,
    map: parseAsciiMap(["..", ".."]),
    player: sampleCombatant({ ap: 12, spellIds: [spell.id] }),
    enemy: sampleCombatant({ id: "enemy", kind: "enemy", position: { x: 1, y: 0 } }),
    spellsById: { [spell.id]: spell },
    log: [],
    rewards: null,
  };
}

describe("1v1 legacy (combatLoop) — même fonction, même refus", () => {
  it("le 2e lancer du tour sur le même adversaire est refusé par identité", () => {
    const spell = testSpell({ id: "test_duo_1v1", maxRange: 9, requiresLos: false, castsPerTurn: 2, castsPerTarget: 1 });
    const base = combatFor(spell);
    const first = castSpell({ state: base, spellId: spell.id, target: base.enemy.position, rng: RNG });
    expect(first).not.toBe(base);
    expect([first.player.ap, first.enemy.hp]).toEqual([10, 50]);
    const second = castSpell({ state: first, spellId: spell.id, target: first.enemy.position, rng: RNG });
    expect(second).toBe(first);
  });
});
