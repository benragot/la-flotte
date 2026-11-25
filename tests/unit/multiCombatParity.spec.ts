import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeTackleEscapePercent, computeCritDenominator } from "../../src/engine/combat";
import type { CombatResistances } from "../../src/engine/combatLoop";
import { enterDungeon } from "../../src/engine/dungeon";
import { healBetweenRooms } from "../../src/engine/dungeon/heal";
import { attemptRoom } from "../../src/engine/dungeon/run";
import { parseAsciiMap } from "../../src/engine/grid";
import { addItem } from "../../src/engine/inventory";
import {
  adjacentEnemies,
  advanceTurn,
  buildTimeline,
  moveHero,
  resolveAttack,
  tackleCheck,
} from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike, Rng } from "../../src/engine/multiCombat";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { emptyInventory } from "../../src/store/gameSelectors";

/**
 * GOLDEN 1vN — DEC-12, étape 1 : figer le comportement **actuel** de
 * `src/engine/multiCombat/` (donjon) avant d'en faire l'unique moteur.
 *
 * Ce fichier capture ce que le 1v1 n'a pas : timeline, tacle, critique, et des
 * récompenses de salle limitées au soin DEC-03 et à l'avancement du run.
 * Aucune assertion de `src/` n'est modifiée : ces tests passent sur le code tel
 * qu'il est et rougissent si une de ces règles bouge.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const NO_STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const OPEN_MAP = parseAsciiMap([".......", ".......", "......."]);

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

const DUNGEON = mustFind(dungeons, "fer_donjon_casse_vis_sans_fin");

function zeroResistances(): CombatResistances {
  const zero = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
  return { flat: { ...zero }, percent: { ...zero } };
}

/** Combattant neutre : HP 200, 6 PA, 3 PM, aucune stat. */
function combatant(overrides: Partial<CombatantLike> = {}): CombatantLike {
  const base = {
    id: "e1",
    side: "enemy" as const,
    name: "Piou",
    level: 1,
    hp: 200,
    maxHp: 200,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { ...NO_STATS },
    resistances: zeroResistances(),
    initiative: 50,
  };
  return { ...base, ...overrides };
}

function stateOf(combatants: CombatantLike[], map = OPEN_MAP): BattleState {
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [], map };
}

function attackSpec(overrides: Partial<AttackSpec> = {}): AttackSpec {
  return { base: 10, element: "earth", apCost: 3, ...overrides };
}

function countingRng(value: number): { rng: Rng; calls: () => number } {
  let calls = 0;
  const rng = () => {
    calls += 1;
    return value;
  };
  return { rng, calls: () => calls };
}

/** Héros actif à 0 de stat, cible en face : les dégâts se lisent sans recalcul. */
function duel(overrides: { player?: Partial<CombatantLike>; enemy?: Partial<CombatantLike> } = {}) {
  const player = combatant({ id: "p1", side: "player", name: "Balthazar", initiative: 300, ...overrides.player });
  const enemy = combatant({ id: "e1", initiative: 100, ...overrides.enemy });
  return { player, enemy };
}

/** Héros (1,1) et monstre (2,1) au contact : tacle certain (0 % d'échappée). */
function tackledDuel() {
  return duel({
    player: { position: { x: 1, y: 1 }, stats: { ...NO_STATS, agility: 0 } },
    enemy: { position: { x: 2, y: 1 }, stats: { ...NO_STATS, agility: 200 } },
  });
}

function roomMonsterIds(roomNumber: number): string[] {
  const room = DUNGEON.rooms.find((entry) => entry.roomNumber === roomNumber);
  if (room === undefined) throw new Error(`salle ${roomNumber} absente`);
  return room.monsters.flatMap((group) => Array.from({ length: group.count }, () => group.monsterId));
}

function startedDungeonRun() {
  const inventory = addItem({ inventory: emptyInventory(), itemId: DUNGEON.keyItemId, quantity: 1 });
  const { run } = enterDungeon({ dungeon: DUNGEON, inventory });
  if (run === null) throw new Error("clé du donjon refusée");
  return run;
}

