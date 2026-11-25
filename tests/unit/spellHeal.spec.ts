import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { healAmount, scaledHeal } from "../../src/engine/combat";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { isSpellImplemented } from "../../src/engine/combatLoop/spellSupport";
import type { CombatantState, CombatState } from "../../src/engine/combatLoop/types";
import { parseAsciiMap } from "../../src/engine/grid";
import { resolveHeal } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike, HealSpec } from "../../src/engine/multiCombat";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { armedBattleSpell, battleSpellSlots, isUnifiedCastable } from "../../src/store/battleSpells";
import { battleClickRoute } from "../../src/store/battleRouting";
import { slotLook } from "../../src/ui/spellSlotState";

/**
 * SPELL-02, première tranche : le soin (`effect.type: heal`, `mot_curatif`).
 * La règle 1.29 vit une seule fois (`healAmount`, `scaledHeal`) et les deux
 * chemins de cast la consomment. Un soin ne dépasse jamais `maxHp`, ne
 * ressuscite personne, et reste soumis aux PA, au quota et au camp de la cible.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const spells = parseSpellsYaml(read("spells.yaml"));

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };

function mustFind(id: string): SpellDef {
  const found = spells.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

/** Soin de test : 9 PV fixes, 6 PA, un lancer par tour, sur soi. */
function healSpell(overrides: Partial<SpellDef> = {}): SpellDef {
  const base: SpellDef = {
    id: "mot_de_test",
    name: "Mot de Test",
    description: "Soin de test, 9 PV fixes.",
    classId: "eniripsa",
    kind: "other",
    element: "neutral",
    apCost: 6,
    minRange: 0,
    maxRange: 0,
    requiresLos: false,
    castsPerTurn: 1,
    effect: { type: "heal", amount: { min: 9, max: 9 }, target: "self" },
  };
  return { ...base, ...overrides };
}

function combatant(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    id: "player",
    kind: "player",
    name: "Balthazar",
    level: 1,
    hp: 60,
    maxHp: 60,
    ap: 12,
    maxAp: 12,
    mp: 3,
    maxMp: 3,
    accuracyPct: 100,
    pp: 100,
    percentDmg: 0,
    position: { x: 0, y: 0 },
    stats: { ...STATS },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    spellIds: [],
    ...overrides,
  };
}

function combatFor(spell: SpellDef, player: Partial<CombatantState> = {}): CombatState {
  return {
    phase: "player_turn",
    turn: 1,
    map: parseAsciiMap(["..", ".."]),
    player: combatant({ spellIds: [spell.id], ...player }),
    enemy: combatant({ id: "enemy", kind: "enemy", position: { x: 1, y: 0 } }),
    spellsById: { [spell.id]: spell },
    log: [],
    rewards: null,
  };
}

function castHeal(spell: SpellDef, player: Partial<CombatantState>, rng = () => 0): CombatState {
  const state = combatFor(spell, player);
  return castSpell({ state, spellId: spell.id, target: { x: 0, y: 0 }, rng });
}

function battleant(overrides: Partial<CombatantLike> = {}): CombatantLike {
  const base: CombatantLike = {
    id: "hero",
    side: "player",
    name: "Balthazar",
    level: 1,
    hp: 60,
    maxHp: 60,
    ap: 12,
    maxAp: 12,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { ...STATS },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    spellIds: [],
    initiative: 10,
  };
  return { ...base, ...overrides };
}

function battleFor(hero: Partial<CombatantLike> = {}): BattleState {
  return {
    turn: 1,
    order: ["hero", "enemy"],
    activeIndex: 0,
    combatants: [
      battleant({ spellIds: ["mot_de_test"], ...hero }),
      battleant({ id: "enemy", side: "enemy", name: "Piou", position: { x: 1, y: 0 } }),
    ],
    log: [],
  };
}

const SPEC: HealSpec = {
  id: "mot_de_test",
  name: "Mot de Test",
  apCost: 6,
  min: 9,
  max: 9,
  scales: false,
  castsPerTurn: 1,
};

