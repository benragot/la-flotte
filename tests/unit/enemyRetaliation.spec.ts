import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { computeDamage } from "../../src/engine/combat/damage";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { monsterCombatant, setupDungeonBattle } from "../../src/engine/dungeon/combatants";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildTimeline, enemiesAct, isDefeat } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike, EnemyAction, EnemyStrategy, Rng } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { DEFEAT_LOG, MAX_ENEMY_STEPS, STALL_LOG, playEnemyTurns, spellStrategy } from "../../src/store/battleSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import { BattleSections } from "../../src/ui/components/battle";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const PANEL_PATH = "src/ui/components/battle/BattlePanel.tsx";
const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const NO_STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const CRABE = mustFind(monsters, "fer_crabe_cle_molette");
const PINCE = mustFind(spells, "fer_spell_pince_de_douze");

function spellsFor(monster: MonsterDef): SpellDef[] {
  return monster.spellIds.map((id) => mustFind(spells, id));
}

function roomOne(): DungeonRoom {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

function roomGroups() {
  return roomMonsters(roomOne()).map((group) => ({ monster: mustFind(monsters, group.monsterId), count: group.count }));
}

function heroCombatant(overrides: Partial<CombatantLike> = {}): CombatantLike {
  const base: CombatantLike = {
    id: "player",
    side: "player",
    name: "Balthazar",
    level: 1,
    hp: 50,
    maxHp: 50,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { ...NO_STATS },
    resistances: { flat: { ...ZERO }, percent: { ...ZERO } },
    initiative: 0,
  };
  return { ...base, ...overrides };
}

function asState(combatants: CombatantLike[], log: string[] = []): BattleState {
  return { turn: 1, ...buildTimeline(combatants), combatants, log };
}

function crabBattle(): { state: BattleState; enemy: CombatantLike } {
  const enemy = monsterCombatant({ monster: CRABE, index: 0 });
  return { state: asState([heroCombatant(), enemy]), enemy };
}

function attackOf(action: EnemyAction | null): { targetId: string; attack: { base: number; apCost: number } } {
  if (action === null || action.kind !== "attack") throw new Error("action d'attaque attendue");
  return action;
}

function fixedRng(value: number): Rng {
  return () => value;
}

const battle = (): BattleState | null => useCombatStore.getState().battle;

function battleOrThrow(): BattleState {
  const state = battle();
  if (state === null) throw new Error("battle absent");
  return state;
}

function heroOf(state: BattleState): CombatantLike {
  const found = state.combatants.find((entry) => entry.side === "player");
  if (found === undefined) throw new Error("héros absent");
  return found;
}

function heroOrThrow() {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros persistant absent");
  return hero;
}

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("spellStrategy — sorts réels du monstre", () => {
  it("frappe le héros avec le sort dispo et tire sa base dans la plage YAML", () => {
    const { state, enemy } = crabBattle();
    const action = spellStrategy({ spells: spellsFor(CRABE), rng: fixedRng(0) })(state, enemy.id);
    const attack = attackOf(action);
    expect(attack.targetId).toBe("player");
    expect(attack.attack.base).toBe(PINCE.damage?.min);
    expect(attack.attack.base).toBeGreaterThanOrEqual(PINCE.damage?.min ?? 0);
    expect(attack.attack.base).toBeLessThanOrEqual(PINCE.damage?.max ?? 0);
    expect(attack.attack.apCost).toBe(PINCE.apCost);
  });

  it("borne le tirage au maximum de la plage du sort", () => {
    const { state, enemy } = crabBattle();
    const action = spellStrategy({ spells: spellsFor(CRABE), rng: fixedRng(0.999_999) })(state, enemy.id);
    expect(attackOf(action).attack.base).toBe(PINCE.damage?.max);
  });

  it("rend null quand le monstre n'a aucun sort de dégâts", () => {
    const { state, enemy } = crabBattle();
    const bond = mustFind(spells, "bond");
    expect(spellStrategy({ spells: [bond], rng: fixedRng(0) })(state, enemy.id)).toBeNull();
  });

  it("rend null quand les PA restants ne paient pas le sort", () => {
    const enemy = { ...monsterCombatant({ monster: CRABE, index: 0 }), ap: 1 };
    const state = asState([heroCombatant(), enemy]);
    expect(spellStrategy({ spells: spellsFor(CRABE), rng: fixedRng(0) })(state, enemy.id)).toBeNull();
  });

  it("est déterministe pour un rng fixé", () => {
    const { state, enemy } = crabBattle();
    const first = spellStrategy({ spells: spellsFor(CRABE), rng: fixedRng(0.5) })(state, enemy.id);
    const second = spellStrategy({ spells: spellsFor(CRABE), rng: fixedRng(0.5) })(state, enemy.id);
    expect(first).toEqual(second);
  });
});

describe("contact diagonal (D104) — le monstre collé frappe", () => {
  const CONTACT_MAP = parseAsciiMap(Array.from({ length: 9 }, () => "........."));

  /** Crabe en (2,2), héros en (3,3) : distance de Manhattan 2, portée de la pince 1. */
  function diagonalCrab(): { state: BattleState; enemy: CombatantLike } {
    const enemy = monsterCombatant({ monster: CRABE, index: 0, position: { x: 2, y: 2 } });
    return { state: { ...asState([heroCombatant({ position: { x: 3, y: 3 } }), enemy]), map: CONTACT_MAP }, enemy };
  }

  it("se décale d'un pas orthogonal, puis frappe dans le même tour", () => {
    const { state, enemy } = diagonalCrab();
    const strategy = spellStrategy({ spells: spellsFor(CRABE), rng: fixedRng(0) });
    const next = enemiesAct({ state, rng: fixedRng(0), strategy });
    expect(heroOf(next).hp).toBeLessThan(50);
    const crab = next.combatants.find((entry) => entry.id === enemy.id);
    expect(crab?.position).toEqual({ x: 3, y: 2 });
  });

  it("ne frappe pas depuis la diagonale sans se déplacer : il paie son pas", () => {
    const { state, enemy } = diagonalCrab();
    const strategy = spellStrategy({ spells: spellsFor(CRABE), rng: fixedRng(0) });
    const next = enemiesAct({ state, rng: fixedRng(0), strategy });
    const crab = next.combatants.find((entry) => entry.id === enemy.id);
    expect(crab?.mp).toBe((enemy.mp ?? 0) - 1);
  });
});

describe("monsterCombatant — les sorts voyagent", () => {
  it("transporte les spellIds du MonsterDef, jamais une liste vide inventée", () => {
    const combatant = monsterCombatant({ monster: CRABE, index: 0 });
    expect(combatant.spellIds).toEqual(CRABE.spellIds);
    expect(combatant.spellIds).toContain("fer_spell_pince_de_douze");
  });

  it("donne leurs spellIds aux trois ennemis de la vraie salle 1", () => {
    const { combatants } = setupDungeonBattle({ hero: { combatant: heroCombatant() }, monsters: roomGroups() });
    const enemies = combatants.filter((entry) => entry.side === "enemy");
    expect(enemies.length).toBe(3);
    for (const enemy of enemies) {
      const monsterId = enemy.id.slice(0, enemy.id.lastIndexOf("-"));
      expect(enemy.spellIds ?? []).toEqual(mustFind(monsters, monsterId).spellIds);
    }
  });
});

function resetBattleStore(): void {
  useGameStore.getState().resetGame();
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null });
  useCombatStore.getState().startDungeonRoom({ room: roomOne() });
}

