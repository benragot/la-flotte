import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { isVictory } from "../../src/engine/multiCombat";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * WALKTHROUGH — « le même combat, un seul moteur » (DEC-12, étape 3).
 *
 * CE QUE CE FICHIER PROUVE : avec `VITE_COMBAT_ENGINE=unified`, un joueur qui
 * clique un groupe sur la carte joue **tout** le combat dans `BattlePanel`
 * (slice `battle`) : attaque, tour adverse, victoire, récompense, retour sur la
 * carte avec PV reportés. Aucun `combat` 1v1 n'est créé.
 *
 * CE QU'IL NE PROUVE PAS : le tacle et le critique (goldens de parité), ni le
 * chemin `legacy` (couvert par tous les autres walkthroughs, sans drapeau).
 */
const HERO = { name: "Balthazar", classId: "iop" };
/** Assez de PV pour encaisser un tour de héros : la riposte reste observable. */
const TOUGH = 200;

function session(): void {
  vi.stubEnv("VITE_COMBAT_ENGINE", "unified");
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter(HERO);
  useCombatStore.getState().resetCombat();
  useCombatStore.getState().startExploration(() => 0.2);
}

function state() {
  return useCombatStore.getState();
}

function ofSide(battle: BattleState, side: "player" | "enemy"): CombatantLike {
  const found = battle.combatants.find((entry) => entry.side === side);
  if (found === undefined) throw new Error(`combattant ${side} absent`);
  return found;
}

function battleOrThrow(): BattleState {
  const battle = state().battle;
  if (battle === null) throw new Error("battle attendu");
  return battle;
}

/** Le joueur clique le groupe : le panneau unique s'ouvre sur un seul monstre. */
function engage(): BattleState {
  const group = state().exploration?.monsterGroups[0];
  if (group === undefined) throw new Error("aucun groupe");
  state().clickCell(group.pos);
  return battleOrThrow();
}

/** L'oiseau vient au contact, avec les PV demandés, et le héros garde la main. */
function bringEnemy(hp: number): BattleState {
  const battle = state().battle ?? engage();
  const hero = ofSide(battle, "player");
  const cell = { x: hero.position.x + 1, y: hero.position.y };
  const combatants = battle.combatants.map((entry) => {
    if (entry.side === "player") return entry;
    return { ...entry, position: cell, hp, maxHp: hp };
  });
  const next = { ...battle, combatants, activeIndex: battle.order.indexOf(hero.id) };
  useCombatStore.setState({ battle: next });
  return next;
}

beforeEach(session);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("un combat d'exploration joué dans le panneau unique", () => {
  it("le clic sur un groupe ouvre un battle d'un monstre, pas un combat 1v1", () => {
    const battle = engage();
    expect(state().combat).toBeNull();
    expect(battle.combatants.filter((entry) => entry.side === "enemy")).toHaveLength(1);
  });

  it("un clic sur l'oiseau au contact le frappe et paie les PA du sort", () => {
    const battle = bringEnemy(TOUGH);
    const apBefore = ofSide(battle, "player").ap;
    state().clickCell(ofSide(battle, "enemy").position);
    const after = battleOrThrow();
    expect(ofSide(after, "enemy").hp).toBeLessThan(TOUGH);
    expect(ofSide(after, "player").ap).toBeLessThan(apBefore);
  });

  it("le héros arme Pression, la lance sur l'oiseau et le sort se désarme", () => {
    const battle = bringEnemy(TOUGH);
    const enemyBefore = ofSide(battle, "enemy").hp;
    const apBefore = ofSide(battle, "player").ap;
    state().selectSpell("pression");
    expect(state().selectedSpellId).toBe("pression");
    state().battleMove({ to: ofSide(battleOrThrow(), "enemy").position, rng: () => 0 });
    const after = battleOrThrow();
    expect(ofSide(after, "enemy").hp).toBeLessThan(enemyBefore);
    expect(ofSide(after, "player").ap).toBe(apBefore - 3);
    expect(state().selectedSpellId).toBeNull();
  });
});

describe("sorts, tours et sortie du combat unifié", () => {
  it("terminer le tour rend la main à l'oiseau, qui riposte, puis au héros", () => {
    const battle = bringEnemy(TOUGH);
    state().endTurn();
    const after = battleOrThrow();
    expect(ofSide(after, "player").hp).toBeLessThan(ofSide(battle, "player").hp);
    expect(ofSide(after, "player").id).toBe(after.order[after.activeIndex]);
  });

  it("la victoire crédite l'XP, reporte les PV et ramène le héros sur la carte", () => {
    bringEnemy(1);
    state().clickCell(ofSide(battleOrThrow(), "enemy").position);
    expect(isVictory(battleOrThrow())).toBe(true);
    state().settleDungeonRoom();
    expect(state().battle).toBeNull();
    expect(state().mode).toBe("exploration");
    expect(state().exploration).not.toBeNull();
    expect(useGameStore.getState().hero?.xp).toBeGreaterThan(0);
  });
});