describe("PARITÉ 1vN — timeline d'initiative", () => {
  it("trie par initiative décroissante, départage à égalité par id croissant", () => {
    // PARITÉ: ordre décroissant et départage par id croissant : cette timeline devient la référence du 1v1.
    const fast = combatant({ id: "zz_fast", initiative: 300 });
    const tieA = combatant({ id: "aaa_tie", initiative: 120 });
    const tieB = combatant({ id: "bbb_tie", initiative: 120 });
    expect(buildTimeline([fast, tieB, tieA])).toEqual({
      order: ["zz_fast", "aaa_tie", "bbb_tie"],
      activeIndex: 0,
    });
  });

  it("saute les morts, restaure PA/PM du nouvel actif, tour +1 au bouclage", () => {
    // PARITÉ: saut des morts, restauration PA/PM et tour +1 au bouclage.
    const first = combatant({ id: "p1", side: "player", initiative: 300, ap: 1, mp: 0 });
    const dead = combatant({ id: "e_dead", initiative: 200, hp: 0 });
    const last = combatant({ id: "e2", initiative: 100, ap: 0, mp: 0 });
    const state = stateOf([first, dead, last]);
    const next = advanceTurn(state);
    expect(next.activeIndex).toBe(2);
    expect(next.turn).toBe(1);
    expect([next.combatants[2]?.ap, next.combatants[2]?.mp]).toEqual([6, 3]);
    const wrapped = advanceTurn(next);
    expect(wrapped.activeIndex).toBe(0);
    expect(wrapped.turn).toBe(2);
  });
});

describe("PARITÉ 1vN — tacle : asymétrie et contact", () => {
  it("fuyard 0 / tacleur 200 : 0 % d'échappée, tacle certain, 1 PM", () => {
    // PARITÉ: asymétrie Agilité et tacle certain à 0 % d'échappée.
    const { player, enemy } = tackledDuel();
    const state = stateOf([player, enemy]);
    expect(computeTackleEscapePercent({ fleeAgility: 0, tackleAgility: 200 })).toBe(0);
    expect(tackleCheck({ state, moverId: "p1", rng: () => 0.99 })).toEqual({ escaped: false, mpLoss: 1 });
  });

  it("fuyard 100 / tacleur 0 : 100 % d'échappée, aucun PM de tacle", () => {
    // PARITÉ: 100 % d'échappée ne prélève aucun PM.
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 }, stats: { ...NO_STATS, agility: 100 } },
      enemy: { position: { x: 2, y: 1 }, stats: { ...NO_STATS, agility: 0 } },
    });
    const state = stateOf([player, enemy]);
    expect(computeTackleEscapePercent({ fleeAgility: 100, tackleAgility: 0 })).toBe(100);
    expect(tackleCheck({ state, moverId: "p1", rng: () => 0.99 })).toEqual({ escaped: true, mpLoss: 0 });
  });

  it("seules les quatre orthogonales taclent : la diagonale ne compte pas", () => {
    // PARITÉ: seules les quatre orthogonales taclent, jamais la diagonale.
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 } },
      enemy: { position: { x: 2, y: 2 } },
    });
    expect(adjacentEnemies(stateOf([player, enemy]), player)).toEqual([]);
  });
});

describe("PARITÉ 1vN — tacle : effet sur la marche", () => {
  it("un tacle raté arrête la marche : 1 PM perdu, pas un pas payé", () => {
    // PARITÉ: tacle jugé avant paiement, arrêt sur place, 1 PM et aucun PA.
    const { player, enemy } = tackledDuel();
    const next = moveHero({ state: stateOf([player, enemy]), to: { x: 0, y: 1 }, rng: () => 0 });
    const moved = next.combatants.find((entry) => entry.id === "p1");
    expect(moved?.position).toEqual({ x: 1, y: 1 });
    expect(moved?.mp).toBe(2);
    expect(moved?.ap).toBe(6);
  });

  it("un tacle réussi laisse le pas passer au prix du chemin", () => {
    // PARITÉ: échappée = pas payé au prix du chemin, rien de plus.
    const { player, enemy } = duel({
      player: { position: { x: 1, y: 1 }, stats: { ...NO_STATS, agility: 100 } },
      enemy: { position: { x: 2, y: 1 }, stats: { ...NO_STATS, agility: 0 } },
    });
    const next = moveHero({ state: stateOf([player, enemy]), to: { x: 0, y: 1 }, rng: () => 0.99 });
    const moved = next.combatants.find((entry) => entry.id === "p1");
    expect(moved?.position).toEqual({ x: 0, y: 1 });
    expect(moved?.mp).toBe(2);
  });
});

