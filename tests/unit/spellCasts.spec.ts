import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildTimeline, enemiesAct } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike, EnemyStrategy } from "../../src/engine/multiCombat";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { playEnemyTurns, spellStrategy } from "../../src/store/battleSelectors";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const spells = parseSpellsYaml(read("spells.yaml"));
const YVON_SPELL = mustFind(spells, "fer_spell_clef_a_choc");

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const RNG = (): number => 0;
const MAP = parseAsciiMap([".......", ".......", "......."]);

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

/** Sort de test : 3 PA, 10 dégâts fixes, quota déclaré par l'appelant. */
function testSpell(overrides: Partial<SpellDef> = {}): SpellDef {
  const base: SpellDef = {
    id: "test_clef",
    name: "Clef de Test",
    description: "Sort de test, quota piloté par le cas.",
    classId: "monster",
    kind: "damage",
    element: "neutral",
    apCost: 3,
    minRange: 1,
    maxRange: 1,
    requiresLos: true,
    damage: { min: 10, max: 10 },
    castsPerTurn: 1,
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
  combatant({ id: "e1", name: "Yvon", position: { x: 1, y: 0 }, spellIds: ["test_clef"], ...overrides });

function stateOf(combatants: readonly CombatantLike[], turn = 1): BattleState {
  return { turn, ...buildTimeline(combatants), combatants: [...combatants], log: [], map: MAP };
}

function withActive(state: BattleState, id: string): BattleState {
  return { ...state, activeIndex: Math.max(0, state.order.indexOf(id)) };
}

const strategy = (spell: SpellDef): EnemyStrategy => spellStrategy({ spells: [spell], rng: RNG });

/** Coups réellement portés : le journal du moteur est l'arbitre, pas le test. */
function hits(state: BattleState): number {
  return state.log.filter((line) => line.includes("frappe")).length;
}

function enemyTurn(state: BattleState, spell: SpellDef): BattleState {
  return playEnemyTurns({ state, strategyFor: () => strategy(spell), rng: RNG });
}

function usageCasts(state: BattleState): number[] {
  return Object.values(state.spellUsage ?? {}).map((usage) => usage.casts);
}

describe("castsPerTurn — quota par tour honoré", () => {
  it("un monstre 6 PA avec un sort 3 PA et castsPerTurn: 1 ne frappe qu'UNE fois", () => {
    const spell = testSpell();
    const base = withActive(stateOf([hero(), enemy()]), "e1");
    const next = enemiesAct({ state: base, rng: RNG, strategy: strategy(spell) });
    expect(hits(next)).toBe(1);
    expect(next.combatants.find((entry) => entry.id === "player")?.hp).toBe(990);
  });

  it("Yvon Rouiller (donnée réelle) frappe une fois, pas deux", () => {
    const yvon = enemy({ name: "Yvon Rouiller", spellIds: [YVON_SPELL.id] });
    const base = withActive(stateOf([hero(), yvon]), "e1");
    const next = enemiesAct({ state: base, rng: RNG, strategy: strategy(YVON_SPELL) });
    expect(hits(next)).toBe(1);
  });
});

describe("cooldown — recharge portée par la bataille", () => {
  it("cooldown: 2 rend le sort indisponible les 2 tours suivants, puis le rend", () => {
    const spell = testSpell({ cooldown: 2, castsPerTurn: 1 });
    const turn1 = enemyTurn(stateOf([hero(), enemy()]), spell);
    const turn2 = enemyTurn(turn1, spell);
    const turn3 = enemyTurn(turn2, spell);
    const turn4 = enemyTurn(turn3, spell);
    expect([hits(turn1), hits(turn2), hits(turn3), hits(turn4)]).toEqual([1, 1, 1, 2]);
  });
});

describe("état remis à zéro au nouveau tour", () => {
  it("castsPerTurn: 1 repart à zéro chaque tour, sans cumul", () => {
    const spell = testSpell();
    const turn1 = enemyTurn(stateOf([hero(), enemy()]), spell);
    const turn2 = enemyTurn(turn1, spell);
    expect([hits(turn1), hits(turn2)]).toEqual([1, 2]);
    expect(usageCasts(turn2)).toEqual([1]);
  });

  it("un combat neuf (salle suivante) ne récupère aucun compteur", () => {
    const spell = testSpell({ cooldown: 2 });
    const played = enemyTurn(stateOf([hero(), enemy()]), spell);
    const fresh = stateOf([hero(), enemy()]);
    expect(played.spellUsage).toBeDefined();
    expect(fresh.spellUsage).toBeUndefined();
    expect(hits(enemyTurn(fresh, spell))).toBe(1);
  });
});

describe("aucun tour perdu silencieux", () => {
  /** Sort trop cher pour ses 6 PA : aucun sort n'est lançable ce tour. */
  const HEAVY = testSpell({ apCost: 10 });

  it("sans sort lançable le monstre SE DÉPLACE au lieu de boucler", () => {
    const far = enemy({ position: { x: 5, y: 1 }, mp: 2, maxMp: 2 });
    const base = withActive(stateOf([hero(), far]), "e1");
    const next = enemiesAct({ state: base, rng: RNG, strategy: strategy(HEAVY) });
    const moved = next.combatants.find((entry) => entry.id === "e1");
    expect(moved?.position).not.toEqual(far.position);
    expect(next.log.some((line) => line.includes("se déplace"))).toBe(true);
  });

  it("coincé, il PASSE en le disant au journal (aucune boucle)", () => {
    const stuck = enemy({ mp: 0, maxMp: 0 });
    const base = withActive(stateOf([hero(), stuck]), "e1");
    const next = enemiesAct({ state: base, rng: RNG, strategy: strategy(HEAVY) });
    expect(hits(next)).toBe(0);
    expect(next.log.some((line) => line.includes("ne peut pas atteindre"))).toBe(true);
  });
});
