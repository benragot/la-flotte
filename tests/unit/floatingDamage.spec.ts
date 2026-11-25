import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FLOAT_BUFFER_SIZE, appendFloat } from "../../src/engine/combat";
import type { FloatingEvent } from "../../src/engine/combat";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildTimeline, resolveAttack } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike, Rng } from "../../src/engine/multiCombat";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

/**
 * Les nombres flottants ne sont pas une règle métier : c'est la valeur **déjà
 * calculée** par `computeDamage` que le moteur doit exposer, avec la **cible**.
 * Ces tests verrouillent la donnée, jamais le rendu : aucun texte n'est lu, aucun
 * journal n'est analysé par expression régulière.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));

const alwaysZero: Rng = () => 0;
const DEMO_MAP_ID = "ferraille_plage_01";
const DEMO_MONSTER_ID = "piou_mazoute";

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

const ZERO_STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const ZERO_RES = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function duelist(overrides: Partial<CombatantLike>): CombatantLike {
  const base = {
    id: "base",
    side: "enemy" as const,
    name: "Base",
    level: 1,
    hp: 50,
    maxHp: 50,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { ...ZERO_STATS },
    resistances: { flat: { ...ZERO_RES }, percent: { ...ZERO_RES } },
    initiative: 50,
  };
  return { ...base, ...overrides };
}

/** Héros actif (initiative 100) face à un monstre : seul le héros peut frapper. */
function duel(target = duelist({ id: "monster" })): BattleState {
  const hero = duelist({ id: "hero", side: "player", name: "Héros", initiative: 100, position: { x: 0, y: 1 } });
  const combatants = [hero, target];
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [] };
}

function bareAttack(overrides: Partial<AttackSpec> = {}): AttackSpec {
  return { base: 8, element: "earth", apCost: 3, ...overrides };
}

function hit(state: BattleState, attack = bareAttack()): BattleState {
  return resolveAttack({ state, attackerId: "hero", targetId: "monster", attack, rng: alwaysZero });
}

function hpOf(state: BattleState, id: string): number {
  return mustFind(state.combatants, id).hp;
}

function floatsOf(state: BattleState): readonly FloatingEvent[] {
  return state.floats ?? [];
}

/** Même montage que `combatLoop.spec` : la carte donne la portée et la ligne de vue. */
const iopHero = () => createHero("Balthazar", mustFind(classes, "iop"));

const piou = () => mustFind(monsters, DEMO_MONSTER_ID);

const demoMap = () => parseAsciiMap(mustFind(maps, DEMO_MAP_ID).grid);

function oneVersusOne(rows: readonly string[] = []): CombatState {
  const map = rows.length === 0 ? demoMap() : parseAsciiMap([...rows]);
  return initCombat({ map, hero: iopHero(), monster: piou(), spells });
}

describe("moteur — un coup expose un nombre flottant pour la cible", () => {
  it("expose la cible, le type et le montant réellement retiré aux PV", () => {
    const state = duel();
    const next = hit(state);
    const applied = hpOf(state, "monster") - hpOf(next, "monster");
    expect(applied).toBe(8);
    expect(floatsOf(next)).toHaveLength(1);
    expect(floatsOf(next)[0]).toMatchObject({ targetId: "monster", amount: applied, kind: "damage" });
  });

  it("ne prend jamais l'attaquant pour la cible", () => {
    const next = hit(duel());
    expect(floatsOf(next).map((event) => event.targetId)).toEqual(["monster"]);
    expect(hpOf(next, "hero")).toBe(50);
  });

  it("borne le montant à la vie restante quand le coup est mortel", () => {
    const state = duel(duelist({ id: "monster", hp: 3, maxHp: 50 }));
    const next = hit(state);
    expect(hpOf(next, "monster")).toBe(0);
    expect(floatsOf(next)[0]?.amount).toBe(3);
  });

  it("expose un événement par coup quand la même cible est frappée deux fois", () => {
    const first = hit(duel());
    const second = hit(first);
    const ids = floatsOf(second).map((event) => event.id);
    expect(floatsOf(second)).toHaveLength(2);
    expect(ids[0]).toBeLessThan(ids[1] ?? 0);
  });

  it("expose le montant du 1v1 (sort lancé) et pas une phrase de journal", () => {
    const state = oneVersusOne(["P.M.", "...."]);
    const cast = castSpell({ state, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero });
    const event = cast.floats?.[0];
    expect(event).toMatchObject({ targetId: state.enemy.id, kind: "damage" });
    expect(event?.amount).toBe(state.enemy.hp - cast.enemy.hp);
  });
});

describe("moteur — soin et tampon borné", () => {
  it("un soin porte kind « heal » et un montant positif", () => {
    const empty: readonly FloatingEvent[] = [];
    const { floats } = appendFloat({ floats: empty }, { targetId: "hero", amount: 5, kind: "heal" });
    expect(floats?.[0]).toMatchObject({ targetId: "hero", amount: 5, kind: "heal" });
    expect(floats?.[0]?.amount).toBeGreaterThan(0);
  });

  it("garde au plus les N derniers événements, jamais tout l'historique", () => {
    let state: { floats?: readonly FloatingEvent[] } = { floats: [] };
    for (let index = 0; index < FLOAT_BUFFER_SIZE + 4; index += 1) {
      state = appendFloat(state, { targetId: "monster", amount: 1, kind: "damage" });
    }
    expect(state.floats).toHaveLength(FLOAT_BUFFER_SIZE);
    expect(state.floats?.[0]?.id).toBe(5);
    expect(state.floats?.at(-1)?.id).toBe(FLOAT_BUFFER_SIZE + 4);
  });

  it("n'écrit rien pour un coup nul : aucun « -0 » à l'écran", () => {
    const state = { floats: [] as readonly FloatingEvent[] };
    expect(appendFloat(state, { targetId: "monster", amount: 0, kind: "damage" })).toBe(state);
  });
});
