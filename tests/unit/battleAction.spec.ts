import { describe, expect, it } from "vitest";
import type { BattleState, CombatantLike, Side } from "../../src/engine/multiCombat";
import { lastActionFromBattle } from "../../src/renderer/battleAction";

const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const STATS = { strength: 10, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };

function combatant(id: string, side: Side, name: string, x: number): CombatantLike {
  const pools = { level: 1, hp: 30, maxHp: 30, ap: 6, maxAp: 6, mp: 3, maxMp: 3 };
  const body = { ...pools, id, side, name, position: { x, y: 0 }, stats: STATS, initiative: 10 };
  return { ...body, resistances: { flat: { ...ZERO }, percent: { ...ZERO } } };
}

/** Salle minimale : le héros et deux monstres homonymes, comme la salle 1. */
function room(log: readonly string[], extra: Partial<BattleState> = {}): BattleState {
  const combatants = [
    combatant("player", "player", "Balthazar", 0),
    combatant("piou-0", "enemy", "Piou Mazouté", 1),
    combatant("piou-1", "enemy", "Piou Mazouté", 2),
  ];
  const order = combatants.map((entry) => entry.id);
  return { turn: 2, order, activeIndex: 0, combatants, log: [...log], ...extra };
}

describe("lastActionFromBattle — dérivé du journal de salle", () => {
  it("rend null tant qu'aucune action n'est journalisée", () => {
    expect(lastActionFromBattle(room([]))).toBeNull();
    expect(lastActionFromBattle(room(["Entrée dans la salle"]))).toBeNull();
  });

  it("lit une attaque nue : acteur, cible et signature", () => {
    const action = lastActionFromBattle(room(["Balthazar frappe Piou Mazouté : 12 dégâts."]));
    expect(action).toMatchObject({ kind: "attack", actorId: "player", targetId: "piou-0", signature: "log-0" });
    expect(action).not.toHaveProperty("at");
  });

  it("distingue un sort lancé (avec son nom) d'une attaque nue", () => {
    const line = "Balthazar frappe Piou Mazouté avec Pression (critique) : 22 dégâts.";
    expect(lastActionFromBattle(room([line]))).toMatchObject({ kind: "spell", actorId: "player", targetId: "piou-0" });
  });

  it("lit les dégâts subis par le héros comme une attaque ennemie", () => {
    const action = lastActionFromBattle(room(["Piou Mazouté frappe Balthazar : 7 dégâts."]));
    expect(action).toMatchObject({ kind: "attack", actorId: "piou-0", targetId: "player" });
  });

  it("lit un déplacement sans cible", () => {
    const action = lastActionFromBattle(room(["Balthazar se déplace de 2 case(s)."]));
    expect(action).toMatchObject({ kind: "move", actorId: "player" });
    expect(action?.targetId).toBeUndefined();
  });

  it("désambiguïse deux monstres du même nom par le nombre flottant", () => {
    const floats = [{ id: 1, targetId: "piou-1", amount: 9, kind: "damage" as const }];
    const action = lastActionFromBattle(room(["Balthazar frappe Piou Mazouté : 9 dégâts."], { floats }));
    expect(action?.targetId).toBe("piou-1");
  });
});

describe("lastActionFromBattle — signature et refus", () => {
  it("ignore un refus journalisé après l'action, sans rejouer la signature", () => {
    const before = lastActionFromBattle(room(["Balthazar frappe Piou Mazouté : 9 dégâts."]));
    const lines = ["Balthazar frappe Piou Mazouté : 9 dégâts.", "Balthazar ne peut pas atteindre le héros (portée)."];
    expect(lastActionFromBattle(room(lines))).toEqual(before);
  });

  it("change de signature quand la même action se répète", () => {
    const once = lastActionFromBattle(room(["Balthazar frappe Piou Mazouté : 9 dégâts."]));
    const repeated = ["Balthazar frappe Piou Mazouté : 9 dégâts.", "Balthazar frappe Piou Mazouté : 9 dégâts."];
    expect(lastActionFromBattle(room(repeated))?.signature).not.toBe(once?.signature);
  });
});
