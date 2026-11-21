import { describe, expect, it } from "vitest";
import type {
  CombatantState,
  CombatPhase,
  CombatState,
} from "../../src/engine/combatLoop/types";
import type { AsciiMap } from "../../src/engine/grid";
import type { Element, SpellDef } from "../../src/schemas/spellSchema";
import {
  canCastSpell,
  formatHpBar,
  formatSpellRange,
  getRecentLog,
  isBattleOver,
  phaseLabel,
} from "../../src/ui/hudHelpers";

const ELEMENTS: readonly Element[] = ["earth", "fire", "water", "air", "neutral"];

function zeroElements(): Record<Element, number> {
  return Object.fromEntries(ELEMENTS.map((element) => [element, 0])) as Record<
    Element,
    number
  >;
}

const DEMO_MAP: AsciiMap = {
  width: 2,
  height: 2,
  cells: [
    [".", "."],
    [".", "."],
  ],
  playerSpawns: [{ x: 0, y: 0 }],
  monsterSpawns: [{ x: 1, y: 1 }],
};

function makeCombatant(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    id: "combatant",
    kind: "player",
    name: "Balthazar",
    level: 1,
    hp: 30,
    maxHp: 30,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    accuracyPct: 100,
    pp: 100,
    position: { x: 0, y: 0 },
    stats: { strength: 10, intelligence: 10, chance: 10, agility: 10, wisdom: 10 },
    resistances: { flat: zeroElements(), percent: zeroElements() },
    spellIds: ["coup_de_pressing"],
    ...overrides,
  };
}

function makeSpell(overrides: Partial<SpellDef> = {}): SpellDef {
  return {
    id: "coup_de_pressing",
    name: "Coup de Pressing",
    description: "Une claque administrativement contestable.",
    classId: "iop",
    kind: "damage",
    element: "earth",
    apCost: 3,
    minRange: 1,
    maxRange: 2,
    requiresLos: true,
    damage: { min: 4, max: 7 },
    ...overrides,
  };
}

function makeCombat(overrides: Partial<CombatState> = {}): CombatState {
  const spell = makeSpell();
  return {
    phase: "player_turn",
    turn: 1,
    map: DEMO_MAP,
    player: makeCombatant(),
    enemy: makeCombatant({ id: "piou", kind: "enemy", name: "Piou Mazouté" }),
    spellsById: { [spell.id]: spell },
    log: [],
    rewards: null,
    ...overrides,
  };
}

function expectsFalseForPhases(spell: SpellDef, phases: readonly CombatPhase[]): void {
  phases.forEach((phase) => {
    const combat = makeCombat({ phase });
    expect(canCastSpell({ spell, combat })).toBe(false);
  });
}

describe("canCastSpell", () => {
  it("autorise un sort pendant le tour du joueur avec assez de PA", () => {
    const spell = makeSpell();
    expect(canCastSpell({ spell, combat: makeCombat() })).toBe(true);
  });

  it("autorise un sort dont le coût égale exactement les PA disponibles", () => {
    const spell = makeSpell({ apCost: 6 });
    expect(canCastSpell({ spell, combat: makeCombat() })).toBe(true);
  });

  it("refuse un sort trop cher en PA", () => {
    const spell = makeSpell({ apCost: 7 });
    expect(canCastSpell({ spell, combat: makeCombat() })).toBe(false);
  });

  it("refuse un sort hors du tour du joueur", () => {
    const spell = makeSpell();
    expectsFalseForPhases(spell, ["enemy_turn", "victory", "defeat"]);
  });
});

describe("getRecentLog", () => {
  const LOG = ["a", "b", "c", "d", "e", "f"];

  it("retourne les cinq dernières entrées dans l'ordre chronologique", () => {
    expect(getRecentLog(LOG, 5)).toEqual(["b", "c", "d", "e", "f"]);
  });

  it("retourne un tableau vide pour une limite nulle ou négative", () => {
    expect(getRecentLog(LOG, 0)).toEqual([]);
    expect(getRecentLog(LOG, -2)).toEqual([]);
  });

  it("retourne tout le journal quand la limite le dépasse", () => {
    expect(getRecentLog(LOG, 99)).toEqual(LOG);
  });

  it("ne mute jamais le journal source", () => {
    const log = ["a", "b"];
    const recent = getRecentLog(log, 2);
    recent.push("injecté");
    expect(log).toEqual(["a", "b"]);
  });
});

describe("formatHpBar", () => {
  it("formate des PV nominaux", () => {
    expect(formatHpBar(15, 30)).toEqual({ text: "15 / 30", percent: 50 });
  });

  it("ne divise pas par zéro quand max vaut zéro", () => {
    expect(formatHpBar(10, 0)).toEqual({ text: "0 / 0", percent: 0 });
  });

  it("borne des PV négatifs à zéro", () => {
    expect(formatHpBar(-5, 30)).toEqual({ text: "0 / 30", percent: 0 });
  });

  it("borne des PV débordants au maximum", () => {
    expect(formatHpBar(90, 30)).toEqual({ text: "30 / 30", percent: 100 });
  });
});

describe("formatSpellRange", () => {
  it("affiche une portée fixe", () => {
    expect(formatSpellRange(makeSpell({ minRange: 1, maxRange: 1 }))).toBe("1 PO");
  });

  it("affiche une portée variable", () => {
    expect(formatSpellRange(makeSpell({ minRange: 1, maxRange: 6 }))).toBe("1–6 PO");
  });
});

describe("phaseLabel", () => {
  it("nomme les quatre phases", () => {
    expect(phaseLabel("player_turn")).toBe("À toi de jouer");
    expect(phaseLabel("enemy_turn")).toBe("Tour adverse");
    expect(phaseLabel("victory")).toBe("Victoire");
    expect(phaseLabel("defeat")).toBe("Défaite");
  });
});

describe("isBattleOver", () => {
  it("reconnaît une bataille terminée", () => {
    expect(isBattleOver("victory")).toBe(true);
    expect(isBattleOver("defeat")).toBe(true);
  });

  it("reconnaît une bataille en cours", () => {
    expect(isBattleOver("player_turn")).toBe(false);
    expect(isBattleOver("enemy_turn")).toBe(false);
  });
});
