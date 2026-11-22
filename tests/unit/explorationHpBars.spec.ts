import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import { createHero } from "../../src/engine/createHero";
import { roomMonsters } from "../../src/engine/dungeon";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildBattleViewModel } from "../../src/renderer/battleSceneModel";
import { buildViewModel } from "../../src/renderer/combatSceneModel";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";
import type { ExplorationViewModel } from "../../src/renderer/explorationScene";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * Retour de playtest : « En mode exploration on peut voir la barre des points de
 * vie, ça sert à rien il faut enlever ça. » En exploration il n'y a pas de
 * combat : la barre ne dit rien et pollue la carte. Les barres restent donc
 * **en combat uniquement**, et le modèle d'exploration ne peut plus en porter.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const VIEWPORT = { width: 1024, height: 768 };
const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

/** Exploration jouable : un héros et un groupe badgé, aucun combat engagé. */
const EXPLORATION = {
  playerPos: { x: 2, y: 3 },
  groups: [{ pos: { x: 5, y: 5 }, label: "Piou mazouté", totalLevel: 7 }],
};

function combatState() {
  return initCombat({
    map: parseAsciiMap(mustFind(maps, "ferraille_plage_01").grid),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "piou_mazoute"),
    spells,
  });
}

/** Salle 1 du donjon : quatre combattants placés par le store. */
function roomBattle() {
  useCombatStore.getState().startDungeonRoom({ room: mustFind(dungeons, DUNGEON_ID).rooms[0]! });
  const state = useCombatStore.getState().battle;
  if (state === null) throw new Error("aucune salle");
  return state;
}

describe("barres de vie — l'exploration n'en produit aucune", () => {
  it("laisse la liste des barres vide sur la carte d'exploration", () => {
    const view = buildExplorationViewModel({ exploration: EXPLORATION, viewport: VIEWPORT });
    expect(view.tokens).toHaveLength(2);
    expect(view.hpBarTokens).toEqual([]);
  });

  it("ne peut pas alimenter de barres : le champ d'exploration est un tableau vide typé", () => {
    const view = buildExplorationViewModel({ exploration: EXPLORATION, viewport: VIEWPORT });
    const bars: readonly [] = view.hpBarTokens;
    expect(bars).toHaveLength(0);
  });

  it("refuse à la compilation d'y ranger une barre de vie", () => {
    const view = buildExplorationViewModel({ exploration: EXPLORATION, viewport: VIEWPORT });
    const token = view.tokens[0];
    if (token === undefined) throw new Error("jeton d'exploration attendu");
    // ⚠️ `hpBarTokens` vaut `readonly []` : y ranger une barre élargirait le type.
    // Si le type s'élargit (par exemple `readonly TokenView[]`, celui de `ViewModel`),
    // ce `@ts-expect-error` n'a plus de raison d'être et `tsc` échoue (TS2578) : les
    // tests constatent une liste vide, ils ne l'imposent pas. Seul le type l'impose.
    // @ts-expect-error — l'exploration ne porte aucune barre de vie.
    const bars: ExplorationViewModel["hpBarTokens"] = [token];
    expect(bars).toHaveLength(1);
    expect(view.hpBarTokens).toHaveLength(0);
  });
});

describe("barres de vie — le combat garde exactement une barre par combattant", () => {
  beforeEach(() => {
    useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null });
  });

  it("en peint deux dans un combat 1v1", () => {
    const view = buildViewModel({ combat: combatState(), selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.hpBarTokens).toHaveLength(2);
    expect(view.hpBarTokens).toEqual(view.tokens);
  });

  it("en peint quatre dans la salle 1 du donjon", () => {
    const battle = roomBattle();
    const view = buildBattleViewModel({ battle, viewport: VIEWPORT });
    expect(roomMonsters(mustFind(dungeons, DUNGEON_ID).rooms[0]!)).toHaveLength(2);
    expect(battle.combatants).toHaveLength(4);
    expect(view.hpBarTokens).toHaveLength(4);
    expect(view.hpBarTokens).toEqual(view.tokens);
  });
});