describe("PARITÉ 1vN — le coup critique existe", () => {
  it("20 de base + 100 d'Agilité ⇒ X = 12 ; 158 vaut 1/100, jamais garanti", () => {
    // PARITÉ: SPELL-03, la sortie est un dénominateur 1/X ; 158 = 1/100 pas garanti.
    expect(computeCritDenominator({ baseCrit: 20, bonusCrit: 0, agility: 100 })).toBe(12);
    expect(computeCritDenominator({ baseCrit: 157, bonusCrit: 0, agility: 100 })).toBe(99);
    expect(computeCritDenominator({ baseCrit: 158, bonusCrit: 0, agility: 100 })).toBe(100);
  });

  it("un CC applique le jet max (12) sans multiplicateur : 200 → 188 PV", () => {
    // PARITÉ: SPELL-03, le CC substitue le jet (8-12 ⇒ 12), il n'additionne rien.
    const { player, enemy } = duel();
    const counter = countingRng(0);
    const attack = attackSpec({ base: 8, damage: { min: 8, max: 12 }, critRate: 2 });
    const next = resolveAttack({ state: stateOf([player, enemy]), attackerId: "p1", targetId: "e1", attack, rng: counter.rng });
    expect(counter.calls()).toBe(1);
    expect(next.combatants[1]?.hp).toBe(188);
    expect(next.combatants[0]?.ap).toBe(3);
  });

  it("tirage exact 1/2 : 0,49 critique (188 PV), 0,50 non (190 PV)", () => {
    // PARITÉ: SPELL-03, `rng × X < 1` : 0,50 × 2 = 1 n'est pas strictement inférieur.
    const attack = attackSpec({ critRate: 2, critMax: { min: 12, max: 12 } });
    const critState = duel();
    const normalState = duel();
    const crit = resolveAttack({ state: stateOf([critState.player, critState.enemy]), attackerId: "p1", targetId: "e1", attack, rng: () => 0.49 });
    const normal = resolveAttack({ state: stateOf([normalState.player, normalState.enemy]), attackerId: "p1", targetId: "e1", attack, rng: () => 0.5 });
    expect(crit.combatants[1]?.hp).toBe(188);
    expect(normal.combatants[1]?.hp).toBe(190);
  });
});

describe("PARITÉ 1vN — attaque nue (sans `spellId`)", () => {
  it("frappe sans quota ni recharge : 200 → 190 PV, aucun `spellUsage`", () => {
    // PARITÉ: l'attaque sans `spellId` reste possible et hors quota après unification.
    const { player, enemy } = duel();
    const state = stateOf([player, enemy]);
    const next = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec(), rng: () => 0.99 });
    expect(next.combatants[1]?.hp).toBe(190);
    expect(next.spellUsage).toBeUndefined();
  });
});

describe("PARITÉ 1vN — récompense de salle : le soin DEC-03", () => {
  it("le soin vaut ceil(max × ratio), borné au maximum", () => {
    // PARITÉ: `ceil(max × ratio)` borné au maximum, ratio lu dans `dungeons.yaml`.
    const ratio = DUNGEON.healBetweenRooms;
    expect(healBetweenRooms({ hp: 10, maxHp: 100, ratio })).toEqual({ hp: 85, healed: 75 });
    expect(healBetweenRooms({ hp: 90, maxHp: 100, ratio })).toEqual({ hp: 100, healed: 10 });
  });
});

describe("PARITÉ 1vN — récompense de salle : avancement du run", () => {
  it("une salle nettoyée avance le run : aucune XP, aucun kamas, aucun butin", () => {
    // PARITÉ: une salle crédite l'avancement ; XP/butin d'exploration restent à migrer explicitement.
    const run = startedDungeonRun();
    const cleared = attemptRoom({ run, dungeon: DUNGEON, defeatedMonsterIds: roomMonsterIds(1) });
    expect(cleared.cleared).toBe(true);
    expect(cleared.run.roomIndex).toBe(1);
    expect(cleared.run.clearedRoomNumbers).toEqual([1]);
    expect(Object.keys(cleared.run).sort()).toEqual([
      "clearedRoomNumbers",
      "dungeonId",
      "keysConsumed",
      "log",
      "roomIndex",
    ]);
  });

  it("une salle incomplète ne crédite rien : run rendu par identité", () => {
    // PARITÉ: aucun crédit partiel, run rendu par identité.
    const run = startedDungeonRun();
    const cleared = attemptRoom({ run, dungeon: DUNGEON, defeatedMonsterIds: [] });
    expect(cleared.cleared).toBe(false);
    expect(cleared.run).toBe(run);
  });
});
