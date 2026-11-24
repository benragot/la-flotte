import { describe, expect, it } from "vitest";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { AttackGate } from "../../src/ui/battle/attackButtonState";
import { attackButtonState, attackGate } from "../../src/ui/battle/attackButtonState";

/**
 * UI-02 : le bouton « Attaquer » doit refléter le coût réel et se désactiver
 * quand le moteur refuserait le clic (PA insuffisants, sort en recharge).
 * Les tests portent sur le helper pur, sans jsdom ni store.
 */

const RESISTANCES = {
  flat: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 },
  percent: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 },
};

function combatant(overrides: Partial<CombatantLike> = {}): CombatantLike {
  return {
    id: "player",
    side: "player",
    name: "Balthazar",
    level: 1,
    hp: 60,
    maxHp: 60,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { strength: 20, intelligence: 0, chance: 0, agility: 10, wisdom: 0 },
    resistances: RESISTANCES,
    initiative: 100,
    ...overrides,
  };
}

function battle(overrides: Partial<BattleState> = {}): BattleState {
  const enemy = combatant({ id: "piou-0", side: "enemy", name: "Piou", initiative: 10 });
  return {
    turn: 1,
    order: ["player", "piou-0"],
    activeIndex: 0,
    combatants: [combatant(), enemy],
    log: [],
    ...overrides,
  };
}

const SPELL = { id: "pression", apCost: 3 };
const RECHARGING = { "player:pression": { casts: 1, turn: 1, readyAt: 4 } };

function gate(overrides: Partial<AttackGate> = {}): AttackGate {
  return { ap: 6, apCost: 3, cooldownLeft: 0, ...overrides };
}

describe("attackButtonState — libellé et désactivation", () => {
  it("annonce le coût réel quand l'attaque est payable", () => {
    expect(attackButtonState(gate())).toEqual({ disabled: false, label: "Attaquer (3 PA)" });
  });

  it("désactive le bouton quand les PA manquent, sans annoncer un autre coût", () => {
    expect(attackButtonState(gate({ ap: 2 }))).toEqual({ disabled: true, label: "Attaquer (3 PA)" });
  });

  it("désactive le bouton pendant la recharge et annonce les tours restants", () => {
    expect(attackButtonState(gate({ ap: 6, cooldownLeft: 2 }))).toEqual({
      disabled: true,
      label: "Recharge (2)",
    });
  });

  it("garde le bouton actif quand le sort est inconnu (aucun chiffre inventé)", () => {
    expect(attackButtonState(null)).toEqual({ disabled: false, label: "Attaquer" });
  });
});

describe("attackGate — lecture du héros actif", () => {
  it("lit les PA du héros actif et le coût du sort", () => {
    expect(attackGate(battle(), SPELL)).toEqual({ ap: 6, apCost: 3, cooldownLeft: 0 });
  });

  it("compte les tours de recharge restants depuis `spellUsage`", () => {
    expect(attackGate(battle({ turn: 2, spellUsage: RECHARGING }), SPELL)).toEqual({
      ap: 6,
      apCost: 3,
      cooldownLeft: 2,
    });
  });

  it("ne rend rien quand l'actif n'est pas le héros : le bouton ne le concerne pas", () => {
    expect(attackGate(battle({ activeIndex: 1 }), SPELL)).toBeNull();
  });

  it("ne rend rien sans sort de dégâts connu", () => {
    expect(attackGate(battle(), null)).toBeNull();
  });
});
