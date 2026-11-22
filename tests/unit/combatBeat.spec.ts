import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_BEAT_MS, canAct, nextBeatAt } from "../../src/engine/combat/beat";
import { monsterCombatant } from "../../src/engine/dungeon/combatants";
import type {
  AttackSpec,
  BattleState,
  CombatantLike,
  EnemyAction,
  EnemyStrategy,
  Rng,
} from "../../src/engine/multiCombat";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import {
  MAX_ENEMY_STEPS,
  enemyStepOnce,
  needsEnemyStep,
} from "../../src/store/battleSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { nextBeatDelay } from "../../src/ui/components/battle/useCombatBeat";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const monsters = parseMonstersYaml(read("monsters.yaml"));
const HOOK_PATH = "src/ui/components/battle/useCombatBeat.ts";
const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
const NO_STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const ONE_HIT: AttackSpec = { base: 10, element: "neutral", baseCrit: 0, apCost: 1 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const CRABE: MonsterDef = mustFind(monsters, "fer_crabe_cle_molette");

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

function crabBattle(): { state: BattleState; enemy: CombatantLike } {
  const enemy = monsterCombatant({ monster: CRABE, index: 0 });
  const order = [enemy.id, "player"];
  return { state: { turn: 1, order, activeIndex: 0, combatants: [heroCombatant(), enemy], log: [] }, enemy };
}

function fixedRng(value: number): Rng {
  return () => value;
}

/** Une seule action par tour : la preuve « un appel = un pas » reste exacte. */
function onceStrategy(): (enemy: CombatantLike) => EnemyStrategy {
  let spent = false;
  return () => (): EnemyAction | null => {
    if (spent) return null;
    spent = true;
    return { kind: "attack", targetId: "player", attack: ONE_HIT };
  };
}

function heroHp(state: BattleState): number {
  const hero = state.combatants.find((entry) => entry.side === "player");
  return hero === undefined ? -1 : hero.hp;
}

describe("beat — la primitive de temps, sans horloge", () => {
  it("vaut 750 ms et se projette en une borne exacte", () => {
    expect(MIN_BEAT_MS).toBe(750);
    expect(nextBeatAt(1000)).toBe(1750);
  });

  it("autorise l'action à 750 ms, jamais à 749 ms", () => {
    expect(canAct(1000, 1749)).toBe(false);
    expect(canAct(1000, 1750)).toBe(true);
    expect(canAct(1000, 2000)).toBe(true);
  });

  it("ne mute rien : deux appels rendent le même verdict", () => {
    expect(canAct(1000, 1749)).toBe(false);
    expect(canAct(1000, 1749)).toBe(false);
    expect(nextBeatAt(1000)).toBe(nextBeatAt(1000));
    expect(canAct(1000, 1749)).toBe(false);
  });
});

describe("beat — 750 n'est écrit qu'une fois dans src/", () => {
  it("porte le littéral seulement dans beat.ts", () => {
    expect(sourcesWithBeat()).toEqual(["src/engine/combat/beat.ts"]);
  });
});

describe("enemyStepOnce — un appel, un pas", () => {
  it("ne fait jouer qu'un seul tour ennemi, avec des valeurs exactes", () => {
    const { state: before } = crabBattle();
    const after = enemyStepOnce({ state: before, strategyFor: onceStrategy(), rng: fixedRng(0) }, before);
    expect(after.log.length - before.log.length).toBe(1);
    expect(heroHp(before) - heroHp(after)).toBe(13);
    expect(after.activeIndex).toBe(before.activeIndex + 1);
    expect(after.order[after.activeIndex]).toBe("player");
  });

  it("laisse le pas suivant au héros : aucun second coup dans le même appel", () => {
    const { state } = crabBattle();
    const input = { state, strategyFor: onceStrategy(), rng: fixedRng(0) };
    const first = enemyStepOnce(input, state);
    const second = enemyStepOnce({ ...input, state: first }, first);
    expect(heroHp(first)).toBe(37);
    expect(heroHp(second)).toBe(37);
    expect(second.log).toEqual(first.log);
  });
});

describe("needsEnemyStep — la main est-elle revenue ?", () => {
  it("rend faux sans bataille et quand le héros a la main", () => {
    expect(needsEnemyStep(null, false)).toBe(false);
    const { state } = crabBattle();
    const heroIndex = state.order.indexOf("player");
    expect(needsEnemyStep({ ...state, activeIndex: heroIndex }, true)).toBe(false);
  });

  it("rend vrai tant que la main n'est pas au héros, et pour le premier pas", () => {
    const { state } = crabBattle();
    expect(needsEnemyStep({ ...state, activeIndex: 0 }, true)).toBe(true);
    expect(needsEnemyStep({ ...state, activeIndex: 1 }, false)).toBe(true);
  });
});

describe("nextBeatDelay — la cadence vue par le pilote", () => {
  it("attend 750 ms puis zéro, jamais un délai négatif", () => {
    expect(nextBeatDelay({ lastActionAt: 1000, now: 1000, needed: true })).toBe(750);
    expect(nextBeatDelay({ lastActionAt: 1000, now: 1749, needed: true })).toBe(1);
    expect(nextBeatDelay({ lastActionAt: 1000, now: 1750, needed: true })).toBe(0);
    expect(nextBeatDelay({ lastActionAt: 1000, now: 2000, needed: true })).toBe(0);
  });

  it("ne planifie rien quand aucun pas n'est dû", () => {
    expect(nextBeatDelay({ lastActionAt: 1000, now: 1000, needed: false })).toBeNull();
  });
});

describe("useCombatStore — le gardien de cadence", () => {
  it("refuse à 749 ms, autorise à 750 ms, sans muter l'horodatage", () => {
    useCombatStore.getState().resetCombat();
    useCombatStore.getState().stampActionAt(1000);
    expect(useCombatStore.getState().canActNow(1749)).toBe(false);
    expect(useCombatStore.getState().canActNow(1749)).toBe(false);
    expect(useCombatStore.getState().lastActionAt).toBe(1000);
    expect(useCombatStore.getState().canActNow(1750)).toBe(true);
    expect(useCombatStore.getState().lastActionAt).toBe(1000);
  });

  it("autorise la première action : l'horodatage d'ouverture ne verrouille rien", () => {
    useCombatStore.getState().resetCombat();
    expect(useCombatStore.getState().lastActionAt).toBe(0);
    expect(useCombatStore.getState().canActNow(750)).toBe(true);
  });
});

describe("useCombatStore.playEnemyStepOnce — un seul pas de timeline", () => {
  it("passe l'actif à l'ennemi suivant exactement une fois", () => {
    const { state } = crabBattle();
    useCombatStore.setState({ battle: state });
    useCombatStore.getState().playEnemyStepOnce({ rng: fixedRng(0) });
    const after = useCombatStore.getState().battle;
    if (after === null) throw new Error("battle absent");
    expect(after.activeIndex).toBe(1);
    expect(after.order[after.activeIndex]).toBe("player");
    expect(after.log.length).toBeGreaterThan(0);
  });

  it("garde la borne dure de la boucle existante", () => {
    expect(MAX_ENEMY_STEPS).toBe(32);
  });
});

describe("useCombatBeat — le minuteur vit dans le hook et se nettoie", () => {
  it("planifie avec setTimeout et nettoie avec clearTimeout au démontage", () => {
    const source = readFileSync(join(process.cwd(), HOOK_PATH), "utf8");
    expect(source).toContain("setTimeout");
    expect(source).toContain("clearTimeout");
    expect(source).toMatch(/alive\.current = false/);
    expect(source).toContain("playEnemyStepOnce");
  });
});

function sourcesWithBeat(): string[] {
  const root = join(process.cwd(), "src");
  return listSources(root)
    .filter((file) => readFileSync(file, "utf8").includes("750"))
    .map((file) => `src/${file.slice(root.length + 1)}`)
    .sort();
}

function listSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listSources(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}
