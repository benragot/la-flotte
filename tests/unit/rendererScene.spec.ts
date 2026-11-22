import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import { moveActiveEntity } from "../../src/engine/combatLoop/move";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap, samePosition } from "../../src/engine/grid";
import { isApplicationAlive } from "../../src/renderer/appLifecycle";
import { buildViewModel, lastActionFrom } from "../../src/renderer/combatSceneModel";
import { buildExplorationViewModel, explorationMapSize } from "../../src/renderer/explorationScene";
import { gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import { buildSceneModel } from "../../src/renderer/scene";
import { CAST_HIGHLIGHT, HOVER_STROKE } from "../../src/renderer/tileStyle";
import {
  ENEMY_TOKEN_COLOR,
  PLAYER_TOKEN_COLOR,
  facingToward,
  tokenView,
} from "../../src/renderer/tokens";
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

const VIEWPORT = { width: 1024, height: 768 };
const MAP_SIZE = { width: 12, height: 12 };
const ORIGIN = sceneOrigin(MAP_SIZE, VIEWPORT);

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
    const model = buildSceneModel({ map: demoMap(), highlight: EMPTY_HIGHLIGHT, origin: ORIGIN });
    expect(model.tiles).toHaveLength(144);
    expect(model.highlights).toHaveLength(0);
  });

  it("dessine chaque case comme un losange de quatre sommets", () => {
    const model = buildSceneModel({ map: demoMap(), highlight: EMPTY_HIGHLIGHT, origin: ORIGIN });
    model.tiles.forEach((tile) => {
      expect(tile.points).toHaveLength(8);
      expect(tile.cell).toBeDefined();
    });
    expect(model.tiles[0]?.center).toEqual(gridToIso({ x: 0, y: 0, origin: ORIGIN }));
  });

  it("trie les tuiles par profondeur x + y croissante (ordre peintre)", () => {
    const model = buildSceneModel({ map: demoMap(), highlight: EMPTY_HIGHLIGHT, origin: ORIGIN });
    const indexOf = (cell: { x: number; y: number }) =>
      model.tiles.findIndex((tile) => samePosition(tile.center, gridToIso({ ...cell, origin: ORIGIN })));
    expect(indexOf({ x: 0, y: 0 })).toBeLessThan(indexOf({ x: 1, y: 0 }));
    expect(indexOf({ x: 1, y: 0 })).toBeLessThan(indexOf({ x: 1, y: 1 }));
    expect(indexOf({ x: 0, y: 11 })).toBeLessThan(indexOf({ x: 11, y: 11 }));
  });
});

describe("buildSceneModel — surbrillances", () => {
  it("priorise le ciblage du sort sur le déplacement pour une même case", () => {
    const highlight = { move: new Set(["1:1"]), cast: new Set(["1:1"]), hover: null };
    const model = buildSceneModel({ map: demoMap(), highlight, origin: ORIGIN });
    expect(model.highlights).toHaveLength(1);
    expect(model.highlights[0]?.style.fill).toBe(CAST_HIGHLIGHT);
  });

  it("ajoute le contour de survol sans créer de surbrillance", () => {
    const model = buildSceneModel({ map: demoMap(), highlight: { ...EMPTY_HIGHLIGHT, hover: "2:2" }, origin: ORIGIN });
    const hovered = model.tiles.filter((tile) => tile.style.stroke === HOVER_STROKE);
    expect(model.highlights).toHaveLength(0);
    expect(hovered).toHaveLength(1);
    expect(hovered[0]?.center).toEqual(gridToIso({ x: 2, y: 2, origin: ORIGIN }));
  });
});

describe("buildViewModel — surbrillances", () => {
  it("surligne les cases atteignables pendant le tour du joueur", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(getReachableCells(combat).length).toBeGreaterThan(0);
    expect(view.scene.highlights).toHaveLength(getReachableCells(combat).length);
  });

  it("ne surligne aucune case de déplacement hors du tour du joueur", () => {
    const combat: CombatState = { ...buildState(), phase: "enemy_turn" };
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.scene.highlights).toHaveLength(0);
  });

  it("surligne les cases ciblables par le sort sélectionné", () => {
    const combat = buildState();
    const cells = getCastableCells(combat, "bond");
    const view = buildViewModel({ combat, selectedSpellId: "bond", hoveredCell: null, viewport: VIEWPORT });
    expect(cells.length).toBeGreaterThan(0);
    cells.forEach((cell) => {
      const center = gridToIso({ ...cell, origin: ORIGIN });
      const tile = view.scene.highlights.find((item) => samePosition(item.center, center));
      expect(tile?.style.fill).toBe(CAST_HIGHLIGHT);
    });
  });

  it("propage le survol jusqu'aux tuiles", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: { x: 4, y: 4 }, viewport: VIEWPORT });
    const hovered = view.scene.tiles.filter((tile) => tile.style.stroke === HOVER_STROKE);
    expect(hovered).toHaveLength(1);
    expect(hovered[0]?.center).toEqual(gridToIso({ x: 4, y: 4, origin: ORIGIN }));
  });

  it("ne dessine aucun chemin A* en mode combat", () => {
    const view = buildViewModel({ combat: buildState(), selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.path).toHaveLength(0);
  });
});

