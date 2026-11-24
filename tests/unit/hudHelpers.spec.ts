import { describe, expect, it } from "vitest";
import type {
  CombatantState,
  CombatPhase,
  CombatRewards,
  CombatState,
} from "../../src/engine/combatLoop/types";
import type { AsciiMap } from "../../src/engine/grid";
import type { Element, SpellDef } from "../../src/schemas/spellSchema";
import {
  HUD_COLORS,
  buildSpellSlots,
  canCastSpell,
  formatHpBar,
  formatSpellRange,
  getRecentLog,
  isBattleOver,
  logTone,
  phaseLabel,
  shortcutNumberForSlot,
  shouldShowRewards,
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
    percentDmg: 0,
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

describe("shouldShowRewards", () => {
  const REWARDS: CombatRewards = {
    xpGained: 12,
    totalXp: 12,
    level: 1,
    levelUp: null,
    prospection: 100,
    drops: ["ferraille"],
  };

  it("affiche les gains en victoire quand le store en fournit", () => {
    expect(shouldShowRewards("victory", REWARDS)).toBe(true);
  });

  it("n'affiche aucun gain en victoire sans récompenses", () => {
    expect(shouldShowRewards("victory", null)).toBe(false);
  });

  it("n'affiche aucun gain en défaite, même si le store en fournit", () => {
    expect(shouldShowRewards("defeat", REWARDS)).toBe(false);
  });

  it("n'affiche aucun gain pendant un tour", () => {
    expect(shouldShowRewards("player_turn", REWARDS)).toBe(false);
    expect(shouldShowRewards("enemy_turn", REWARDS)).toBe(false);
  });
});

const SLOT_COUNT = 12;

function emptySlots(count: number): null[] {
  return Array.from({ length: count }, () => null);
}

function fakeSpells(count: number): { ids: string[]; spellsById: Record<string, SpellDef> } {
  const ids = Array.from({ length: count }, (_, index) => `sort_${index}`);
  const spellsById = Object.fromEntries(ids.map((id) => [id, makeSpell({ id })]));
  return { ids, spellsById };
}

function combatWithSpells(count: number): CombatState {
  const { ids, spellsById } = fakeSpells(count);
  return makeCombat({ player: makeCombatant({ spellIds: ids }), spellsById });
}

describe("buildSpellSlots", () => {
  it("retourne toujours douze emplacements pour la grille 2x6", () => {
    expect(buildSpellSlots({ combat: makeCombat(), selectedSpellId: null })).toHaveLength(12);
  });

  it("remplit les emplacements dans l'ordre de player.spellIds", () => {
    const slots = buildSpellSlots({ combat: combatWithSpells(3), selectedSpellId: null });
    expect(slots.slice(0, 3).map((slot) => slot?.id)).toEqual(["sort_0", "sort_1", "sort_2"]);
    expect(slots.slice(3)).toEqual(emptySlots(SLOT_COUNT - 3));
  });

  it("retourne douze emplacements vides quand le joueur n'a aucun sort", () => {
    const combat = makeCombat({ player: makeCombatant({ spellIds: [] }) });
    expect(buildSpellSlots({ combat, selectedSpellId: null })).toEqual(emptySlots(SLOT_COUNT));
  });

  it("laisse l'emplacement vide quand le sort manque dans spellsById", () => {
    const combat = makeCombat({ player: makeCombatant({ spellIds: ["sort_fantome"] }) });
    const slots = buildSpellSlots({ combat, selectedSpellId: null });
    expect(slots[0]).toBeNull();
  });

  it("tronque la liste au-delà de douze sorts", () => {
    const slots = buildSpellSlots({ combat: combatWithSpells(13), selectedSpellId: null });
    expect(slots).toHaveLength(SLOT_COUNT);
    expect(slots[11]?.id).toBe("sort_11");
  });

  it("produit la même grille quel que soit le sort sélectionné", () => {
    const combat = combatWithSpells(2);
    const withoutSelection = buildSpellSlots({ combat, selectedSpellId: null });
    const withSelection = buildSpellSlots({ combat, selectedSpellId: "sort_1" });
    expect(withSelection).toEqual(withoutSelection);
  });
});

describe("shortcutNumberForSlot", () => {
  it("numérote de 1 à 9 les neuf premiers emplacements", () => {
    expect(shortcutNumberForSlot(0)).toBe("1");
    expect(shortcutNumberForSlot(8)).toBe("9");
  });

  it("n'attribue aucun raccourci aux emplacements 10 à 12", () => {
    expect(shortcutNumberForSlot(9)).toBeNull();
    expect(shortcutNumberForSlot(11)).toBeNull();
  });

  it("n'attribue aucun raccourci à un index hors grille", () => {
    expect(shortcutNumberForSlot(-1)).toBeNull();
    expect(shortcutNumberForSlot(99)).toBeNull();
  });
});

describe("logTone", () => {
  const PLAYER = "Balthazar";

  it("colore en joueur une ligne qui commence par le nom du joueur", () => {
    expect(logTone("Balthazar lance Pression : 9 dégâts.", PLAYER)).toBe("player");
    expect(logTone("Balthazar se déplace de 2 case(s).", PLAYER)).toBe("player");
  });

  it("colore en ennemi une action qui n'appartient pas au joueur", () => {
    expect(logTone("Piou Mazouté lance Bec Mazouté : 6 dégâts.", PLAYER)).toBe("enemy");
    expect(logTone("Piou Mazouté se téléporte.", PLAYER)).toBe("enemy");
  });

  it("colore en système les lignes de tour et d'ouverture", () => {
    expect(logTone("Tour 2 : à Balthazar de jouer.", PLAYER)).toBe("system");
    expect(logTone("Fin du combat.", PLAYER)).toBe("system");
  });

  it("reste robuste sur une ligne vide", () => {
    expect(logTone("", PLAYER)).toBe("system");
  });
});

describe("HUD_COLORS", () => {
  it("fige la palette rétro Dofus 1.29", () => {
    expect(HUD_COLORS).toEqual({
      stone: "#2b241d",
      copper: "#8c6d46",
      parchment: "#3d342a",
      text: "#e8dcc8",
      hpRed: "#b83b3b",
      apBlue: "#3b6fb8",
      mpGreen: "#4a8c4a",
      gold: "#d4a537",
    });
  });
});
