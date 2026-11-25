import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CombatRewards } from "../../src/engine/combatLoop/types";
import type { Position } from "../../src/engine/grid";
import { countItem } from "../../src/engine/inventory";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { isDefeat, isVictory } from "../../src/engine/multiCombat";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { battleOutcome } from "../../src/store/battleSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import RewardsSummary from "../../src/ui/components/RewardsSummary";
import UnifiedEndOverlay from "../../src/ui/components/battle/UnifiedEndOverlay";

/**
 * ARCH-02 — en mode unifié, la victoire créditait XP et butin **sans écran**.
 * Ce fichier verrouille les trois contrats de l'écran de fin :
 * 1. l'état garde les valeurs **réellement créditées** (source unique, DEC-12) ;
 * 2. l'écran les rend dans les composants de fin déjà existants ;
 * 3. le retour est idempotent, la défaite ne montre aucun gain, le donjon est exclu.
 *
 * `renderToStaticMarkup` lit le **snapshot serveur** de Zustand (état initial) :
 * on rend donc `UnifiedEndOverlay` avec les props du store, et le câblage de
 * `BattlePanel` est vérifié sur sa source, comme le fait déjà `battlePanel.spec`.
 */
const HERO = { name: "Balthazar", classId: "iop" };
/** Assez de PV pour survivre au tour du héros quand le test ne cherche pas la défaite. */
const TOUGH = 300;
const PANEL_PATH = "src/ui/components/battle/BattlePanel.tsx";
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const monsters = parseMonstersYaml(read("monsters.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

function unified(): void {
  vi.stubEnv("VITE_COMBAT_ENGINE", "unified");
}

function state() {
  return useCombatStore.getState();
}

function hero() {
  const current = useGameStore.getState().hero;
  if (current === null) throw new Error("héros absent");
  return current;
}

function ofSide(battle: BattleState, side: "player" | "enemy"): CombatantLike {
  const found = battle.combatants.find((entry) => entry.side === side);
  if (found === undefined) throw new Error(`combattant ${side} absent`);
  return found;
}

function groupCell(): Position {
  const group = state().exploration?.monsterGroups[0];
  if (group === undefined) throw new Error("aucun groupe d'exploration");
  return group.pos;
}

function enteredBattle(): BattleState {
  state().clickCell(groupCell());
  const battle = state().battle;
  if (battle === null) throw new Error("aucun battle unifié");
  return battle;
}

function activated(battle: BattleState): BattleState {
  return { ...battle, activeIndex: battle.order.indexOf(ofSide(battle, "player").id) };
}

/** Monstre au contact, PV imposés, main au héros : un clic réel décide du sort. */
function duellist(enemyHp: number): BattleState {
  const battle = enteredBattle();
  const cell = { x: ofSide(battle, "player").position.x + 1, y: ofSide(battle, "player").position.y };
  const combatants = battle.combatants.map((entry) => {
    if (entry.side === "player") return entry;
    return { ...entry, position: cell, hp: enemyHp, maxHp: enemyHp };
  });
  const next = activated({ ...battle, combatants });
  useCombatStore.setState({ battle: next });
  return next;
}

function lootCounts(): Record<string, number> {
  const { inventory } = useGameStore.getState();
  return {
    plume_mazoutee: countItem(inventory, "plume_mazoutee"),
    fer_goutte_mazout: countItem(inventory, "fer_goutte_mazout"),
  };
}

function rewardsOrThrow(): CombatRewards {
  const { rewards } = state();
  if (rewards === null) throw new Error("récompenses absentes");
  return rewards;
}

function endHtml(excluded = false): string {
  const { battle, rewards, returnToMap } = state();
  if (battle === null) return "";
  const props = { battle, rewards, excluded, onReturn: returnToMap };
  return renderToStaticMarkup(createElement(UnifiedEndOverlay, props));
}

function winBattle(): BattleState {
  const battle = duellist(1);
  state().clickCell(ofSide(battle, "enemy").position);
  const won = state().battle;
  if (won === null) throw new Error("battle absent après la victoire");
  return won;
}

function firstRoom() {
  const room = dungeons[0]?.rooms[0];
  if (room === undefined) throw new Error("data/dungeons.yaml ne déclare aucune salle");
  return room;
}

beforeEach(() => {
  unified();
  vi.spyOn(Math, "random").mockReturnValue(0);
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter(HERO);
  useCombatStore.getState().resetCombat();
  useCombatStore.getState().startExploration(() => 0.2);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ARCH-02 — conservation des récompenses créditées", () => {
  it("expose exactement l'XP, les kamas et les butins crédités", () => {
    const before = hero();
    winBattle();
    const after = hero();
    const rewards = rewardsOrThrow();
    expect(isVictory(state().battle as BattleState)).toBe(true);
    expect(rewards.xpGained).toBe(120);
    expect(rewards.xpGained).toBe(after.xp - before.xp);
    expect(rewards.totalXp).toBe(after.xp);
    expect(rewards.kamas).toBe(after.kamas - before.kamas);
    expect(rewards.drops).toEqual(["plume_mazoutee", "fer_goutte_mazout"]);
    expect(lootCounts()).toEqual({ plume_mazoutee: 1, fer_goutte_mazout: 1 });
  });

  it("conserve le niveau avant → après et le gain réel de montée", () => {
    const before = hero();
    winBattle();
    const after = hero();
    const rewards = rewardsOrThrow();
    expect(rewards.levelBefore).toBe(1);
    expect(rewards.level).toBe(2);
    expect(after.level).toBe(2);
    expect(rewards.levelUp).toEqual(progression.gainRules);
    expect(after.maxHp - before.maxHp).toBe(progression.gainRules.hp);
    expect(after.capitalPoints - before.capitalPoints).toBe(progression.gainRules.capitalPoints);
    expect(after.spellPoints - before.spellPoints).toBe(progression.gainRules.spellPoints);
  });
});

describe("ARCH-02 — écran de fin", () => {
  it("affiche XP, kamas, niveau 1 → 2, montée et butins", () => {
    winBattle();
    const html = endHtml();
    expect(html).toContain('aria-label="Fin du combat"');
    expect(html).toContain("Victoire");
    expect(html).toContain("XP gagnée : <span");
    expect(html).toContain(">120</span>");
    expect(html).toContain("Niveau <span");
    expect(html).toContain(">1</span> → <span");
    expect(html).toContain(">2</span>");
    expect(html).toContain("Kamas : <span");
    expect(html).toContain("Montée de niveau : PV +5 · capital +5 · sorts +1");
    expect(html).toContain("Butin : plume_mazoutee");
    expect(html).toContain("Butin : fer_goutte_mazout");
  });

  it("n'expose qu'une seule sortie, le retour à la carte", () => {
    winBattle();
    const html = endHtml();
    expect(html.split("<button").length - 1).toBe(1);
    expect(html).toContain("Retourner sur la carte");
  });

  it("ne s'affiche pas tant que le combat dure", () => {
    duellist(TOUGH);
    expect(endHtml()).toBe("");
  });

  it("BattlePanel monte la fin et la branche sur returnToMap", () => {
    const source = readSource(PANEL_PATH);
    expect(source).toContain("<UnifiedEndOverlay");
    expect(source).toContain("state.returnToMap");
    expect(source).toContain("state.dungeonRun !== null || state.activeGroup === null");
  });
});

describe("ARCH-02 — idempotence du retour", () => {
  it("un second retour ne crédite ni XP ni butin", () => {
    winBattle();
    const won = { xp: hero().xp, kamas: hero().kamas, inventory: lootCounts() };
    state().returnToMap();
    state().returnToMap();
    expect(state().battle).toBeNull();
    expect(state().mode).toBe("exploration");
    expect(hero().xp).toBe(won.xp);
    expect(hero().kamas).toBe(won.kamas);
    expect(lootCounts()).toEqual(won.inventory);
  });
});

describe("ARCH-02 — défaite sans récompense", () => {
  it("affiche la défaite, restaure les PV et ne prétend aucun gain", () => {
    const xpBefore = hero().xp;
    const inventoryBefore = lootCounts();
    const battle = duellist(TOUGH);
    const wounded = battle.combatants.map((entry) => (entry.side === "player" ? { ...entry, hp: 1 } : entry));
    useCombatStore.setState({ battle: { ...battle, combatants: wounded } });
    useGameStore.setState({ hero: { ...hero(), hp: 1 } });
    state().endTurn();
    expect(isDefeat(state().battle as BattleState)).toBe(true);
    expect(state().rewards).toBeNull();
    const html = endHtml();
    expect(html).toContain("Défaite");
    expect(html).toContain("les PV sont restaurés");
    expect(html).not.toContain("XP gagnée");
    expect(html).not.toContain("Kamas");
    expect(html).not.toContain("Butin");
    expect(hero().hp).toBe(hero().maxHp);
    state().returnToMap();
    expect(hero().hp).toBe(hero().maxHp);
    expect(hero().xp).toBe(xpBefore);
    expect(lootCounts()).toEqual(inventoryBefore);
  });
});

describe("ARCH-02 — donjon et legacy inchangés", () => {
  it("un donjon garde sa notice : aucun second écran de fin", () => {
    useCombatStore.getState().startDungeonRoom({ room: firstRoom() });
    const battle = state().battle;
    if (battle === null) throw new Error("salle absente");
    const won = { ...battle, combatants: battle.combatants.map((entry) => ({ ...entry, hp: 0 })) };
    useCombatStore.setState({ battle: won });
    expect(endHtml(true)).toBe("");
  });

  it("le résumé 1v1 existant n'affiche ni kamas ni changement de niveau", () => {
    const legacy: CombatRewards = {
      xpGained: 120, totalXp: 120, level: 2, levelUp: { hp: 5, capitalPoints: 5, spellPoints: 1 },
      prospection: 100, drops: ["plume_mazoutee"],
    };
    const html = renderToStaticMarkup(createElement(RewardsSummary, { rewards: legacy }));
    expect(html).toContain("XP gagnée");
    expect(html).toContain("Prospection");
    expect(html).toContain("Montée de niveau");
    expect(html).not.toContain("Kamas");
    expect(html).not.toContain("→");
  });
});

describe("ARCH-02 — verdict de fin", () => {
  it("donne la priorité à la défaite, puis distingue victoire et combat en cours", () => {
    const won = winBattle();
    expect(battleOutcome(won)).toBe("victory");
    const fallen = { ...won, combatants: won.combatants.map((entry) => ({ ...entry, hp: 0 })) };
    expect(battleOutcome(fallen)).toBe("defeat");
    expect(battleOutcome(duellist(TOUGH))).toBeNull();
  });
});

describe("données de test", () => {
  it("le Piou Mazouté reste le monstre attendu par ce spec", () => {
    const piou = monsters.find((entry) => entry.id === "piou_mazoute");
    expect(piou?.level).toBe(1);
    expect(piou?.baseXp).toBe(120);
    expect(piou?.loot.map((entry) => entry.itemId)).toEqual(["plume_mazoutee", "fer_goutte_mazout"]);
  });
});