describe("buildViewModel — jetons", () => {
  it("expose exactement deux jetons, héros bleu et monstre rouge", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.tokens).toHaveLength(2);
    expect(view.tokens[0]?.fill).toBe(PLAYER_TOKEN_COLOR);
    expect(view.tokens[1]?.fill).toBe(ENEMY_TOKEN_COLOR);
    expect(view.tokens[0]?.badge).toBeNull();
  });

  it("centre les jetons sur leur losange et borne leur ratio de PV", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.tokens[0]?.center).toEqual(gridToIso({ ...combat.player.position, origin: ORIGIN }));
    expect(view.tokens[1]?.center).toEqual(gridToIso({ ...combat.enemy.position, origin: ORIGIN }));
    view.tokens.forEach((token) => {
      expect(token.hpRatio).toBeGreaterThanOrEqual(0);
      expect(token.hpRatio).toBeLessThanOrEqual(1);
    });
  });
});

describe("buildViewModel — sprite des combattants", () => {
  it("associe la classe du héros et l'identifiant du monstre aux jetons", () => {
    const view = buildViewModel({ combat: buildState(), selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.tokens[0]?.spriteId).toBe("iop");
    expect(view.tokens[1]?.spriteId).toBe("piou_mazoute");
  });

  it("oriente chaque combattant vers l'adversaire", () => {
    const combat = buildState();
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.tokens[0]?.facing).toBe(facingToward(combat.player.position, combat.enemy.position));
    expect(view.tokens[1]?.facing).toBe(facingToward(combat.enemy.position, combat.player.position));
  });

  it("joue idle à l'ouverture du combat", () => {
    const view = buildViewModel({ combat: buildState(), selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.tokens.map((token) => token.animation)).toEqual(["idle", "idle"]);
    expect(view.lastAction).toBeNull();
  });

  it("laisse les jetons sans sprite en repli géométrique", () => {
    const token = tokenView(buildState().player, ORIGIN);
    expect(token.spriteId).toBeNull();
    expect(token.animationKey).toBe("static");
  });
});

describe("buildViewModel — actions dérivées du journal", () => {
  it("fait jouer attack au lanceur et hit à la cible", () => {
    const base = buildState();
    const adjacent: CombatState = { ...base, enemy: { ...base.enemy, position: { x: 4, y: 3 } } };
    const combat = castSpell({ state: adjacent, spellId: "pression", target: adjacent.enemy.position, rng: () => 0 });
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.lastAction).toMatchObject({ kind: "cast", actor: "player" });
    expect(view.tokens[0]?.animation).toBe("attack");
    expect(view.tokens[1]?.animation).toBe("hit");
    expect(view.tokens[0]?.animationKey).toBe(view.lastAction?.signature);
  });

  it("fait jouer walk au combattant qui se déplace", () => {
    const base = buildState();
    const target = getReachableCells(base)[0];
    const combat = target === undefined ? base : moveActiveEntity(base, target);
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.lastAction).toMatchObject({ kind: "move", actor: "player" });
    expect(view.tokens[0]?.animation).toBe("walk");
    expect(view.tokens[1]?.animation).toBe("idle");
  });

  it("attribue attaque et touche à l'ennemi quand c'est lui qui agit", () => {
    const base = buildState();
    const line = `${base.enemy.name} lance Bec Mazouté : 6 dégâts.`;
    const combat: CombatState = { ...base, log: [...base.log, line] };
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.lastAction).toMatchObject({ kind: "cast", actor: "enemy" });
    expect(view.tokens.map((token) => token.animation)).toEqual(["hit", "attack"]);
  });
});

