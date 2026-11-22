import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap, samePosition } from "../../src/engine/grid";
import { isApplicationAlive } from "../../src/renderer/appLifecycle";
import { buildViewModel } from "../../src/renderer/combatSceneModel";
import { gridToPixel, gridToScreenOrigin } from "../../src/renderer/gridProjection";
import { buildSceneModel } from "../../src/renderer/scene";
import { CAST_HIGHLIGHT, HOVER_STROKE } from "../../src/renderer/tileStyle";
import { ENEMY_TOKEN_COLOR, PLAYER_TOKEN_COLOR, tokenView } from "../../src/renderer/tokens";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

// Le cycle de vie complet d'une Application PixiJS (WebGL, resize, destroy) n'est
// pas testable en node : ce fichier couvre le view model pur + le garde `null`.
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

function demoMap() {
  return parseAsciiMap(mustFind(maps, "ferraille_plage_01").grid);
}

function buildState(): CombatState {
  return initCombat({
    map: demoMap(),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "piou_mazoute"),
    spells,
  });
}

const EMPTY_HIGHLIGHT = { move: new Set<string>(), cast: new Set<string>(), hover: null };

describe("buildSceneModel — tuiles", () => {
  it("produit une tuile par case et aucune surbrillance par défaut", () => {
    const model = buildSceneModel({ map: demoMap(), highlight: EMPTY_HIGHLIGHT });
    expect(model.tiles).toHaveLength(144);
    expect(model.highlights).toHaveLength(0);
  });

  it("priorise le ciblage du sort sur le déplacement pour une même case", () => {
    const highlight = { move: new Set(["1:1"]), cast: new Set(["1:1"]), hover: null };
    const model = buildSceneModel({ map: demoMap(), highlight });
    expect(model.highlights).toHaveLength(1);
    expect(model.highlights[0]?.style.fill).toBe(CAST_HIGHLIGHT);
  });

  it("ajoute le contour de survol sans créer de surbrillance", () => {
    const model = buildSceneModel({ map: demoMap(), highlight: { ...EMPTY_HIGHLIGHT, hover: "2:2" } });
    const hovered = model.tiles.filter((tile) => tile.style.stroke === HOVER_STROKE);
    expect(model.highlights).toHaveLength(0);
    expect(hovered).toHaveLength(1);
    expect(hovered[0]?.origin).toEqual(gridToScreenOrigin({ x: 2, y: 2 }));
  });
});

describe("buildViewModel — surbrillances", () => {
  it("surligne les cases atteignables pendant le tour du joueur", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null });
    expect(getReachableCells(combat).length).toBeGreaterThan(0);
    expect(view.scene.highlights).toHaveLength(getReachableCells(combat).length);
  });

  it("ne surligne aucune case de déplacement hors du tour du joueur", () => {
    const combat: CombatState = { ...buildState(), phase: "enemy_turn" };
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null });
    expect(view.scene.highlights).toHaveLength(0);
  });

  it("surligne les cases ciblables par le sort sélectionné", () => {
    const combat = buildState();
    const cells = getCastableCells(combat, "bond");
    const view = buildViewModel({ combat, selectedSpellId: "bond", hoveredCell: null });
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((cell) => {
      const tile = view.scene.highlights.find((item) => samePosition(item.origin, gridToScreenOrigin(cell)));
      expect(tile?.style.fill).toBe(CAST_HIGHLIGHT);
    });
  });

  it("propage le survol jusqu'aux tuiles", () => {
    const view = buildViewModel({ combat: buildState(), selectedSpellId: null, hoveredCell: { x: 4, y: 4 } });
    const hovered = view.scene.tiles.filter((tile) => tile.style.stroke === HOVER_STROKE);
    expect(hovered).toHaveLength(1);
    expect(hovered[0]?.origin).toEqual(gridToScreenOrigin({ x: 4, y: 4 }));
  });
});

describe("buildViewModel — jetons", () => {
  it("expose exactement deux jetons, héros bleu et monstre rouge", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null });
    expect(view.tokens).toHaveLength(2);
    expect(view.tokens[0]?.fill).toBe(PLAYER_TOKEN_COLOR);
    expect(view.tokens[1]?.fill).toBe(ENEMY_TOKEN_COLOR);
  });

  it("centre les jetons et borne leur ratio de PV", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null });
    expect(view.tokens[0]?.center).toEqual(gridToPixel(combat.player.position));
    expect(view.tokens[1]?.center).toEqual(gridToPixel(combat.enemy.position));
    view.tokens.forEach((token) => {
      expect(token.hpRatio).toBeGreaterThanOrEqual(0);
      expect(token.hpRatio).toBeLessThanOrEqual(1);
    });
  });
});

describe("tokenView — bornes de PV", () => {
  it("retombe à zéro quand maxHp est nul", () => {
    expect(tokenView({ ...buildState().player, hp: 5, maxHp: 0 }).hpRatio).toBe(0);
  });

  it("plafonne le ratio quand les PV dépassent le maximum", () => {
    expect(tokenView({ ...buildState().player, hp: 999_999, maxHp: 100 }).hpRatio).toBe(1);
  });
});

describe("garde d'application PixiJS détruite", () => {
  it("considère vivante une application qui a renderer et stage", () => {
    expect(isApplicationAlive({ renderer: {}, stage: {} })).toBe(true);
  });

  it("refuse une application détruite (renderer et stage à null)", () => {
    expect(isApplicationAlive({ renderer: null, stage: null })).toBe(false);
  });

  it("refuse l'absence d'application", () => {
    expect(isApplicationAlive(null)).toBe(false);
  });
});