function healOnSelf(state: BattleState, spec: HealSpec = SPEC): BattleState {
  return resolveHeal({ state, healerId: "hero", targetId: "hero", heal: spec, rng: () => 0 });
}

describe("règle de soin 1.29 — une seule définition", () => {
  it("borne le soin aux PV manquants", () => {
    expect(healAmount({ heal: 9, currentHp: 55, maxHp: 60 })).toBe(5);
  });

  it("rend 0 à PV pleins et ne rend jamais de PV sur un jet négatif", () => {
    expect(healAmount({ heal: 9, currentHp: 60, maxHp: 60 })).toBe(0);
    expect(healAmount({ heal: -4, currentHp: 10, maxHp: 60 })).toBe(0);
  });

  it("applique la stat de soin 1.29 : floor(base × (100 + Intelligence) / 100)", () => {
    expect(scaledHeal(12, 40)).toBe(16);
    expect(scaledHeal(12, 0)).toBe(12);
    expect(scaledHeal(12, -100)).toBe(12);
  });
});

describe("liste blanche — heal n'est plus « à venir »", () => {
  it("reconnaît le soin réel de data/spells.yaml et laisse les autres effets inertes", () => {
    expect(isSpellImplemented(mustFind("mot_curatif"))).toBe(true);
    expect(isSpellImplemented(mustFind("armure_terrestre"))).toBe(false);
    expect(isSpellImplemented(mustFind("glyphe_agressif"))).toBe(false);
  });

  it("expose les cases de soin sur soi-même, jamais sur l'ennemi", () => {
    const spell = mustFind("mot_curatif");
    expect(getCastableCells(combatFor(spell), spell.id)).toEqual([{ x: 0, y: 0 }]);
  });

  it("un sort de soin est lançable au HUD, un buff reste « à venir »", () => {
    const spell = mustFind("mot_curatif");
    const combat = combatFor(spell, { hp: 40, ap: 12 });
    const input = { combat, selectedSpellId: null };
    expect(slotLook(input, spell)).toMatchObject({ state: "disponible", disabled: false });
    expect(slotLook(input, mustFind("armure_terrestre"))).toMatchObject({ state: "a-venir", disabled: true });
  });
});

describe("cast 1v1 — soin borné, PA et quota", () => {
  it("5 PV manquants, jet 9 : +5, PV au maximum, 6 PA dépensés et journal", () => {
    const next = castHeal(healSpell(), { hp: 55, ap: 12 });
    expect(next.player.hp).toBe(60);
    expect(next.player.ap).toBe(6);
    expect(next.log.at(-1)).toBe("Balthazar soigne Balthazar de 5 PV.");
    expect(next.floats?.at(-1)).toMatchObject({ targetId: "player", amount: 5, kind: "heal" });
  });

  it("lance le vrai Mot Curatif : jet min 5, Intelligence 0, 6 PA", () => {
    const next = castHeal(mustFind("mot_curatif"), { hp: 40, ap: 12 });
    expect(next.player.hp).toBe(45);
    expect(next.player.ap).toBe(6);
  });

  it("applique la stat de soin : Intelligence 40 porte le jet min 5 à 7", () => {
    const stats = { ...STATS, intelligence: 40 };
    const next = castHeal(mustFind("mot_curatif"), { hp: 40, ap: 12, stats });
    expect(next.player.hp).toBe(47);
  });

  it("à PV pleins le soin est légal et rend 0 PV (PA consommés, aucun surplus)", () => {
    const next = castHeal(healSpell(), { hp: 60, ap: 12 });
    expect(next.player.hp).toBe(60);
    expect(next.player.ap).toBe(6);
    expect(next.log.at(-1)).toContain("de 0 PV");
  });
});