/** Le héros démarre sur une case `P` : les monstres doivent d'abord approcher. */
function playRoundsUntil(predicate: (state: BattleState) => boolean, maxRounds = 20, rng: Rng = fixedRng(0)): BattleState {
  for (let round = 0; round < maxRounds; round += 1) {
    if (predicate(battleOrThrow())) break;
    useCombatStore.getState().playEnemyTurns({ rng });
  }
  return battleOrThrow();
}

describe("useCombatStore.playEnemyTurns — riposte bout en bout", () => {
  beforeEach(resetBattleStore);

  it("baisse les PV du héros, journalise les coups et rend la main au héros", () => {
    const before = heroOf(battleOrThrow()).hp;
    const state = playRoundsUntil((current) => heroOf(current).hp < before || isDefeat(current));
    const after = heroOf(state).hp;
    expect(after).toBeLessThan(before);
    expect(state.log.filter((line) => line.includes("frappe")).length).toBeGreaterThan(0);
    expect(state.log.some((line) => line.includes("avec"))).toBe(true);
    expect(state.order[state.activeIndex]).toBe("player");
  });

  it("garde chaque coup dans les bornes de dégâts des sorts de la salle", () => {
    const before = heroOf(battleOrThrow()).hp;
    const state = playRoundsUntil((current) => heroOf(current).hp < before || isDefeat(current));
    const damages = state.log.flatMap((line) => {
      const match = /(\d+) dégâts/.exec(line);
      return match === null ? [] : [Number(match[1])];
    });
    expect(damages.length).toBeGreaterThan(0);
    expect(damages.reduce((total, value) => total + value, 0)).toBe(before - heroOf(state).hp);
    const bounds = damageBounds();
    for (const value of damages) {
      expect(value).toBeGreaterThanOrEqual(bounds.min);
      expect(value).toBeLessThanOrEqual(bounds.max);
    }
  });
});