describe("lastActionFrom — heuristique du journal", () => {
  const combat = buildState();
  const withLog = (line: string): CombatState => ({ ...combat, log: [...combat.log, line] });

  it("ignore une ligne qui n'est pas une action", () => {
    expect(lastActionFrom(withLog(`${combat.player.name} affronte ${combat.enemy.name}.`))).toBeNull();
    expect(lastActionFrom({ ...combat, log: [] })).toBeNull();
  });

  it("classe un sort comme cast et un déplacement comme move", () => {
    expect(lastActionFrom(withLog(`${combat.player.name} lance Pression : 9 dégâts.`))).toMatchObject({ kind: "cast" });
    expect(lastActionFrom(withLog(`${combat.player.name} se déplace de 2 case(s).`))).toMatchObject({ kind: "move" });
    expect(lastActionFrom(withLog(`${combat.player.name} se téléporte.`))).toMatchObject({ kind: "cast" });
  });

  it("attribue l'acteur par le préfixe de la ligne", () => {
    const player = lastActionFrom(withLog(`${combat.player.name} se déplace de 1 case(s).`));
    const enemy = lastActionFrom(withLog(`${combat.enemy.name} se déplace de 1 case(s).`));
    expect(player?.actor).toBe("player");
    expect(enemy?.actor).toBe("enemy");
  });

  it("ne retient que la dernière ligne du journal", () => {
    const first = `${combat.player.name} se déplace de 1 case(s).`;
    const action = lastActionFrom({ ...combat, log: [...combat.log, first, `${combat.player.name} lance Pression.`] });
    expect(action).toMatchObject({ kind: "cast", actor: "player" });
  });

  it("change de signature quand le journal grandit", () => {
    const line = `${combat.player.name} se déplace de 1 case(s).`;
    const before = lastActionFrom(withLog(line));
    const after = lastActionFrom({ ...withLog(line), log: [...withLog(line).log, line] });
    expect(before?.signature).not.toBe(after?.signature);
  });
});

describe("tokenView — bornes de PV", () => {
  it("retombe à zéro quand maxHp est nul", () => {
    const token = tokenView({ ...buildState().player, hp: 5, maxHp: 0 }, ORIGIN);
    expect(token.hpRatio).toBe(0);
  });

  it("plafonne le ratio quand les PV dépassent le maximum", () => {
    const token = tokenView({ ...buildState().player, hp: 999_999, maxHp: 100 }, ORIGIN);
    expect(token.hpRatio).toBe(1);
  });
});

describe("exploration — héros, groupes et chemin A*", () => {
  const exploration = {
    playerPos: { x: 2, y: 3 },
    groups: [{ pos: { x: 5, y: 5 }, label: "Piou mazouté", totalLevel: 7 }],
    path: [
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ],
  };

  it("dimensionne la carte d'exploration sur la case la plus lointaine", () => {
    expect(explorationMapSize(exploration)).toEqual({ width: 6, height: 6 });
    expect(explorationMapSize({ playerPos: { x: 0, y: 0 }, groups: [] })).toEqual({ width: 1, height: 1 });
  });

  it("surligne le chemin fourni avec un losange par étape", () => {
    const view = buildExplorationViewModel({ exploration, viewport: VIEWPORT });
    expect(view.path).toHaveLength(2);
    expect(view.scene.tiles).toHaveLength(0);
    const origin = sceneOrigin(explorationMapSize(exploration), VIEWPORT);
    expect(view.path[0]?.center).toEqual(gridToIso({ x: 2, y: 4, origin }));
    expect(view.path[0]?.points).toHaveLength(8);
  });
});

describe("exploration — jetons", () => {
  const exploration = {
    playerPos: { x: 2, y: 3 },
    groups: [{ pos: { x: 5, y: 5 }, label: "Piou mazouté", totalLevel: 7 }],
  };

  it("place le héros puis les groupes badgés de leur niveau total", () => {
    const view = buildExplorationViewModel({ exploration, viewport: VIEWPORT });
    expect(view.tokens).toHaveLength(2);
    expect(view.tokens[0]?.fill).toBe(PLAYER_TOKEN_COLOR);
    expect(view.tokens[1]?.fill).toBe(ENEMY_TOKEN_COLOR);
    expect(view.tokens[1]?.badge).toBe("7");
  });

  it("ne dessine aucun chemin quand la prop est absente", () => {
    const view = buildExplorationViewModel({
      exploration: { playerPos: { x: 1, y: 1 }, groups: [] },
      viewport: VIEWPORT,
    });
    expect(view.path).toHaveLength(0);
    expect(view.tokens).toHaveLength(1);
  });
});

describe("exploration — sprite du héros", () => {
  const exploration = {
    playerPos: { x: 2, y: 3 },
    groups: [{ pos: { x: 5, y: 5 }, label: "Piou mazouté", totalLevel: 7 }],
  };

  it("rend le héros avec sa feuille et laisse les groupes géométriques", () => {
    const view = buildExplorationViewModel({
      exploration: { ...exploration, heroSpriteId: "ecaflip" },
      viewport: VIEWPORT,
    });
    expect(view.tokens[0]?.spriteId).toBe("ecaflip");
    expect(view.tokens[0]?.animation).toBe("idle");
    expect(view.tokens[1]?.spriteId).toBeNull();
    expect(view.lastAction).toBeNull();
  });

  it("anime le héros en walk quand un chemin est tracé", () => {
    const view = buildExplorationViewModel({
      exploration: { ...exploration, heroSpriteId: "ecaflip", path: [{ x: 2, y: 4 }] },
      viewport: VIEWPORT,
    });
    expect(view.tokens[0]?.animation).toBe("walk");
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
