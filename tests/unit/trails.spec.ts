import { describe, expect, it } from "vitest";
import { parseAsciiMap } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import type { CombatState } from "../../src/engine/combatLoop/types";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { battleTrails, combatTrails, nextBatch, trailsBetween } from "../../src/store/trails";

/**
 * Le rendu **ne recalcule plus** le chemin : le moteur le rend, le store le
 * transporte. Là où le moteur ne le rend pas encore (`combatLoop/move.ts`,
 * `multiCombat/approach.ts`), le store le redéduit avec **le même** `findPath` —
 * huit directions, 1 PM orthogonal et 2 PM diagonal (DEC-10), cases occupées
 * exclues.
 */
const MAP = parseAsciiMap(["...", "...", "..."]);

function mover(id: string, x: number, y: number): { id: string; position: Position } {
  return { id, position: { x, y } };
}

describe("trailsBetween — la diagonale est un seul pas", () => {
  it("rend deux cases pour une diagonale : un segment, pas deux", () => {
    const trails = trailsBetween(MAP, [mover("player", 0, 0)], [mover("player", 1, 1)]);
    expect(trails).toHaveLength(1);
    expect(trails[0]?.cells).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });

  it("ne traverse jamais une case occupée, même sur la ligne droite", () => {
    const others = [mover("player", 0, 0), mover("monster", 1, 0)];
    const trails = trailsBetween(MAP, others, [mover("player", 2, 0), mover("monster", 1, 0)]);
    const cells = trails[0]?.cells ?? [];
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 2, y: 0 });
    expect(cells.map((cell) => `${cell.x}:${cell.y}`)).not.toContain("1:0");
    expect(cells).toHaveLength(3);
  });

  it("ignore un combattant immobile et une carte inconnue", () => {
    expect(trailsBetween(MAP, [mover("player", 1, 1)], [mover("player", 1, 1)])).toEqual([]);
    expect(trailsBetween(undefined, [mover("player", 0, 0)], [mover("player", 2, 2)])).toEqual([]);
  });
});

function combatant(id: string, x: number): CombatantLike {
  const stats = { strength: 1, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
  const zeros = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
  const base = { side: "enemy" as const, name: "Piou", level: 1, hp: 10, maxHp: 10, ap: 4 };
  const pools = { maxAp: 4, mp: 3, maxMp: 3 };
  const body = { ...base, ...pools, stats, resistances: { flat: zeros, percent: zeros }, position: { x, y: 0 } };
  return { ...body, id, initiative: 10 };
}

describe("combatTrails / battleTrails — brancher les états du store", () => {
  it("lit les deux combattants du 1v1", () => {
    const before = { player: combatant("player", 0), enemy: combatant("enemy", 2), map: MAP } as unknown as CombatState;
    const after = { player: combatant("player", 1), enemy: combatant("enemy", 2), map: MAP } as unknown as CombatState;
    const trails = combatTrails(before, after);
    expect(trails.map((trail) => trail.id)).toEqual(["player"]);
    expect(trails[0]?.cells.at(-1)).toEqual({ x: 1, y: 0 });
  });

  it("lit chaque combattant d'une salle et ignore un état absent", () => {
    const battle = { combatants: [combatant("player", 0), combatant("enemy", 2)], map: MAP } as unknown as BattleState;
    const moved = { combatants: [combatant("player", 0), combatant("enemy", 1)], map: MAP } as unknown as BattleState;
    expect(battleTrails(battle, moved).map((trail) => trail.id)).toEqual(["enemy"]);
    expect(battleTrails(null, battle)).toEqual([]);
    expect(battleTrails(battle, null)).toEqual([]);
  });
});

describe("nextBatch — une clé de rejeu par mouvement", () => {
  it("incrémente la version à chaque trajet, même identique", () => {
    const trail = { id: "player", cells: [mover("player", 0, 0).position, mover("player", 1, 0).position] };
    const first = nextBatch({ version: 0, trails: [] }, [trail]);
    const second = nextBatch(first, [trail]);
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
  });

  it("conserve le lot courant quand rien n'a bougé", () => {
    const batch = { version: 4, trails: [] };
    expect(nextBatch(batch, [])).toBe(batch);
  });
});
