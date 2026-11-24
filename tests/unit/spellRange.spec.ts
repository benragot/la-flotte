import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap, rangeDistance } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { buildTimeline, castBlock } from "../../src/engine/multiCombat";
import type { BattleState, CastBlock, CombatantLike } from "../../src/engine/multiCombat";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

/**
 * Dofus 1.29 mesure la portée en **Chebyshev** : une diagonale adjacente vaut
 * 1, donc les huit voisins sont touchables à portée 1. Manhattan comptait la
 * diagonale 2 et faisait rater les sorts `maxRange: 1`.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const OFFSETS: readonly Position[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

const CENTER = { x: 2, y: 2 };
const MAP_1V1 = parseAsciiMap([".....", ".....", "..P..", ".....", "....."]);
/** Bec Mazouté : `minRange` = `maxRange` = 1, sans mur sur la carte de test. */
const SPELL_ID = "bec_mazoute";

describe("rangeDistance — métrique de Chebyshev", () => {
  it("compte 1 pour une diagonale adjacente", () => {
    expect(rangeDistance({ x: 0, y: 0 }, { x: 1, y: 1 })).toBe(1);
  });

  it("compte 1 pour un orthogonal adjacent", () => {
    expect(rangeDistance({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe(1);
  });

  it("compte 2 pour une diagonale à deux cases", () => {
    expect(rangeDistance({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(2);
  });
});

function combatWithEnemyAt(position: Position): CombatState {
  const hero = createHero("Balthazar", mustFind(classes, "iop"));
  const combat = initCombat({ map: MAP_1V1, hero, monster: mustFind(monsters, "piou_mazoute"), spells });
  return { ...combat, enemy: { ...combat.enemy, position } };
}

describe("getCastableCells — portée 1 en Chebyshev", () => {
  it("atteint l'ennemi sur chacune des huit cases voisines", () => {
    for (const offset of OFFSETS) {
      const position = { x: CENTER.x + offset.x, y: CENTER.y + offset.y };
      expect(getCastableCells(combatWithEnemyAt(position), SPELL_ID)).toEqual([position]);
    }
  });

  it("garde la case du caster hors portée (minRange 1)", () => {
    expect(getCastableCells(combatWithEnemyAt(CENTER), SPELL_ID)).toEqual([]);
  });
});

function combatant(overrides: Partial<CombatantLike>): CombatantLike {
  return {
    id: "base",
    side: "enemy",
    name: "Base",
    level: 1,
    hp: 10,
    maxHp: 10,
    ap: 3,
    maxAp: 3,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
    resistances: { flat: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 }, percent: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 } },
    initiative: 50,
    ...overrides,
  };
}

function battleWithTarget(cell: Position): BattleState {
  const attacker = combatant({ id: "p1", side: "player", initiative: 100, position: { x: 2, y: 2 } });
  const target = combatant({ id: "e1", position: cell });
  const combatants = [attacker, target];
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [], map: MAP_1V1 };
}

function blockAt(min: number, max: number): CastBlock | null {
  const state = battleWithTarget({ x: 3, y: 3 });
  const attacker = state.combatants.find((entry) => entry.side === "player");
  const target = state.combatants.find((entry) => entry.side === "enemy");
  if (attacker === undefined || target === undefined) throw new Error("combattants absents");
  return castBlock({ state, attacker, target, range: { min, max, requiresLos: false } });
}

describe("castBlock 1vN — cible diagonale adjacente", () => {
  it("est à portée quand maxRange vaut 1", () => {
    expect(blockAt(1, 1)).toBeNull();
  });

  it("est « trop proche » quand minRange vaut 2", () => {
    expect(blockAt(2, 3)).toBe("too-close");
  });
});
