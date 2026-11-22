import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import { createHero } from "../../src/engine/createHero";
import { computeCombatXp, computeDropChance, computeProspection } from "../../src/engine/economy";
import { parseAsciiMap } from "../../src/engine/grid";
import { countItem } from "../../src/engine/inventory";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

const DEMO_MONSTER_ID = "piou_mazoute";
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const iop = (): ClassDef => mustFind(classes, "iop");
const piou = (): MonsterDef => mustFind(monsters, DEMO_MONSTER_ID);

const levelOneHero = () => createHero("Anselme", iop());

const tinyArena = () => parseAsciiMap(["P.M.", "...."]);

function rewardsFor(player: ReturnType<typeof initCombat>["player"], rng: () => number) {
  const options = { hero: player, monster: piou(), progression, rng };
  return resolveCombatRewards({ ...options, heroXp: 0 });
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useCombatStore.setState({ combat: null, selectedSpellId: null, rewards: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("walkthrough : économie", () => {
  it("enchaîne prospection, drop, XP de combat et crédit dans le sac", () => {
    const hero = levelOneHero();
    const loot = piou().loot[0];
    if (loot === undefined) throw new Error("butin attendu sur le Piou Mazouté");
    const prospection = computeProspection({ basePp: hero.pp, chance: hero.chance });
    expect(prospection).toBe(100);
    const dropChance = computeDropChance({
      playerPp: prospection,
      ppThreshold: loot.ppThreshold,
      baseDropRate: loot.baseDropRate,
    });
    expect(dropChance).toBeCloseTo(0.4);
    const xp = computeCombatXp({
      baseMonsterXp: piou().baseXp,
      wisdom: hero.wisdom,
      levelGapFactor: progression.levelGapFactor,
    });
    expect(xp).toBe(120);
    useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
    const rewards = { xpGained: xp, totalXp: xp, level: 2, levelUp: { hp: 5, capitalPoints: 5, spellPoints: 1 } };
    useGameStore.getState().creditCombatRewards({ ...rewards, prospection, drops: [loot.itemId] });
    const state = useGameStore.getState();
    expect(state.hero?.xp).toBe(120);
    expect(state.hero?.level).toBe(2);
    expect(countItem(state.inventory, loot.itemId)).toBe(1);
  });

  it("lit le levelGapFactor de progression.yaml au lieu du 1 en dur", () => {
    const state = initCombat({ map: tinyArena(), hero: levelOneHero(), monster: piou(), spells });
    const doubled = { ...progression, levelGapFactor: 2 };
    const options = { heroXp: 0, hero: state.player, monster: piou(), rng: () => 0.99 };
    expect(resolveCombatRewards({ ...options, progression: doubled }).xpGained).toBe(240);
  });

  it("crédite au héros persistant l'XP d'une victoire dans l'arène", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    useGameStore.getState().createCharacter({ name: "Balthazar", classId: "iop" });
    const hero = useGameStore.getState().hero;
    if (hero === null) throw new Error("héros non créé");
    const base = initCombat({ map: tinyArena(), hero, monster: piou(), spells });
    const weakened = { ...base, enemy: { ...base.enemy, hp: 1 } };
    useCombatStore.setState({ combat: weakened, selectedSpellId: "pression" });
    useCombatStore.getState().clickCell({ x: 2, y: 0 });
    expect(useCombatStore.getState().combat?.phase).toBe("victory");
    expect(useCombatStore.getState().rewards?.xpGained).toBe(120);
    const game = useGameStore.getState();
    expect(game.hero?.xp).toBe(120);
    expect(game.hero?.level).toBe(2);
  });
});
