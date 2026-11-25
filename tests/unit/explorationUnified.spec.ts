import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Position } from "../../src/engine/grid";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { isVictory } from "../../src/engine/multiCombat";
import { battleClickRoute } from "../../src/store/battleRouting";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * DEC-12, étape 3 : un combat d'**exploration** se joue sur `multiCombat` à un
 * seul monstre quand `VITE_COMBAT_ENGINE=unified`. Le défaut (`legacy`) garde
 * exactement le 1v1 de `combatLoop` : `combat` non nul, `battle` nul.
 */
const HERO = { name: "Balthazar", classId: "iop" };
/** Jet constant : placement des groupes reproductible, aucun aléa de test. */
const STEADY_RNG = () => 0.2;

function unified(): void {
  vi.stubEnv("VITE_COMBAT_ENGINE", "unified");
}

function legacy(): void {
  vi.stubEnv("VITE_COMBAT_ENGINE", "legacy");
}

function newSession(): void {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter(HERO);
  useCombatStore.getState().resetCombat();
  useCombatStore.getState().startExploration(STEADY_RNG);
}

function state() {
  return useCombatStore.getState();
}

function heroXp(): number {
  return useGameStore.getState().hero?.xp ?? 0;
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

function ofSide(battle: BattleState, side: "player" | "enemy"): CombatantLike {
  const found = battle.combatants.find((entry) => entry.side === side);
  if (found === undefined) throw new Error(`combattant ${side} absent`);
  return found;
}

function adjacentToHero(battle: BattleState): Position {
  const hero = ofSide(battle, "player");
  return { x: hero.position.x + 1, y: hero.position.y };
}

/** Duel contrôlé : monstre au contact, PV imposés, main au héros. */
function duellistBattle(battle: BattleState, enemyHp: number): BattleState {
  const cell = adjacentToHero(battle);
  const combatants = battle.combatants.map((entry) => {
    if (entry.side === "player") return entry;
    return { ...entry, position: cell, hp: enemyHp, maxHp: enemyHp };
  });
  return activated({ ...battle, combatants });
}

/** Main au héros, sans toucher aux positions (le monstre reste loin). */
function activated(battle: BattleState): BattleState {
  return { ...battle, activeIndex: battle.order.indexOf(ofSide(battle, "player").id) };
}

function stageEnemy(enemyHp: number): BattleState {
  const battle = duellistBattle(enteredBattle(), enemyHp);
  useCombatStore.setState({ battle });
  return battle;
}

function stageDistantBattle(): BattleState {
  const battle = activated(enteredBattle());
  useCombatStore.setState({ battle });
  return battle;
}

function heroHp(): number {
  const hero = useGameStore.getState().hero;
  if (hero === null) throw new Error("héros absent");
  return hero.hp;
}

function setHeroHp(hp: number): void {
  const hero = useGameStore.getState().hero;
  if (hero === null) throw new Error("héros absent");
  useGameStore.setState({ hero: { ...hero, hp } });
}

beforeEach(() => {
  unified();
  newSession();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("exploration unifiée — entrée en combat", () => {
  it("crée un battle à un seul monstre et aucun combat 1v1", () => {
    const battle = enteredBattle();
    expect(state().combat).toBeNull();
    expect(state().mode).toBe("combat");
    expect(battle.combatants).toHaveLength(2);
    expect(battle.combatants.filter((entry) => entry.side === "enemy")).toHaveLength(1);
    const initiativeOrder = [...battle.combatants].sort((a, b) => b.initiative - a.initiative).map((e) => e.id);
    expect(battle.order).toEqual(initiativeOrder);
  });

  it("garde le groupe vaincu éventuel et la carte d'exploration sous la main", () => {
    enteredBattle();
    expect(state().activeGroup).not.toBeNull();
    expect(state().exploration).not.toBeNull();
    expect(state().rewards).toBeNull();
  });
});

describe("routage unifié du clic", () => {
  it("un clic sur un ennemi vivant attaque : PV baissés, PA payés", () => {
    const battle = stageEnemy(300);
    const enemy = ofSide(battle, "enemy");
    const heroBefore = ofSide(battle, "player");
    state().clickCell(enemy.position);
    const after = state().battle;
    expect(after).not.toBeNull();
    expect(ofSide(after as BattleState, "enemy").hp).toBeLessThan(300);
    expect(ofSide(after as BattleState, "player").ap).toBeLessThan(heroBefore.ap);
  });

  it("un clic sur une case vide déplace le héros", () => {
    const battle = stageDistantBattle();
    const hero = ofSide(battle, "player");
    const free = { x: hero.position.x, y: hero.position.y - 1 };
    state().clickCell(free);
    expect(ofSide(state().battle as BattleState, "player").position).toEqual(free);
  });

  it("un sort sélectionné route vers le sort, pas vers l'attaque nue", () => {
    const battle = stageEnemy(300);
    const route = battleClickRoute({ battle, target: adjacentToHero(battle), spellSelected: true });
    expect(route).toEqual({ kind: "spell", targetId: ofSide(battle, "enemy").id });
  });

  it("sans sort sélectionné la même case route vers l'attaque", () => {
    const battle = stageEnemy(300);
    const route = battleClickRoute({ battle, target: adjacentToHero(battle), spellSelected: false });
    expect(route).toEqual({ kind: "attack", targetId: ofSide(battle, "enemy").id });
  });
});

describe("exploration unifiée — fin de tour", () => {
  it("endTurn passe la main aux monstres puis rend le tour au héros", () => {
    const before = stageEnemy(300);
    state().endTurn();
    const after = state().battle;
    expect(after).not.toBeNull();
    expect(after?.turn).toBe(before.turn + 1);
    expect(ofSide(after as BattleState, "player").id).toBe(after?.order[after.activeIndex]);
  });
});

describe("exploration unifiée — sortie de combat", () => {
  it("la victoire crédite l'XP puis ramène sur la carte", () => {
    const battle = stageEnemy(1);
    const enemy = ofSide(battle, "enemy");
    state().clickCell(enemy.position);
    expect(isVictory(state().battle as BattleState)).toBe(true);
    expect(state().rewards).not.toBeNull();
    expect(heroXp()).toBeGreaterThan(0);
    state().settleDungeonRoom();
    expect(state().battle).toBeNull();
    expect(state().mode).toBe("exploration");
    expect(heroXp()).toBeGreaterThan(0);
  });

  it("la défaite restaure les PV et ne persiste aucun 0", () => {
    setHeroHp(1);
    const battle = stageEnemy(300);
    const wounded = battle.combatants.map((entry) => (entry.side === "player" ? { ...entry, hp: 1 } : entry));
    useCombatStore.setState({ battle: { ...battle, combatants: wounded } });
    state().endTurn();
    state().returnToMap();
    expect(state().battle).toBeNull();
    expect(state().mode).toBe("exploration");
    expect(heroHp()).toBeGreaterThan(0);
  });
});

describe("drapeau legacy — le 1v1 reste intact", () => {
  it("en legacy, entrer en combat crée un combat 1v1 et aucun battle", () => {
    legacy();
    state().clickCell(groupCell());
    expect(state().combat).not.toBeNull();
    expect(state().battle).toBeNull();
    expect(state().mode).toBe("combat");
  });

  it("sans variable d'environnement, le chemin par défaut reste legacy", () => {
    vi.unstubAllEnvs();
    state().clickCell(groupCell());
    expect(state().combat).not.toBeNull();
    expect(state().battle).toBeNull();
  });
});
