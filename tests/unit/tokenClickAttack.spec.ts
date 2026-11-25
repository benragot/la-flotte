import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MonsterGroup } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { createHero } from "../../src/engine/createHero";
import { buildTimeline } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { GridSize } from "../../src/renderer/gridProjection";
import { gridToIso, originScale, sceneOrigin } from "../../src/renderer/gridProjection";
import { cellFromPointer } from "../../src/renderer/pointer";
import type { ScreenPoint, TokenHitTarget } from "../../src/renderer/sprites/tokenHit";
import { pickToken } from "../../src/renderer/sprites/tokenHit";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * INPUT-01, bout en bout : le clic part des **coordonnées écran du sprite**,
 * passe par `pickToken`, puis suit la route du store — `battleMove` d'un combat
 * d'exploration unifié (`useCombatStore.ts:811-815`) — qui attaque une cible
 * occupée (`store/battleRouting.ts:32-37`).
 *
 * Sans hit-test, le même clic tombe sur la case derrière (assertion explicite) :
 * le héros se déplaçait au lieu d'attaquer — c'est le bogue d'`AUDIT/ISSUES.md:33`.
 */
const MAP: GridSize = { width: 8, height: 8 };
const VIEWPORT: GridSize = { width: 1024, height: 570 };
const HERO_CELL: Position = { x: 3, y: 3 };
const MONSTER_CELL: Position = { x: 4, y: 3 };
/** Écart du clic sur la tête, en px à l'échelle 1 (sous le haut de la frame). */
const HEAD_LIFT = 40;
const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const ROWS = [
  "#.......",
  "........",
  "........",
  "...P....",
  "....M...",
  "........",
  "........",
  "........",
];
const GROUP: MonsterGroup = { id: "g-1", pos: MONSTER_CELL, monsterIds: ["piou_mazoute"], totalLevel: 1, label: "Piou" };

const classes = parseClassesYaml(readFileSync(join(process.cwd(), "data", "classes.yaml"), "utf8"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function combatant(overrides: Partial<CombatantLike>): CombatantLike {
  return {
    id: "base",
    side: "enemy",
    name: "Base",
    level: 1,
    hp: 40,
    maxHp: 40,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    initiative: 10,
    ...overrides,
  };
}

function battleFixture(): BattleState {
  const hero = combatant({ id: "player", side: "player", name: "Balthazar", position: HERO_CELL, initiative: 100 });
  const monster = combatant({ id: "piou", name: "Piou Mazouté", position: MONSTER_CELL });
  const combatants = [hero, monster];
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [], map: parseAsciiMap(ROWS) };
}

function monsterTarget(): TokenHitTarget {
  const origin = sceneOrigin(MAP, VIEWPORT);
  return { id: "piou", cell: MONSTER_CELL, center: gridToIso({ ...MONSTER_CELL, origin }), scale: originScale(origin), depth: 7 };
}

function headOf(token: TokenHitTarget): ScreenPoint {
  return { x: token.center.x, y: token.center.y - HEAD_LIFT * token.scale };
}

function hpOf(state: BattleState | null, id: string): number {
  return state?.combatants.find((entry) => entry.id === id)?.hp ?? -1;
}

function cellOf(state: BattleState | null, id: string): Position | null {
  return state?.combatants.find((entry) => entry.id === id)?.position ?? null;
}

function setup(): void {
  vi.stubEnv("VITE_COMBAT_ENGINE", "unified");
  useGameStore.setState({ hero: createHero("Balthazar", mustFind(classes, "iop")) });
  useCombatStore.setState({
    mode: "combat",
    battle: battleFixture(),
    combat: null,
    exploration: null,
    activeGroup: GROUP,
    dungeonRun: null,
    selectedSpellId: null,
    rewards: null,
  });
}

beforeEach(setup);

afterEach(() => {
  vi.unstubAllEnvs();
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null, activeGroup: null });
});

describe("clic sur le sprite d'un monstre — l'attaque, jamais le déplacement", () => {
  it("la grille seule se trompe : la tête du monstre n'est pas sa case", () => {
    const token = monsterTarget();
    expect(cellFromPointer(headOf(token), { ...MAP, origin: sceneOrigin(MAP, VIEWPORT) })).not.toEqual(MONSTER_CELL);
  });

  it("le clic sur la tête du sprite déclenche l'attaque du monstre", () => {
    const token = monsterTarget();
    const before = useCombatStore.getState().battle;
    const picked = pickToken(headOf(token), [token]);
    if (picked === null) throw new Error("le sprite n'est pas visé");
    useCombatStore.getState().battleMove({ to: picked.cell, rng: () => 0.5 });
    const after = useCombatStore.getState().battle;
    expect(hpOf(after, "piou")).toBeLessThan(hpOf(before, "piou"));
    expect(cellOf(after, "player")).toEqual(HERO_CELL);
    expect((after?.log ?? []).join("\n")).not.toContain("se déplace");
  });

  it("une case vide reste un déplacement : la route n'a pas changé", () => {
    // `rng = 0` : le jet de tacle (monstre au contact) est réussi, seul le pas compte.
    useCombatStore.getState().battleMove({ to: { x: 3, y: 4 }, rng: () => 0 });
    expect(cellOf(useCombatStore.getState().battle, "player")).toEqual({ x: 3, y: 4 });
  });

  it("un clic sur un mur ne fait rien du tout", () => {
    const before = useCombatStore.getState().battle;
    useCombatStore.getState().battleMove({ to: { x: 0, y: 0 }, rng: () => 0.5 });
    expect(useCombatStore.getState().battle).toBe(before);
  });
});
