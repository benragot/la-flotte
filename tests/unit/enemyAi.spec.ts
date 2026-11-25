import { describe, expect, it } from "vitest";
import { monsterCombatant } from "../../src/engine/dungeon/combatants";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { parseAsciiMap, rangeDistance } from "../../src/engine/grid";
import { buildTimeline, enemiesAct, enemyStrategy } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { spellStrategy } from "../../src/store/battleSelectors";

/**
 * COMBAT-07 — les blocs `ai:` des monstres doivent changer leur jeu.
 *
 * Même carte, mêmes stats, même `rng`, même sort : seul l'`archetype` varie.
 * Les positions attendues sont des valeurs exactes, jamais des inégalités.
 */

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const MAP: AsciiMap = parseAsciiMap(["............"]);

const HERO: CombatantLike = {
  id: "player",
  side: "player",
  name: "Balthazar",
  level: 1,
  hp: 1_000,
  maxHp: 1_000,
  ap: 6,
  maxAp: 6,
  mp: 3,
  maxMp: 3,
  position: { x: 0, y: 0 },
  stats: { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
  resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
  initiative: 1,
};

function spell(minRange: number, maxRange: number): SpellDef {
  const base = {
    id: "test_trait",
    name: "Trait de Test",
    description: "Sort de test, portée pilotée par le cas.",
    classId: "monster",
    kind: "damage" as const,
    element: "neutral" as const,
    apCost: 3,
    minRange,
    maxRange,
    requiresLos: true,
    damage: { min: 10, max: 10 },
  };
  return base;
}

interface MonsterInput {
  id: string;
  mp: number;
  ai?: MonsterDef["ai"];
}

function monsterOf(input: MonsterInput): MonsterDef {
  return {
    id: input.id,
    name: input.id,
    description: "Monstre de test.",
    level: 1,
    hp: 100,
    ap: 6,
    mp: input.mp,
    stats: { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    baseXp: 1,
    isBoss: false,
    spellIds: ["test_trait"],
    loot: [],
    ...(input.ai === undefined ? {} : { ai: input.ai }),
  };
}

function withActive(state: BattleState, id: string): BattleState {
  return { ...state, activeIndex: state.order.indexOf(id) };
}

function battleOf(monster: MonsterDef, start: Position): BattleState {
  const enemy = monsterCombatant({ monster, index: 0, position: start });
  const combatants = [HERO, enemy];
  return withActive({ turn: 1, ...buildTimeline(combatants), combatants, log: [], map: MAP }, enemy.id);
}

interface PlayInput {
  monster: MonsterDef;
  start: Position;
  spells: readonly SpellDef[];
}

function play(input: PlayInput): { before: BattleState; after: BattleState } {
  const before = battleOf(input.monster, input.start);
  const strategy = spellStrategy({ spells: [...input.spells] });
  const after = enemiesAct({ state: before, rng: () => 0, strategy });
  return { before, after };
}

function positionOf(state: BattleState, id: string): Position {
  return combatantIn(state, id).position;
}

function combatantIn(state: BattleState, id: string): CombatantLike {
  const found = state.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent`);
  return found;
}

const MELEE = { archetype: "melee_rusher", preferredDistance: 4 } as const;
const SUPPORT = { archetype: "support_healer", preferredDistance: 4 } as const;

describe("COMBAT-07 — l'archetype décide du placement", () => {
  it("même stats, même sort, même rng : melee_rusher et support_healer finissent sur deux cases différentes", () => {
    const melee = play({ monster: monsterOf({ id: "ia_melee", mp: 4, ai: MELEE }), start: { x: 6, y: 0 }, spells: [spell(1, 4)] });
    const support = play({ monster: monsterOf({ id: "ia_support", mp: 4, ai: SUPPORT }), start: { x: 6, y: 0 }, spells: [spell(1, 4)] });
    expect(positionOf(melee.after, "ia_melee-0")).toEqual({ x: 2, y: 0 });
    expect(positionOf(support.after, "ia_support-0")).toEqual({ x: 4, y: 0 });
  });

  it("un monstre distance ne colle pas : il s'arrête à sa portée de sort", () => {
    const support = play({
      monster: monsterOf({ id: "ia_tireur", mp: 6, ai: SUPPORT }),
      start: { x: 8, y: 0 },
      spells: [spell(1, 3)],
    });
    const position = positionOf(support.after, "ia_tireur-0");
    expect(position).toEqual({ x: 3, y: 0 });
    expect(rangeDistance(position, HERO.position)).toBe(3);
    expect(rangeDistance(position, HERO.position)).toBeGreaterThan(1);
  });
});

describe("enemyStrategy — sélecteur pur", () => {
  it("un archétype inconnu retombe sur le contact historique", () => {
    const fallback = { preferredDistance: 1, rushes: true, aggressive: true };
    expect(enemyStrategy({ ai: { archetype: "archetype_absent" } })).toEqual(fallback);
    expect(enemyStrategy({})).toEqual(fallback);
  });

  it("les archétypes de contact partagent le même plan, le soigneur non", () => {
    const melee = enemyStrategy({ ai: { archetype: "melee_rusher" } });
    expect(enemyStrategy({ ai: { archetype: "tank_tackler" } })).toEqual(melee);
    expect(enemyStrategy({ ai: { archetype: "pusher_control" } })).toEqual(melee);
    expect(enemyStrategy({ ai: { archetype: "support_healer" } }).rushes).toBe(false);
  });
});

describe("COMBAT-07 — aucun ai ou ai incohérent", () => {
  it("un monstre sans ai garde exactement l'approche historique", () => {
    const legacy = play({ monster: monsterOf({ id: "ia_absente", mp: 4 }), start: { x: 6, y: 0 }, spells: [spell(1, 4)] });
    const melee = play({ monster: monsterOf({ id: "ia_absente", mp: 4, ai: MELEE }), start: { x: 6, y: 0 }, spells: [spell(1, 4)] });
    expect(positionOf(legacy.after, "ia_absente-0")).toEqual({ x: 2, y: 0 });
    expect(combatantIn(legacy.after, "ia_absente-0").mp).toBe(0);
    expect(positionOf(melee.after, "ia_absente-0")).toEqual(positionOf(legacy.after, "ia_absente-0"));
  });

  it("une distance préférée négative retombe sur la portée minimale du sort", () => {
    const ai = { archetype: "support_healer", preferredDistance: -4 };
    const support = play({ monster: monsterOf({ id: "ia_negative", mp: 6, ai }), start: { x: 8, y: 0 }, spells: [spell(3, 5)] });
    expect(positionOf(support.after, "ia_negative-0")).toEqual({ x: 3, y: 0 });
  });

  it("une distance préférée plus grande que la portée est ramenée au maximum du sort", () => {
    const ai = { archetype: "support_healer", preferredDistance: 9 };
    const support = play({ monster: monsterOf({ id: "ia_lointaine", mp: 6, ai }), start: { x: 8, y: 0 }, spells: [spell(1, 3)] });
    expect(positionOf(support.after, "ia_lointaine-0")).toEqual({ x: 3, y: 0 });
  });
});
