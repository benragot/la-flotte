import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildViewModel } from "../../src/renderer/combatSceneModel";
import { MOVE_HIGHLIGHT, resolveTileStyle } from "../../src/renderer/tileStyle";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));

const VIEWPORT = { width: 1024, height: 768 };

/**
 * 5×5 ouverte, tout praticable : héros (2,1) à **3 PM**, monstre (4,4) à **4 PM**.
 * Avec DEC-10 un pas coûte sa distance de Manhattan (1 ortho, 2 diag), donc les
 * zones attendues sont les cases à distance ≤ PM, moins les cases occupées.
 */
const ARENA = [".....", "..P..", ".....", ".....", "....M"];

/** 18 cases autour de (2,1) : d = 1, 2 puis 3. */
const HERO_ZONE = [
  "0:0", "0:1", "0:2",
  "1:0", "1:1", "1:2", "1:3",
  "2:0", "2:2", "2:3", "2:4",
  "3:0", "3:1", "3:2", "3:3",
  "4:0", "4:1", "4:2",
];

/** 14 cases autour de (4,4) : d = 1 à 4. */
const ENEMY_ZONE = [
  "0:4",
  "1:3", "1:4",
  "2:2", "2:3", "2:4",
  "3:1", "3:2", "3:3", "3:4",
  "4:0", "4:1", "4:2", "4:3",
];

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

function buildCombat(): CombatState {
  return initCombat({
    map: parseAsciiMap([...ARENA]),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "piou_mazoute"),
    spells,
  });
}

interface ZoneInput {
  combat: CombatState;
  hoveredCell: { x: number; y: number } | null;
  modifierHeld?: boolean;
}

/** Les cases effectivement peintes, triées : la preuve est la liste, pas un compte. */
function zoneKeys(input: ZoneInput): string[] {
  const { combat, hoveredCell, modifierHeld } = input;
  const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell, viewport: VIEWPORT, modifierHeld });
  return view.scene.highlights.map((tile) => `${tile.position.x}:${tile.position.y}`).sort();
}

describe("zone PM — R1/R8, jamais permanente", () => {
  it("n'affiche aucune case sans survol", () => {
    const combat = buildCombat();
    expect(getReachableCells(combat)).toHaveLength(18);
    expect(zoneKeys({ combat, hoveredCell: null })).toEqual([]);
  });

  it("affiche la zone du héros au survol de sa case (DEC-10 : diagonale 2 PM)", () => {
    const combat = buildCombat();
    expect(zoneKeys({ combat, hoveredCell: combat.player.position })).toEqual(HERO_ZONE);
  });

  it("n'affiche rien au survol d'une case vide", () => {
    expect(zoneKeys({ combat: buildCombat(), hoveredCell: { x: 0, y: 0 } })).toEqual([]);
  });

  it("affiche la zone de l'ennemi au survol de son jeton (R8)", () => {
    const combat = buildCombat();
    expect(zoneKeys({ combat, hoveredCell: combat.enemy.position })).toEqual(ENEMY_ZONE);
  });

  it("affiche la zone du héros quand Maj est maintenu, sans survol", () => {
    expect(zoneKeys({ combat: buildCombat(), hoveredCell: null, modifierHeld: true })).toEqual(HERO_ZONE);
  });

  it("n'affiche rien quand le héros n'a plus de PM", () => {
    const base = buildCombat();
    const combat = { ...base, player: { ...base.player, mp: 0 } };
    expect(zoneKeys({ combat, hoveredCell: combat.player.position })).toEqual([]);
  });

  it("n'affiche pas la zone du héros hors de son tour, Maj compris", () => {
    const combat: CombatState = { ...buildCombat(), phase: "enemy_turn" };
    expect(zoneKeys({ combat, hoveredCell: combat.player.position, modifierHeld: true })).toEqual([]);
  });
});

describe("zone PM — surfaces §3.2", () => {
  it("peint la zone en vert Air α 0.18 et son contour α 0.35", () => {
    const style = resolveTileStyle({ cell: ".", isMoveCell: true, isCastCell: false, isHovered: false });
    expect(MOVE_HIGHLIGHT).toBe(0x3fae6a);
    expect(style.fill).toBe(MOVE_HIGHLIGHT);
    expect(style.alpha).toBe(0.18);
    expect(style.stroke).toBe(MOVE_HIGHLIGHT);
    expect(style.strokeAlpha).toBe(0.35);
  });
});
