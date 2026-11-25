import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { allPositions } from "../../src/engine/combatLoop/cells";
import { roomMonsters } from "../../src/engine/dungeon";
import { isWalkableCell } from "../../src/engine/grid";
import type { DungeonRoom } from "../../src/engine/dungeon";
import type { BattleState } from "../../src/engine/multiCombat";
import { battleViewModel } from "../../src/renderer/battleViewModel";
import { buildBattleViewModel } from "../../src/renderer/battleSceneModel";
import { LABEL_FONT_SIZE, hoverBarInBounds, labelsFor, viewportBounds } from "../../src/renderer/labels";
import type { TokenView } from "../../src/renderer/tokens";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { BattleSections } from "../../src/ui/components/battle";

/**
 * Défauts constatés sur captures : le panneau de salle listait **4** combattants
 * alors que la carte n'en dessinait qu'**un**. Le placement de la salle 1 est
 * prouvé sain par `battleRange.spec.ts` (quatre cases praticables distinctes) :
 * c'est donc le **rendu** qui manquait de jetons, pas le moteur.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const VIEWPORT = { width: 1024, height: 768 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function roomOne(): DungeonRoom {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

/** État réel de la salle 1 : le store place les combattants sur la carte du donjon. */
function roomBattle(): BattleState {
  useCombatStore.getState().startDungeonRoom({ room: roomOne() });
  const state = useCombatStore.getState().battle;
  if (state === null) throw new Error("aucun battle");
  return state;
}

function cellKeys(view: { tokens: readonly { center: { x: number; y: number } }[] }): string[] {
  return view.tokens.map((token) => `${token.center.x}:${token.center.y}`);
}

beforeEach(() => {
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null });
});

describe("salle de donjon — un jeton par combattant", () => {
  it("dessine les quatre combattants de la salle 1, chacun sur une case distincte", () => {
    const battle = roomBattle();
    expect(battle.combatants).toHaveLength(4);
    expect(roomMonsters(roomOne())).toHaveLength(2);
    const view = buildBattleViewModel({ battle, viewport: VIEWPORT });
    expect(view.tokens).toHaveLength(4);
    expect(new Set(cellKeys(view)).size).toBe(4);
  });
});

describe("salle de donjon — chaque jeton porte le nom de son combattant", () => {
  it("expose le nom venu du moteur pour le héros comme pour chaque monstre", () => {
    const battle = roomBattle();
    const view = buildBattleViewModel({ battle, viewport: VIEWPORT });
    const engineNames = battle.combatants.map((combatant) => combatant.name);
    expect(view.tokens.map((token) => token.name)).toEqual(engineNames);
    expect(engineNames[0]).not.toBe("");
    expect(new Set(engineNames).size).toBeGreaterThan(1);
  });

  it("ne masque jamais la barre de PV : l'encre du nom reste sous la barre bornée", () => {
    const battle = roomBattle();
    const token = buildBattleViewModel({ battle, viewport: VIEWPORT }).tokens[0];
    if (token === undefined) throw new Error("jeton du héros absent");
    const bounds = viewportBounds({ minX: 0, minY: 0, maxX: VIEWPORT.width, maxY: VIEWPORT.height }, VIEWPORT);
    const height = LABEL_FONT_SIZE * token.scale;
    const labels = labelsFor({ token, bounds, nameWidth: 120, nameHeight: height });
    const name = labels.find((label) => label.kind === "name");
    if (name === undefined) throw new Error("étiquette du nom absente");
    const bar = hoverBarInBounds(token, bounds);
    expect(name.y - height).toBeGreaterThanOrEqual(bar.y + bar.height);
    expect(name.y).toBeLessThanOrEqual(bounds.maxY);
  });
});

describe("salle de donjon — la grille est découpée en cases", () => {
  it("porte un contour par case praticable de la carte de la salle", () => {
    const battle = roomBattle();
    const map = battle.map;
    if (map === undefined) throw new Error("la salle 1 doit porter sa carte");
    const walkable = allPositions(map).filter((cell) => isWalkableCell(map, cell));
    const view = buildBattleViewModel({ battle, viewport: VIEWPORT });
    expect(walkable.length).toBeGreaterThan(0);
    expect(view.scene.outlines).toHaveLength(walkable.length);
  });
});

describe("canvas — la salle ouverte prime sur l'exploration", () => {
  it("dessine les quatre combattants même quand `mode` est resté « exploration »", async () => {
    const { arenaSceneView } = await import("../../src/renderer/arenaScene");
    const battle = roomBattle();
    const input = { combat: null, battle, mode: "exploration" as const, viewport: VIEWPORT };
    const view = arenaSceneView({ ...input, heroSpriteId: "iop", selectedSpellId: null, hoveredCell: null });
    expect(view?.tokens).toHaveLength(4);
  });
});

