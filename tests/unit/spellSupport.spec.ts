import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CombatantState, CombatState } from "../../src/engine/combatLoop/types";
import { castSpell, spellRefusal } from "../../src/engine/combatLoop/cast";
import { parseAsciiMap } from "../../src/engine/grid";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

/**
 * QA #156 : le HUD et le moteur doivent refuser le **même** sort pour le même
 * motif. Aucun système d'états n'existe encore (SPELL-02), donc `requiresState`
 * est un refus moteur nommé `missing-state`, jamais une promesse du HUD.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const spells = parseSpellsYaml(read("spells.yaml"));

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function mustFind(id: string): SpellDef {
  const found = spells.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
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
    stats: { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    spellIds: [],
    ...overrides,
  };
}

function combatFor(spellId: string): CombatState {
  return {
    phase: "player_turn",
    turn: 1,
    map: parseAsciiMap(["..", ".."]),
    player: combatant({ spellIds: [spellId] }),
    enemy: combatant({ id: "enemy", kind: "enemy", position: { x: 1, y: 0 } }),
    spellsById: { [spellId]: mustFind(spellId) },
    log: [],
    rewards: null,
  };
}

const RNG = (): number => 0.5;

describe("cast.ts — refus nommé pour un état non géré", () => {
  it("nomme missing-state pour Gueule de Bois (requiresState sans système d'états)", () => {
    expect(spellRefusal(combatFor("gueule_de_bois"), "gueule_de_bois")).toBe("missing-state");
  });

  it("refuse Gueule de Bois par identité, même sur une cible valide et en PA", () => {
    const state = combatFor("gueule_de_bois");
    const next = castSpell({ state, spellId: "gueule_de_bois", target: { x: 1, y: 0 }, rng: RNG });
    expect(next).toBe(state);
  });

  it("nomme aussi missing-state pour Poing Enflammé (requiresState sans système d'états)", () => {
    expect(spellRefusal(combatFor("poing_enflamme"), "poing_enflamme")).toBe("missing-state");
  });

  it("laisse Pression partir : le refus ne touche pas les sorts sans état requis", () => {
    const state = combatFor("pression");
    expect(spellRefusal(state, "pression")).toBeNull();
    const next = castSpell({ state, spellId: "pression", target: { x: 1, y: 0 }, rng: RNG });
    expect(next).not.toBe(state);
  });
});