describe("useCombatStore.playEnemyTurns — mort du héros", () => {
  beforeEach(resetBattleStore);

  it("ne persiste jamais un héros à 0 PV quand il tombe", () => {
    const current = battleOrThrow();
    const wounded = { ...current, combatants: current.combatants.map((entry) => (entry.side === "player" ? { ...entry, hp: 5 } : entry)) };
    useCombatStore.setState({ battle: wounded });
    const state = playRoundsUntil((next) => isDefeat(next), 20, fixedRng(0.999_999));
    expect(isDefeat(state)).toBe(true);
    expect(state.log).toContain(DEFEAT_LOG);
    expect(heroOrThrow().hp).toBeGreaterThan(0);
    const storage = new MemoryStorage();
    useGameStore.getState().saveGame(storage);
    const key = useGameStore.getState().saveKey;
    expect(storage.getItem(key)).not.toBeNull();
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBeGreaterThan(0);
  });
});

function damageBounds(): { min: number; max: number } {
  const values = roomGroups().flatMap((group) =>
    spellsFor(group.monster).flatMap((spell) => spellValues(group.monster, spell)),
  );
  return { min: Math.min(...values), max: Math.max(...values) };
}

function spellValues(monster: MonsterDef, spell: SpellDef): number[] {
  if (spell.damage === undefined) return [];
  const stat = statFor(monster, spell);
  const base = { stat, flatRes: 0, pctRes: 0, isPlayer: true };
  return [computeDamage({ ...base, base: spell.damage.min }), computeDamage({ ...base, base: spell.damage.max })];
}

function statFor(monster: MonsterDef, spell: SpellDef): number {
  if (spell.element === "air") return monster.stats.agility;
  if (spell.element === "fire") return monster.stats.intelligence;
  if (spell.element === "water") return monster.stats.chance;
  return monster.stats.strength;
}

describe("playEnemyTurns — borne dure", () => {
  it("s'arrête et journalise quand la mêlée ne rend jamais la main", () => {
    const enemy = monsterCombatant({ monster: CRABE, index: 0 });
    const stuck: BattleState = { turn: 1, order: [enemy.id], activeIndex: 0, combatants: [heroCombatant(), enemy], log: [] };
    let calls = 0;
    const attack = { base: 1, element: "neutral" as const, baseCrit: 0, apCost: 1 };
    const strategyFor = (): EnemyStrategy => () => {
      calls += 1;
      return { kind: "attack", targetId: "fantome", attack };
    };
    const next = playEnemyTurns({ state: stuck, strategyFor, rng: fixedRng(0) });
    expect(calls).toBeLessThanOrEqual(MAX_ENEMY_STEPS);
    expect(next.log).toContain(STALL_LOG);
  });
});

describe("panneau — journal lisible et défaite cohérente", () => {
  it("affiche au moins les cinq dernières entrées du journal", () => {
    const { state, enemy } = crabBattle();
    const log = ["ligne-1", "ligne-2", "ligne-3", "ligne-4", "ligne-5", "ligne-6"];
    const html = renderToStaticMarkup(createElement(BattleSections, { battle: { ...state, log } }));
    expect(html).toContain("ligne-6");
    expect(html).toContain("ligne-2");
    expect(html).not.toContain("ligne-1");
    expect(html).toContain(enemy.name);
  });

  it("cache Attaquer et montre la défaite quand le héros est tombé", () => {
    const { state } = crabBattle();
    const heroTurn = { ...state, activeIndex: state.order.indexOf("player") };
    const fallen = { ...heroTurn, combatants: heroTurn.combatants.map((entry) => (entry.side === "player" ? { ...entry, hp: 0 } : entry)) };
    const html = renderToStaticMarkup(createElement(BattleSections, { battle: { ...fallen, log: [DEFEAT_LOG] } }));
    expect(html).toContain(DEFEAT_LOG);
    expect(count(html, ">Attaquer<")).toBe(0);
  });

  it("cadence Terminer le tour par le hook de beat, plus par playEnemyTurns d'un bloc", () => {
    const source = readFileSync(join(process.cwd(), PANEL_PATH), "utf8");
    expect(source).toContain("useCombatBeat");
    expect(source).not.toMatch(/state\.playEnemyTurns/);
  });
});
