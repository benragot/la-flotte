import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import { beginCombat, openingPhase } from "../../src/engine/combatLoop/opening";
import type { CombatState, CombatStats, Rng } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * COMBAT-01 — l'ouverture du 1v1 ne calculait aucune initiative : `initCombat`
 * forçait `phase: "player_turn"`, donc le héros jouait toujours en premier,
 * même face à un monstre plus rapide.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));

const NO_STATS: CombatStats = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const FAST_STATS: CombatStats = { ...NO_STATS, strength: 100 };
const alwaysZero: Rng = () => 0;

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

/** Héros à 0,0 et monstre au contact en 1,0 : l'IA frappe dès qu'elle ouvre. */
function combatWith(playerStats: CombatStats, enemyStats: CombatStats): CombatState {
  const base = initCombat({
    map: parseAsciiMap(["PM.."]),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "piou_mazoute"),
    spells,
  });
  const fullHp = { hp: 100, maxHp: 100 };
  const player = { ...base.player, ...fullHp, stats: playerStats };
  // Stats synthétiques : on retire l'initiative stockée (MONSTER-01) pour
  // tester la seule formule `computeInitiative`.
  const enemy = { ...base.enemy, ...fullHp, stats: enemyStats, storedInitiative: undefined };
  return { ...base, player, enemy };
}

describe("openingPhase — initiative 1.29", () => {
  it("donne l'ouverture au monstre strictement plus rapide", () => {
    expect(openingPhase(combatWith(NO_STATS, FAST_STATS))).toBe("enemy_turn");
  });

  it("laisse le héros ouvrir quand il est plus rapide", () => {
    expect(openingPhase(combatWith(FAST_STATS, NO_STATS))).toBe("player_turn");
  });

  it("départage l'égalité en faveur du héros", () => {
    expect(openingPhase(combatWith(FAST_STATS, FAST_STATS))).toBe("player_turn");
  });

  it("pondère l'initiative par les PV restants", () => {
    const state = combatWith({ ...NO_STATS, strength: 50 }, FAST_STATS);
    expect(openingPhase({ ...state, enemy: { ...state.enemy, hp: 50 } })).toBe("player_turn");
  });
});

describe("beginCombat — ouverture ennemie", () => {
  it("joue le tour du monstre puis rend la main au héros, tour 1", () => {
    const state = combatWith(NO_STATS, FAST_STATS);
    const next = beginCombat(state, alwaysZero);
    expect(next.turn).toBe(1);
    expect(next.phase).toBe("player_turn");
    expect(next.player.hp).toBeLessThan(state.player.hp);
    expect([next.player.ap, next.player.mp]).toEqual([next.player.maxAp, next.player.maxMp]);
  });

  it("journalise l'initiative qui a donné l'ouverture au monstre", () => {
    const next = beginCombat(combatWith(NO_STATS, FAST_STATS), alwaysZero);
    expect(next.log).toContain("Piou Mazouté joue en premier (initiative 100 vs 0).");
  });

  it("laisse la défaite quand le monstre tue le héros", () => {
    const state = combatWith(NO_STATS, FAST_STATS);
    const weak = { ...state, player: { ...state.player, hp: 5 } };
    expect(beginCombat(weak, alwaysZero).phase).toBe("defeat");
  });
});

describe("beginCombat — ouverture du héros", () => {
  it("renvoie l'état par identité, sans tour ennemi", () => {
    const state = combatWith(FAST_STATS, NO_STATS);
    expect(beginCombat(state, alwaysZero)).toBe(state);
  });
});

describe("non-régression — initCombat et buildCombat", () => {
  it("laisse initCombat en phase joueur, sans stats ni équipement", () => {
    const state = initCombat({
      map: parseAsciiMap(["PM.."]),
      hero: createHero("Balthazar", mustFind(classes, "iop")),
      monster: mustFind(monsters, "piou_mazoute"),
      spells,
    });
    expect(state.phase).toBe("player_turn");
  });

  it("ne stocke jamais une phase ennemie en attente d'un clic", () => {
    useGameStore.getState().resetGame();
    useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
    useCombatStore.getState().startExploration();
    const group = useCombatStore.getState().exploration?.monsterGroups[0];
    if (group === undefined) throw new Error("aucun groupe sur la carte");
    useCombatStore.getState().clickCell(group.pos);
    const combat = useCombatStore.getState().combat;
    expect(combat?.phase).toBe("player_turn");
    expect(combat?.player.ap).toBe(combat?.player.maxAp);
    // MONSTER-01 : le Piou de `data/monsters.yaml` porte `initiative: 0` (1.29),
    // il n'ouvre donc plus le combat : aucune ligne d'ouverture ennemie.
    expect(combat?.log.some((line) => line.includes("joue en premier"))).toBe(false);
  });
});