/** Les noms sont échappés par `renderToStaticMarkup` : on les remet en clair. */
function unescapeName(value: string): string {
  return value.replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

function panelActiveName(battle: BattleState): string {
  const html = renderToStaticMarkup(createElement(BattleSections, { battle }));
  const found = /Actif : ([^<]+)</.exec(html);
  if (found === null || found[1] === undefined) throw new Error("en-tête « Actif : » absent");
  return unescapeName(found[1]);
}

/** Nom du combattant dont la carte porte le cadre doré (`aria-current`). */
function framedCardName(battle: BattleState): string {
  const views = battleViewModel(battle);
  const active = views.filter((view) => view.isActive);
  expect(active).toHaveLength(1);
  return active[0]?.name ?? "";
}

describe("salle de donjon — un seul combattant actif, désigné partout pareil", () => {
  it("l'anneau doré de la carte, le cadre doré et « Actif : » nomment le même combattant", () => {
    const battle = roomBattle();
    const view = buildBattleViewModel({ battle, viewport: VIEWPORT });
    const ringed = view.tokens.filter((token) => token.active);
    expect(ringed).toHaveLength(1);
    const ringName = battle.combatants[view.tokens.findIndex((token) => token.active)]?.name;
    expect(ringName).toBe(panelActiveName(battle));
    expect(ringName).toBe(framedCardName(battle));
  });

  it("l'actif vient de la timeline du battle, pas d'un index figé au héros", () => {
    const battle = roomBattle();
    expect(buildBattleViewModel({ battle, viewport: VIEWPORT }).activeId).toBe(battle.order[battle.activeIndex]);
  });
});

function mustGet<T>(list: readonly T[], index: number): T {
  const found = list[index];
  if (found === undefined) throw new Error(`index ${index} absent`);
  return found;
}

function withLog(battle: BattleState, lines: readonly string[]): BattleState {
  return { ...battle, log: [...battle.log, ...lines] };
}

function tokenOf(view: { tokens: readonly TokenView[] }, id: string): TokenView {
  const token = view.tokens.find((entry) => entry.id === id);
  if (token === undefined) throw new Error(`jeton ${id} absent`);
  return token;
}

describe("salle de donjon — la dernière action anime les acteurs", () => {
  it("l'attaquant joue attack, la cible hit, les autres restent idle", () => {
    const battle = roomBattle();
    const hero = mustGet(battle.combatants, 0);
    const target = mustGet(battle.combatants, 1);
    const line = `${hero.name} frappe ${target.name} : 11 dégâts.`;
    const view = buildBattleViewModel({ battle: withLog(battle, [line]), viewport: VIEWPORT });
    const action = view.lastAction;
    expect(action).toMatchObject({ kind: "attack", actorId: hero.id, targetId: target.id });
    expect(tokenOf(view, hero.id).animation).toBe("attack");
    expect(tokenOf(view, target.id).animation).toBe("hit");
    expect(tokenOf(view, hero.id).animationKey).toBe(`${action?.signature}:attack`);
    expect(tokenOf(view, target.id).animationKey).toBe(`${action?.signature}:hit`);
    const others = view.tokens.filter((token) => token.id !== hero.id && token.id !== target.id);
    expect(others.every((token) => token.animation === "idle")).toBe(true);
  });

  it("un déplacement fait marcher l'acteur et laisse les cibles au repos", () => {
    const battle = roomBattle();
    const hero = mustGet(battle.combatants, 0);
    const view = buildBattleViewModel({ battle: withLog(battle, [`${hero.name} se déplace de 1 case(s).`]), viewport: VIEWPORT });
    expect(view.lastAction).toMatchObject({ kind: "move", actorId: hero.id });
    expect(tokenOf(view, hero.id).animation).toBe("walk");
    expect(view.tokens.filter((token) => token.id !== hero.id).every((token) => token.animation === "idle")).toBe(true);
  });

  it("sans action journalisée, tout le monde reste idle", () => {
    const battle = roomBattle();
    const view = buildBattleViewModel({ battle, viewport: VIEWPORT });
    expect(view.lastAction).toBeNull();
    expect(view.tokens.every((token) => token.animation === "idle")).toBe(true);
  });
});

describe("salle de donjon — nombres flottants et noms au tour de l'action", () => {
  it("conserve les nombres flottants et les noms au tour de l'action", () => {
    const battle = roomBattle();
    const hero = mustGet(battle.combatants, 0);
    const target = mustGet(battle.combatants, 1);
    const floats = [{ id: 1, targetId: target.id, amount: 11, kind: "damage" as const }];
    const line = `${hero.name} frappe ${target.name} : 11 dégâts.`;
    const view = buildBattleViewModel({ battle: { ...withLog(battle, [line]), floats }, viewport: VIEWPORT });
    expect(view.floats).toEqual(floats);
    expect(view.tokens.map((token) => token.name)).toEqual(battle.combatants.map((combatant) => combatant.name));
  });

  it("touche l'homonyme désigné par le nombre flottant, pas le premier du nom", () => {
    const battle = roomBattle();
    const hero = mustGet(battle.combatants, 0);
    const first = mustGet(battle.combatants, 1);
    const second = mustGet(battle.combatants, 2);
    expect(first.name).toBe(second.name);
    const floats = [{ id: 1, targetId: second.id, amount: 9, kind: "damage" as const }];
    const line = `${hero.name} frappe ${second.name} : 9 dégâts.`;
    const view = buildBattleViewModel({ battle: { ...withLog(battle, [line]), floats }, viewport: VIEWPORT });
    expect(view.lastAction?.targetId).toBe(second.id);
    expect(tokenOf(view, second.id).animation).toBe("hit");
    expect(tokenOf(view, first.id).animation).toBe("idle");
  });
});