describe("cast 1v1 — refus et quota", () => {
  it("le second lancer du tour est refusé par identité (castsPerTurn: 1)", () => {
    const first = castHeal(healSpell(), { hp: 40, ap: 12 });
    const second = castSpell({ state: first, spellId: "mot_de_test", target: { x: 0, y: 0 }, rng: () => 0 });
    expect(second).toBe(first);
    expect(first.player.ap).toBe(6);
  });

  it("refuse un soin sur l'ennemi, sans consommer de PA", () => {
    const state = combatFor(healSpell(), { hp: 40, ap: 12 });
    const next = castSpell({ state, spellId: "mot_de_test", target: { x: 1, y: 0 }, rng: () => 0 });
    expect(next).toBe(state);
  });

  it("refuse un soin sans les PA", () => {
    const state = combatFor(healSpell(), { hp: 40, ap: 5 });
    const next = castSpell({ state, spellId: "mot_de_test", target: { x: 0, y: 0 }, rng: () => 0 });
    expect(next).toBe(state);
  });
});

describe("cast 1vN — le même soin, une seule règle", () => {
  it("5 PV manquants, jet 9 : +5, PV au maximum, PA et journal", () => {
    const next = healOnSelf(battleFor({ hp: 55 }));
    const hero = next.combatants[0] as CombatantLike;
    expect(hero.hp).toBe(60);
    expect(hero.ap).toBe(6);
    expect(next.log.at(-1)).toBe("Balthazar soigne Balthazar de 5 PV.");
    expect(next.floats?.at(-1)).toMatchObject({ targetId: "hero", amount: 5, kind: "heal" });
  });

  it("refuse un soin sur l'ennemi par identité", () => {
    const state = battleFor({ hp: 40 });
    const next = resolveHeal({ state, healerId: "hero", targetId: "enemy", heal: SPEC, rng: () => 0 });
    expect(next).toBe(state);
  });

  it("respecte castsPerTurn: le second lancer du tour est refusé", () => {
    const first = healOnSelf(battleFor({ hp: 40 }));
    expect(healOnSelf(first)).toBe(first);
    expect(first.combatants[0]?.ap).toBe(6);
  });

  it("à PV pleins le soin est légal et rend 0 PV", () => {
    const next = healOnSelf(battleFor({ hp: 60 }));
    expect(next.combatants[0]?.hp).toBe(60);
    expect(next.combatants[0]?.ap).toBe(6);
    expect(next.log.at(-1)).toContain("de 0 PV");
  });
});

describe("cast 1vN — stat de soin", () => {
  it("Intelligence 40 porte le jet 9 à 12 (floor(9 × 140 / 100))", () => {
    const stats = { ...STATS, intelligence: 40 };
    const next = healOnSelf(battleFor({ hp: 40, stats }), { ...SPEC, scales: true });
    expect(next.combatants[0]?.hp).toBe(52);
  });
});

describe("barre unifiée et routage — le soin est sélectionnable et cliquable", () => {
  it("inclut le soin, exclut encore le buff", () => {
    expect(isUnifiedCastable(mustFind("mot_curatif"))).toBe(true);
    expect(isUnifiedCastable(mustFind("armure_terrestre"))).toBe(false);
  });

  it("le slot de soin est disponible et le sort s'arme", () => {
    const battle = battleFor({ hp: 40, spellIds: ["mot_curatif", "armure_terrestre"] });
    const slots = battleSpellSlots({ battle, spells, selectedSpellId: null });
    expect(slots.map((entry) => entry.spellId)).toEqual(["mot_curatif"]);
    expect(slots[0]).toMatchObject({ state: "disponible", disabled: false });
    expect(armedBattleSpell({ battle, spells, selectedSpellId: "mot_curatif" })?.id).toBe("mot_curatif");
  });

  it("un clic sur le héros avec un soin armé route vers le sort, pas vers le déplacement", () => {
    const battle = battleFor({ hp: 40 });
    const route = battleClickRoute({ battle, target: { x: 0, y: 0 }, spellSelected: true, selfSpell: true });
    expect(route).toEqual({ kind: "spell", targetId: "hero" });
  });

  it("sans sort de soin armé, le clic sur le héros reste un déplacement", () => {
    const battle = battleFor({ hp: 40 });
    const route = battleClickRoute({ battle, target: { x: 0, y: 0 }, spellSelected: false });
    expect(route).toEqual({ kind: "move" });
  });
});
