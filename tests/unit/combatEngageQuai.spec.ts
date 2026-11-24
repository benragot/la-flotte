import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import { createHero } from "../../src/engine/createHero";
import { isWalkableCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * Bug 7 — « sur le quai, cliquer un monstre ne fait rien ».
 * Le 1v1 exigeait une case `M` dans la grille ; les cartes du quai et de la cale
 * n'en portent aucune (leurs monstres viennent de `data/spawns.yaml`), donc
 * `initCombat` levait « placement monstre absent de la carte » et le clic
 * n'engageait AUCUN combat. Une carte sans `M` doit se replier sur la case
 * praticable la plus loin du héros — jamais une exception, jamais un cas
 * particulier de carte.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));

/** 10×3 sans `M` : le joueur en haut à gauche, l'ennemi attend en bas à droite. */
const NO_MONSTER_ROWS = ["P.........", "..........", ".........."];
const FARTHEST_FROM_HERO = { x: 9, y: 2 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

function iopHero() {
  return createHero("Balthazar", mustFind(classes, "iop"));
}

function piou() {
  return mustFind(monsters, "piou_mazoute");
}

function combatOn(rows: readonly string[]) {
  return initCombat({ map: parseAsciiMap([...rows]), hero: iopHero(), monster: piou(), spells });
}

describe("combat 1v1 — une carte sans `M` place quand même l'ennemi", () => {
  it("ne lève pas et pose l'ennemi sur la case praticable la plus loin du héros", () => {
    const state = combatOn(NO_MONSTER_ROWS);
    expect(state.enemy.position).toEqual(FARTHEST_FROM_HERO);
    expect(isWalkableCell(state.map, state.enemy.position)).toBe(true);
    expect(samePosition(state.enemy.position, state.player.position)).toBe(false);
  });

  it("garde la case `M` déclarée quand la carte en porte une", () => {
    const plage = mustFind(maps, "ferraille_plage_01");
    const state = combatOn(plage.grid);
    expect(state.enemy.position).toEqual({ x: 5, y: 9 });
  });
});

/**
 * Le bug tel que le joueur le vit : sur le quai, un clic sur le groupe visible
 * levait une exception et laissait l'écran en exploration.
 */
function startOn(mapId: string): void {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  useCombatStore.getState().startExploration();
  useCombatStore.setState({ mapId });
  useCombatStore.getState().startExploration();
}

function clickFirstGroup(): { mode: string; mapId: string; enemy: string } {
  const group = useCombatStore.getState().exploration?.monsterGroups[0];
  if (group === undefined) throw new Error("aucun groupe sur la carte");
  useCombatStore.getState().clickCell(group.pos);
  const { mode, combat, mapId } = useCombatStore.getState();
  return { mode, mapId, enemy: combat?.enemy.name ?? "aucun" };
}

describe("store — cliquer un monstre engage le combat sur les trois cartes de la Ferraille", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
  });

  for (const mapId of ["ferraille_plage_01", "ferraille_quai_02", "ferraille_cale_03"]) {
    it(`engage le combat sur ${mapId}`, () => {
      startOn(mapId);
      const clicked = clickFirstGroup();
      expect(clicked.mode).toBe("combat");
      expect(clicked.enemy).not.toBe("aucun");
      expect(useCombatStore.getState().combat?.map.width).toBe(mustFind(maps, mapId).width);
    });
  }
});
