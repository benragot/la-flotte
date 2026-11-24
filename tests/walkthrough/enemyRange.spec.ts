import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CombatState } from "../../src/engine/combatLoop";
import { initExploration } from "../../src/engine/exploration";
import type { Position } from "../../src/engine/grid";
import { parseAsciiMap } from "../../src/engine/grid";
import type { MapDef } from "../../src/schemas/mapSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * WALKTHROUGH — « l'Écrou-Baton ne vient pas coller » (COMBAT-08).
 *
 * CE QUE CE FICHIER PROUVE : sur la vraie Cale aux Serments, un Écrou-Baton lu
 * dans `data/monsters.yaml` (`spellIds = [contact 1 case, Lancer d'Écrou 2–4]`)
 * engagé par un héros immobile tire son sort à distance et ne descend JAMAIS au
 * contact : le journal ne contient que « Lancer d'Écrou », et chaque perte de PV
 * du héros survient à deux cases ou plus.
 *
 * CE QU'IL NE PROUVE PAS : le rendu, ni la fin du combat côté héros (nu, il perd).
 */
const maps = parseMapsYaml(readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8"));
const monsters = parseMonstersYaml(readFileSync(join(process.cwd(), "data", "monsters.yaml"), "utf8"));

const CALE = "ferraille_cale_03";
const MAX_ENEMY_TURNS = 8;

function mapById(id: string): MapDef {
  const found = maps.find((map) => map.id === id);
  if (found === undefined) throw new Error(`${id} absente de data/maps.yaml`);
  return found;
}

function boulon(): MonsterDef {
  const found = monsters.find((monster) => monster.id === "fer_boulon_pousseur");
  if (found === undefined) throw new Error("fer_boulon_pousseur absent de data/monsters.yaml");
  return found;
}

/** Cale aux Serments peuplée du seul Écrou-Baton, héros sur son `P`. */
function startAtCale(): void {
  const map = mapById(CALE);
  const monster = boulon();
  useCombatStore.setState({
    mapId: CALE,
    mode: "exploration",
    exploration: initExploration({
      map: parseAsciiMap(map.grid),
      monsterId: monster.id,
      monsterName: monster.name,
      level: monster.level,
    }),
    combat: null,
    battle: null,
    dungeonRun: null,
    hoveredCell: null,
  });
}

function storeCombat(): CombatState {
  const { combat } = useCombatStore.getState();
  if (combat === null) throw new Error("combat attendu");
  return combat;
}

function gapOf(state: CombatState): number {
  const from = state.enemy.position;
  const to = state.player.position;
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

function groupCell(): Position {
  const { exploration } = useCombatStore.getState();
  const group = exploration?.monsterGroups[0];
  if (group === undefined) throw new Error("groupe attendu sur la Cale aux Serments");
  return group.pos;
}

/** Un tour joueur passé : l'IA ennemie joue, on relève la distance de tir. */
function endTurnAndMeasure(): { damaged: boolean; gap: number; hp: number } {
  const before = storeCombat();
  useCombatStore.getState().endTurn();
  const after = storeCombat();
  return { damaged: after.player.hp < before.player.hp, gap: gapOf(after), hp: after.player.hp };
}

function shotGaps(): number[] {
  const gaps: number[] = [];
  for (let turn = 0; turn < MAX_ENEMY_TURNS && storeCombat().phase === "player_turn"; turn += 1) {
    const round = endTurnAndMeasure();
    if (round.damaged) gaps.push(round.gap);
  }
  return gaps;
}

describe("walkthrough — l'IA ennemie respecte la portée de ses sorts", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
    vi.spyOn(Math, "random").mockReturnValue(0);
    startAtCale();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tire Lancer d'Écrou à distance sans jamais venir au contact", () => {
    useCombatStore.getState().clickCell(groupCell());
    expect(storeCombat().enemy.name).toBe(boulon().name);
    const gaps = shotGaps();
    const log = storeCombat().log.join("\n");
    expect(log).toContain("Lancer d'Écrou");
    expect(log).not.toContain("Coup de Tête Fileté");
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(2);
  });
});
