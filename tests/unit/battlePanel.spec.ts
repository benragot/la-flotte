import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { heroBattleCombatant, setupDungeonBattle } from "../../src/engine/dungeon/combatants";
import { initCombat } from "../../src/engine/combatLoop/init";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildTimeline } from "../../src/engine/multiCombat";
import type { BattleState } from "../../src/engine/multiCombat";
import { battleViewModel } from "../../src/renderer/battleViewModel";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { BattlePanel, BattleSections, CombatantList } from "../../src/ui/components/battle";

/**
 * Pas de jsdom ni de @testing-library : le rendu est vérifié par
 * `react-dom/server` sur les composants **purs** (props seulement) et par
 * lecture de source pour le câblage/portillon du composant branché au store.
 */
const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const readData = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const PANEL_PATH = "src/ui/components/battle/BattlePanel.tsx";
const APP_PATH = "src/ui/App.tsx";

const monsters = parseMonstersYaml(readData("monsters.yaml"));
const dungeons = parseDungeonsYaml(readData("dungeons.yaml"));
const classes = parseClassesYaml(readData("classes.yaml"));
const maps = parseMapsYaml(readData("maps.yaml"));
const spells = parseSpellsYaml(readData("spells.yaml"));

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

function roomBattle(): BattleState {
  const groups = roomMonsters(roomOne()).map((group) => ({
    monster: mustFind(monsters, group.monsterId),
    count: group.count,
  }));
  const hero = heroBattleCombatant({ combatant: combatantLike() });
  const { combatants } = setupDungeonBattle({ hero: { combatant: hero }, monsters: groups });
  return { turn: 1, ...buildTimeline(combatants), combatants, log: ["Entrée dans la salle"] };
}

function combatantLike() {
  return {
    id: "player",
    kind: "player" as const,
    name: "Balthazar",
    level: 1,
    hp: 60,
    maxHp: 60,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    accuracyPct: 0,
    pp: 0,
    percentDmg: 0,
    position: { x: 0, y: 0 },
    stats: { strength: 20, intelligence: 0, chance: 0, agility: 10, wisdom: 0 },
    resistances: {
      flat: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 },
      percent: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 },
    },
    spellIds: [],
  };
}

function demoCombat() {
  return initCombat({
    map: parseAsciiMap(mustFind(maps, "ferraille_plage_01").grid),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "piou_mazoute"),
    spells,
  });
}

function heroFirstBattle(): BattleState {
  const battle = roomBattle();
  return { ...battle, activeIndex: Math.max(0, battle.order.indexOf("player")) };
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

/** Balise exacte du bouton de fin de tour : `disabled` se vérifie sur son ouverture. */
function endTurnButton(html: string): string {
  const match = /<button[^>]*>Terminer le tour<\/button>/.exec(html);
  if (match === null) throw new Error("bouton « Terminer le tour » absent du rendu");
  return match[0];
}

/** `disabled` en **attribut**, jamais la classe : les jetons portent `disabled:*`. */
function endTurnDisabled(html: string): boolean {
  return endTurnButton(html).replace(/ class="[^"]*"/, "").includes(" disabled");
}

function enemyFirstBattle(): BattleState {
  const battle = roomBattle();
  const enemyIndex = battle.order.findIndex((id) => id !== "player");
  return { ...battle, activeIndex: Math.max(0, enemyIndex) };
}

describe("panneau de bataille — rendu des N ennemis", () => {
  it("affiche le héros et les trois ennemis de la salle avec leurs PV", () => {
    const html = renderToStaticMarkup(createElement(BattleSections, { battle: roomBattle() }));
    expect(html).toContain("Balthazar");
    expect(count(html, ">Piou Mazouté<")).toBe(2);
    expect(html).toContain("Égoût-dron");
    expect(html).toContain("35 / 35");
    expect(html).toContain("52 / 52");
    expect(html).toContain("6 PA");
    expect(html).toContain("3 PM");
  });

  it("nomme le panneau et marque le combattant actif", () => {
    const battle = heroFirstBattle();
    const html = renderToStaticMarkup(createElement(BattleSections, { battle }));
    expect(html).toContain('aria-label="Combat de salle"');
    expect(count(html, 'aria-current="true"')).toBe(1);
    expect(count(html, 'aria-label="Combattant ')).toBe(4);
  });

  it("propose une action Attaquer par cible valide seulement", () => {
    const views = battleViewModel(heroFirstBattle());
    const html = renderToStaticMarkup(createElement(CombatantList, { views, onAttack: () => undefined }));
    expect(count(html, ">Attaquer<")).toBe(3);
  });

  it("propose Terminer le tour et Clore la salle", () => {
    const html = renderToStaticMarkup(createElement(BattleSections, { battle: roomBattle() }));
    expect(html).toContain("Terminer le tour");
    expect(html).toContain("Clore la salle");
  });
});

describe("panneau de bataille — « Terminer le tour » soumis à la main du héros", () => {
  it("désactive le bouton quand l'actif n'est pas le héros", () => {
    const html = renderToStaticMarkup(createElement(BattleSections, { battle: enemyFirstBattle() }));
    expect(endTurnDisabled(html)).toBe(true);
  });

  it("laisse le bouton actif quand le héros a la main", () => {
    const html = renderToStaticMarkup(createElement(BattleSections, { battle: heroFirstBattle() }));
    expect(endTurnDisabled(html)).toBe(false);
  });

  it("garde le bouton désactivé sur une bataille déjà perdue", () => {
    const battle = heroFirstBattle();
    const fallen = battle.combatants.map((entry) => (entry.side === "player" ? { ...entry, hp: 0 } : entry));
    const html = renderToStaticMarkup(createElement(BattleSections, { battle: { ...battle, combatants: fallen } }));
    expect(endTurnDisabled(html)).toBe(true);
  });
});

describe("panneau de bataille — portillon", () => {
  it("ne rend rien quand battle est null, même avec un combat 1v1 en cours", () => {
    useCombatStore.setState({ combat: demoCombat(), battle: null });
    expect(renderToStaticMarkup(createElement(BattlePanel))).toBe("");
  });

  it("ne lit que battle : le 1v1 reste piloté par l'arène et le HUD existants", () => {
    const source = readSource(PANEL_PATH);
    expect(source).toContain("state.battle");
    expect(source).not.toContain("state.combat");
    expect(source).toContain("if (!shouldRenderBattle(battle)) return null;");
  });

  it("est monté dans App par le barrel des composants", () => {
    const source = readSource(APP_PATH);
    expect(source).toContain("<BattlePanel />");
    expect(source).toMatch(/BattlePanel[^;]*from\s+"\.\/components"/);
  });

  it("est exporté par le barrel des composants", () => {
    expect(typeof BattlePanel).toBe("function");
    expect(typeof BattleSections).toBe("function");
    expect(typeof CombatantList).toBe("function");
  });
});
