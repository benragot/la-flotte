import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import { moveActiveEntity } from "../../src/engine/combatLoop/move";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import { endPlayerTurn } from "../../src/engine/combatLoop/turn";
import type { CombatState, Rng } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import type { Hero } from "../../src/engine/createHero";
import { parseAsciiMap, samePosition } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

const CLASSES_PATH = join(process.cwd(), "data", "classes.yaml");
const loadIop = () => {
  const classes = parseClassesYaml(readFileSync(CLASSES_PATH, "utf8"));
  return classes.find((entry) => entry.id === "iop");
};

const MAX_TURNS = 40;
const DEMO_MAP_ID = "ferraille_plage_01";
const DEMO_MONSTER_ID = "piou_mazoute";
const PLAYER_SPELL_ID = "pression";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");

function findById<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const loadCombatData = () => ({
  map: parseAsciiMap(findById(parseMapsYaml(read("maps.yaml")), DEMO_MAP_ID).grid),
  monster: findById(parseMonstersYaml(read("monsters.yaml")), DEMO_MONSTER_ID),
  spells: parseSpellsYaml(read("spells.yaml")),
  progression: parseProgressionYaml(read("progression.yaml")),
});

const distance = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const closest = (target: Position) => (best: Position | null, cell: Position) =>
  best === null || distance(cell, target) < distance(best, target) ? cell : best;

function attackOnce(state: CombatState, rng: Rng): CombatState {
  const target = state.enemy.position;
  const inRange = getCastableCells(state, PLAYER_SPELL_ID).some((cell) => samePosition(cell, target));
  if (!inRange) return state;
  return castSpell({ state, spellId: PLAYER_SPELL_ID, target, rng });
}

function castAll(state: CombatState, rng: Rng): CombatState {
  let current = state;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const next = attackOnce(current, rng);
    if (next === current) return current;
    current = next;
  }
  return current;
}

function stepCloser(state: CombatState): CombatState {
  const target = state.enemy.position;
  const reach = distance(state.player.position, target);
  const better = getReachableCells(state).filter((cell) => distance(cell, target) < reach);
  const best = better.reduce<Position | null>(closest(target), null);
  return best === null ? state : moveActiveEntity(state, best);
}

const playTurn = (state: CombatState, rng: Rng): CombatState => castAll(stepCloser(state), rng);

function runScenario(state: CombatState, rng: Rng): CombatState {
  let current = state;
  for (let turn = 0; turn < MAX_TURNS && current.phase !== "victory" && current.phase !== "defeat"; turn += 1) {
    current = playTurn(current, rng);
    if (current.phase === "victory") break;
    current = endPlayerTurn(current, rng);
  }
  return current;
}

function startScenario(): { state: CombatState; hero: Hero; data: ReturnType<typeof loadCombatData> } {
  const iop = loadIop();
  if (iop === undefined) throw new Error("Classe iop absente de classes.yaml");
  const data = loadCombatData();
  const hero = createHero("Balthazar", iop);
  return { state: initCombat({ map: data.map, hero, monster: data.monster, spells: data.spells }), hero, data };
}

describe("walkthrough : progression", () => {
  it("charge classes.yaml et trouve la classe Iop", () => {
    expect(loadIop()).toBeDefined();
  });

  it("crée un personnage Iop niveau 1 avec ses stats de départ", () => {
    const iop = loadIop();
    if (!iop) throw new Error("Classe iop absente de classes.yaml");
    const hero = createHero("Balthazar", iop);
    expect(hero.level).toBe(1);
    expect(hero.ap).toBe(6);
    expect(hero.mp).toBe(3);
    expect(hero.hp).toBe(50);
    expect(hero.pp).toBe(100);
  });

  it("joue un combat complet jusqu'à la victoire et la montée de niveau", () => {
    const { state, data } = startScenario();
    const final = runScenario(state, () => 0.5);
    expect(final.turn).toBeLessThanOrEqual(MAX_TURNS);
    expect(final.phase).toBe("victory");
    const rewards = resolveCombatRewards({
      heroXp: 0,
      hero: final.player,
      monster: data.monster,
      progression: data.progression,
      rng: () => 0,
    });
    expect(rewards.xpGained).toBe(120);
    expect(rewards.level).toBe(2);
    expect(rewards.levelUp).toEqual({ hp: 5, capitalPoints: 5, spellPoints: 1 });
    expect(rewards.drops).toEqual(["plume_mazoutee"]);
  });
});
