import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CombatantState, CombatState } from "../../src/engine/combatLoop/types";
import { parseAsciiMap } from "../../src/engine/grid";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import type { SlotLook } from "../../src/ui/spellSlotState";
import { slotLook, slotStateOf } from "../../src/ui/spellSlotState";

/**
 * UI-01 : un sort qui ne peut pas partir ne doit jamais produire un clic mort.
 * L'état exposé à la case est une valeur pure (`slotLook`) : `disabled`, un
 * badge court et un motif lisible. Le rendu ne refait aucune règle.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const spells = parseSpellsYaml(read("spells.yaml"));

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function combatant(overrides: Partial<CombatantState> = {}): CombatantState {
  return {
    id: "player",
    kind: "player",
    name: "Balthazar",
    level: 1,
    hp: 60,
    maxHp: 60,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    accuracyPct: 100,
    pp: 100,
    percentDmg: 0,
    position: { x: 0, y: 0 },
    stats: { strength: 10, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    spellIds: ["pression"],
    ...overrides,
  };
}

function spell(overrides: Partial<SpellDef> = {}): SpellDef {
  const base: SpellDef = {
    id: "pression",
    name: "Pression",
    description: "Un sort de test, portée 1, sans ligne de vue.",
    classId: "iop",
    kind: "damage",
    element: "earth",
    apCost: 3,
    minRange: 1,
    maxRange: 1,
    requiresLos: false,
    damage: { min: 1, max: 1 },
  };
  return { ...base, ...overrides };
}

function combat(overrides: Partial<CombatState> = {}): CombatState {
  return {
    phase: "player_turn",
    turn: 1,
    map: parseAsciiMap([".......", ".......", "......."]),
    player: combatant(),
    enemy: combatant({ id: "enemy", kind: "enemy", position: { x: 1, y: 0 } }),
    spellsById: { pression: spell() },
    log: [],
    rewards: null,
    ...overrides,
  };
}

function lookOf(id: string, target: SpellDef, overrides: Partial<CombatState> = {}): SlotLook {
  const state = combat({ spellsById: { [id]: target }, ...overrides });
  return slotLook({ combat: state, selectedSpellId: null }, target);
}

function lookFor(target: SpellDef, overrides: Partial<CombatState> = {}): SlotLook {
  return lookOf(target.id, target, overrides);
}

function usageOf(casts: number, readyAt: number, turn = 1): CombatState["spellUsage"] {
  return { "player:pression": { casts, turn, readyAt } };
}

describe("slotLook — une case vide ne cliquote pas", () => {
  it("rend une case vide, désactivée, sans badge", () => {
    const look = slotLook({ combat: combat(), selectedSpellId: null }, null);
    expect(look).toEqual({ state: "vide", disabled: true, badge: null, reason: null });
  });
});

describe("slotLook — effet non implémenté : « à venir », jamais cliquable", () => {
  it("désactive un sort `kind: other` et affiche le badge « à venir »", () => {
    const look = lookFor(spell({ id: "glyphe", name: "Glyphe", kind: "other", element: undefined, damage: undefined, effect: { type: "glyph" } }));
    expect(look.state).toBe("a-venir");
    expect(look.disabled).toBe(true);
    expect(look.badge).toBe("à venir");
    expect(look.reason).toBe("Effet pas encore implémenté");
  });

  it("couvre TOUS les sorts utilitaires non-soignants de data/spells.yaml, sans exception", () => {
    const others = spells.filter((entry) => entry.kind === "other" && entry.effect?.type !== "heal");
    expect(others.length).toBeGreaterThan(0);
    const looks = others.map((entry) => lookOf(entry.id, entry));
    expect(looks.map((look) => look.state)).toEqual(others.map(() => "a-venir"));
    expect(looks.every((look) => look.disabled && look.badge === "à venir")).toBe(true);
  });

  it("la sélection ne repeint jamais un sort non implémenté en cliquable", () => {
    const target = spell({ id: "glyphe", kind: "other", element: undefined, damage: undefined, effect: { type: "glyph" } });
    const state = combat({ spellsById: { glyphe: target } });
    expect(slotLook({ combat: state, selectedSpellId: "glyphe" }, target).state).toBe("a-venir");
  });
});

describe("slotLook — recharge", () => {
  it("affiche « Recharge (n) » et désactive la case", () => {
    const look = lookFor(spell({ cooldown: 2 }), { turn: 2, spellUsage: usageOf(1, 4) });
    expect(look.state).toBe("recharge");
    expect(look.disabled).toBe(true);
    expect(look.badge).toBe("Recharge (2)");
    expect(look.reason).toBe("Recharge (2)");
  });

  it("la recharge l'emporte sur les PA : le joueur voit d'abord pourquoi il attend", () => {
    const player = combatant({ ap: 0 });
    const look = lookFor(spell({ cooldown: 2 }), { turn: 2, player, spellUsage: usageOf(1, 4) });
    expect(look.state).toBe("recharge");
    expect(look.badge).toBe("Recharge (2)");
  });

  it("un tour passé rend la case lançable, sans badge résiduel", () => {
    const look = lookFor(spell({ cooldown: 2 }), { turn: 4, spellUsage: usageOf(1, 4) });
    expect(look).toEqual({ state: "disponible", disabled: false, badge: null, reason: null });
  });
});

describe("slotLook — quota du tour", () => {
  it("désactive un sort dont le quota `castsPerTurn` est épuisé, avec un motif", () => {
    const quota = spell({ id: "pression", castsPerTurn: 1 });
    const look = lookFor(quota, { spellUsage: usageOf(1, 0) });
    expect(look.state).toBe("quota-epuise");
    expect(look.disabled).toBe(true);
    expect(look.reason).toBe("Quota du tour épuisé");
  });
});

describe("slotLook — état non géré (SPELL-02 absent)", () => {
  it("désactive « Gueule de Bois » avec un badge sans promesse", () => {
    const target = mustFind(spells, "gueule_de_bois");
    const look = lookFor(target, { player: combatant({ ap: 12 }) });
    expect(look.state).toBe("etat-non-gere");
    expect(look.disabled).toBe(true);
    expect(look.badge).toBe("état non géré");
    expect(look.reason).toBe("État non géré par le moteur");
  });
});

describe("slotLook — liste blanche des kinds exécutés", () => {
  it("un kind sans handler (même futur) reste « à venir », jamais lançable", () => {
    const heal = { ...spell({ id: "soin" }), kind: "heal" } as unknown as SpellDef;
    const look = lookFor(heal);
    expect(look.state).toBe("a-venir");
    expect(look.disabled).toBe(true);
  });
});

describe("slotLook — la recharge l'emporte sur la sélection", () => {
  it("un sort sélectionné mais en recharge reste « recharge », désactivé", () => {
    const target = spell({ id: "pression", cooldown: 2 });
    const state = combat({ turn: 2, spellsById: { pression: target }, spellUsage: usageOf(1, 4) });
    const look = slotLook({ combat: state, selectedSpellId: "pression" }, target);
    expect(look.state).toBe("recharge");
    expect(look.disabled).toBe(true);
  });
});

describe("slotLook — les causes mécaniques existantes restent lisibles", () => {
  it("PA insuffisants restent désactivés avec leur motif", () => {
    const look = lookFor(spell(), { player: combatant({ ap: 2 }) });
    expect(look).toMatchObject({ state: "pa-insuffisants", disabled: true, reason: "PA insuffisants" });
  });

  it("hors portée reste désactivé avec son motif", () => {
    const look = lookFor(spell(), { player: combatant({ position: { x: 6, y: 2 } }) });
    expect(look).toMatchObject({ state: "hors-portee", disabled: true, reason: "Hors portée" });
  });

  it("hors du tour du joueur, la case est verrouillée", () => {
    const look = lookFor(spell(), { phase: "enemy_turn" });
    expect(look).toMatchObject({ state: "verrouille", disabled: true, reason: "Tour adverse" });
  });
});

describe("slotLook — un sort lançable reste inchangé", () => {
  it("reste actif, sans badge ni motif", () => {
    const look = lookFor(spell());
    expect(look).toEqual({ state: "disponible", disabled: false, badge: null, reason: null });
  });

  it("sélectionné, il reste actif et peint en sélection", () => {
    const target = spell();
    const state = combat({ spellsById: { pression: target } });
    const look = slotLook({ combat: state, selectedSpellId: "pression" }, target);
    expect(look).toEqual({ state: "selectionne", disabled: false, badge: null, reason: null });
  });
});

describe("slotStateOf — compatibilité", () => {
  it("reste l'alias de l'état rendu par slotLook", () => {
    const target = spell();
    const state = combat({ spellsById: { pression: target } });
    expect(slotStateOf({ combat: state, selectedSpellId: null }, target)).toBe("disponible");
    expect(slotStateOf({ combat: state, selectedSpellId: null }, null)).toBe("vide");
  });
});

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}
