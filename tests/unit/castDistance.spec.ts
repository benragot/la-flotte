import { describe, expect, it } from "vitest";
import { parseAsciiMap } from "../../src/engine/grid";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { buildTimeline, castBlock } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike, RangeSpec } from "../../src/engine/multiCombat";
import { CAST_BLOCK_LABEL, castRefusal } from "../../src/store/battleSelectors";

/**
 * « Trop proche » ≠ « hors portée ». Un héros collé à un monstre (distance 0) se
 * voyait répondre « hors portée » alors que le problème est l'inverse : le joueur
 * ne pouvait pas comprendre pourquoi son sort ne partait pas. Les deux motifs sont
 * désormais distincts dans le moteur ET dans le journal.
 */

const MAP: AsciiMap = parseAsciiMap([".......", ".......", ".......", "......."]);

/** Sort de contact du héros : bornes incluses, 1 à 3 cases, sans LoS. */
const RANGE: RangeSpec = { min: 1, max: 3, requiresLos: false };
const SPEC: AttackSpec = { base: 10, element: "earth", apCost: 3, minRange: 1, maxRange: 3 };

function makeCombatant(overrides: Partial<CombatantLike>): CombatantLike {
  return {
    id: "base",
    side: "enemy",
    name: "Base",
    level: 10,
    hp: 200,
    maxHp: 200,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { strength: 100, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
    resistances: { flat: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 }, percent: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 } },
    initiative: 50,
    ...overrides,
  };
}

/** Héros actif en (2,2), cible isolée où le test le décide. */
function stateWith(targetCell: Position): BattleState {
  const hero = makeCombatant({ id: "p1", side: "player", name: "Iop", initiative: 120, position: { x: 2, y: 2 } });
  const target = makeCombatant({ id: "e1", position: targetCell });
  const combatants = [hero, target];
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [], map: MAP };
}

function reasonFor(targetCell: Position): string | null {
  const state = stateWith(targetCell);
  const [attacker, target] = state.combatants;
  if (attacker === undefined || target === undefined) throw new Error("combattants absents");
  return castBlock({ state, attacker, target, range: RANGE });
}

describe("castBlock — distance 0", () => {
  it("renvoie « trop proche », jamais « hors portée »", () => {
    expect(reasonFor({ x: 2, y: 2 })).toBe("too-close");
  });
});

describe("castBlock — hors bornes", () => {
  it("maxRange + 1 reste « hors portée »", () => {
    expect(reasonFor({ x: 6, y: 2 })).toBe("out-of-range");
  });

  it("dans les bornes : aucun refus", () => {
    expect(reasonFor({ x: 3, y: 2 })).toBeNull();
  });
});

describe("libellé du refus", () => {
  /** Table lue par clé brute : un motif manquant doit se voir, pas se taire. */
  const LABELS: Readonly<Record<string, string>> = CAST_BLOCK_LABEL;

  it("distingue « trop proche » de « hors portée »", () => {
    expect(LABELS["too-close"]).toBe("trop proche");
    expect(LABELS["out-of-range"]).toBe("hors portée");
  });

  it("le journal dit « trop proche » pour un ennemi collé", () => {
    const state = stateWith({ x: 2, y: 2 });
    expect(castRefusal(state, "e1", SPEC)).toBe("Iop : trop proche.");
  });
});
