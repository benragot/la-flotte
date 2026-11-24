import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_BEAT_MS, canAct, nextBeatAt } from "../../src/engine/combat/beat";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { monsterCombatant } from "../../src/engine/dungeon/combatants";
import type {
  AttackSpec,
  BattleState,
  CombatantLike,
  EnemyAction,
  EnemyStrategy,
  Rng,
} from "../../src/engine/multiCombat";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import {
  MAX_ENEMY_STEPS,
  enemyStepOnce,
  needsEnemyStep,
  openingBeatNeeded,
} from "../../src/store/battleSelectors";
import { useCombatStore } from "../../src/store/useCombatStore";
import { createOpeningClaim, nextBeatDelay, runBeatAction } from "../../src/ui/components/battle/useCombatBeat";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const monsters = parseMonstersYaml(read("monsters.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const HOOK_PATH = "src/ui/components/battle/useCombatBeat.ts";
const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const TARGET_ID = "piou_mazoute-0";
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

/** Héros tombé : la bataille est finie, plus aucun pas n'est dû. */
function fallenHero(state: BattleState): BattleState {
  const combatants = state.combatants.map((entry) => (entry.side === "player" ? { ...entry, hp: 0 } : entry));
  return { ...state, combatants };
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

describe("openingBeatNeeded — la cadence démarre-t-elle sans clic ?", () => {
  it("rend faux sans bataille et sur une bataille finie", () => {
    expect(openingBeatNeeded(null)).toBe(false);
    const { state } = crabBattle();
    expect(openingBeatNeeded(fallenHero(state))).toBe(false);
  });

  it("rend vrai quand le monstre joue en premier : le panneau ne reste pas figé", () => {
    const { state, enemy } = crabBattle();
    expect(state.order[state.activeIndex]).toBe(enemy.id);
    expect(openingBeatNeeded(state)).toBe(true);
  });

  it("rend faux quand le héros a la main : son tour n'est jamais passé tout seul", () => {
    const { state } = crabBattle();
    const heroTurn = { ...state, activeIndex: state.order.indexOf("player") };
    expect(needsEnemyStep(heroTurn, false)).toBe(true);
    expect(openingBeatNeeded(heroTurn)).toBe(false);
  });
});

describe("createOpeningClaim — l'ouverture survit au double montage StrictMode", () => {
  function enemyTurn(): BattleState {
    return crabBattle().state;
  }

  function heroTurn(): BattleState {
    const state = crabBattle().state;
    return { ...state, activeIndex: state.order.indexOf("player") };
  }

  it("réclame, puis réclame encore après release : mount → unmount → mount", () => {
    const claim = createOpeningClaim();
    expect(claim.tryClaim(enemyTurn())).toBe(true);
    claim.release();
    expect(claim.tryClaim(enemyTurn())).toBe(true);
  });

  it("refuse quand le héros a la main : son tour n'est jamais passé tout seul", () => {
    const claim = createOpeningClaim();
    expect(claim.tryClaim(heroTurn())).toBe(false);
    expect(claim.tryClaim(null)).toBe(false);
  });

  it("ne planifie qu'une fois sans release : deux tryClaim, un seul true", () => {
    const claim = createOpeningClaim();
    expect([claim.tryClaim(enemyTurn()), claim.tryClaim(enemyTurn())]).toEqual([true, false]);
  });

  it("se libère quand le héros reprend la main : la main suivante réclame à nouveau", () => {
    const claim = createOpeningClaim();
    expect(claim.tryClaim(enemyTurn())).toBe(true);
    expect(claim.tryClaim(heroTurn())).toBe(false);
    expect(claim.tryClaim(enemyTurn())).toBe(true);
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

  it("réclame l'ouverture dans l'effet et la libère au cleanup : StrictMode rejoue", () => {
    const source = readFileSync(join(process.cwd(), HOOK_PATH), "utf8");
    expect(source).toContain("createOpeningClaim");
    expect(source).toContain("openingBeatNeeded");
    expect(source).toContain("claim.tryClaim(");
    expect(source).toContain("claim.release()");
    expect(source).toContain("scheduleStep(refs, 0)");
  });
});

function roomOne(): DungeonRoom {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

/**
 * Salle 1 réelle, héros à la main, cible de `data/monsters.yaml` au contact :
 * `ap` à 0 rend le sort « trop cher » sans invention de données.
 */
function heroRoom(ap?: number): BattleState {
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null });
  useCombatStore.getState().startDungeonRoom({ room: roomOne() });
  const state = useCombatStore.getState().battle;
  if (state === null) throw new Error("battle absent");
  const hero = state.combatants.find((entry) => entry.side === "player");
  if (hero === undefined) throw new Error("héros absent");
  const adjacent = { x: hero.position.x + 1, y: hero.position.y };
  const combatants = state.combatants.map((entry) => {
    if (entry.side === "player") return ap === undefined ? entry : { ...entry, ap };
    return entry.id === TARGET_ID ? { ...entry, position: adjacent } : entry;
  });
  return { ...state, activeIndex: Math.max(0, state.order.indexOf("player")), combatants };
}

/** Cible reculée de 5 cases : « hors portée » avant toute ligne de vue. */
function farRoom(): BattleState {
  const state = heroRoom();
  const hero = state.combatants.find((entry) => entry.side === "player");
  if (hero === undefined) throw new Error("héros absent");
  const far = { x: hero.position.x + 5, y: hero.position.y };
  const combatants = state.combatants.map((entry) => (entry.id === TARGET_ID ? { ...entry, position: far } : entry));
  return { ...state, combatants };
}

/** Le corps du hook, sans React : même gardien, même ordre d'appel. */
function beatCast(now: number): boolean {
  const store = useCombatStore.getState();
  const input = { now, canAct: store.canActNow, stamp: store.stampActionAt };
  return runBeatAction({ ...input, perform: () => store.battleSpellAttack({ targetId: TARGET_ID, rng: () => 0 }) });
}

interface CastVerdict {
  performed: boolean;
  reason: string | undefined;
}

function castVerdict(lastActionAt: number, battle: BattleState): CastVerdict {
  useCombatStore.setState({ battle, lastActionAt });
  const performed = useCombatStore.getState().battleSpellAttack({ targetId: TARGET_ID, rng: () => 0 });
  return { performed, reason: useCombatStore.getState().battle?.log.at(-1) };
}

function beatHarness(performed: boolean) {
  const stamps: number[] = [];
  const last = (): number => stamps.at(-1) ?? 0;
  const run = (now: number): boolean =>
    runBeatAction({ now, canAct: (at) => canAct(last(), at), perform: () => performed, stamp: (at) => stamps.push(at) });
  return { run, stamps: () => stamps };
}

describe("runBeatAction — le tampon suit l'action, jamais le clic", () => {
  it("ne tamponne pas un refus : l'appel suivant reste immédiatement possible", () => {
    const refused = beatHarness(false);
    expect(refused.run(1000)).toBe(false);
    expect(refused.stamps()).toEqual([]);
    expect(refused.run(1000)).toBe(false);
    expect(refused.stamps()).toEqual([]);
  });

  it("tamponne une action effectuée : 749 ms refusés, 750 ms acceptés", () => {
    const done = beatHarness(true);
    expect(done.run(1000)).toBe(true);
    expect(done.stamps()).toEqual([1000]);
    expect(done.run(1749)).toBe(false);
    expect(done.run(1750)).toBe(true);
    expect(done.stamps()).toEqual([1000, 1750]);
  });

  it("n'exécute même pas l'action qu'une cadence encore fermée refuse", () => {
    const calls = { performed: 0 };
    const stamps: number[] = [];
    const perform = (): boolean => {
      calls.performed += 1;
      return true;
    };
    const refused = runBeatAction({ now: 1000, canAct: () => false, perform, stamp: (at) => stamps.push(at) });
    expect(refused).toBe(false);
    expect(calls.performed).toBe(0);
    expect(stamps).toEqual([]);
  });
});

describe("useCombatStore — un refus ne consomme pas le beat", () => {
  it("sort trop cher : aucun tampon, l'action suivante passe à +0 ms", () => {
    useCombatStore.setState({ battle: heroRoom(0), lastActionAt: 0 });
    expect(beatCast(1000)).toBe(false);
    expect(useCombatStore.getState().lastActionAt).toBe(0);
    expect(useCombatStore.getState().canActNow(1000)).toBe(true);
  });

  it("cast accepté : tampon posé, refusé à 749 ms puis accepté à 750 ms", () => {
    useCombatStore.setState({ battle: heroRoom(), lastActionAt: 0 });
    expect(beatCast(1000)).toBe(true);
    expect(useCombatStore.getState().lastActionAt).toBe(1000);
    expect(useCombatStore.getState().canActNow(1749)).toBe(false);
    expect(useCombatStore.getState().canActNow(1750)).toBe(true);
  });

  it("sort trop cher : refusé pour les PA, quel que soit l'état de la cadence", () => {
    const broken = heroRoom(0);
    const verdicts = [0, 9990].map((at) => castVerdict(at, broken));
    expect(verdicts.map((verdict) => verdict.performed)).toEqual([false, false]);
    expect(useCombatStore.getState().battle).toBe(broken);
    expect(useCombatStore.getState().lastActionAt).toBe(9990);
  });

  it("refus géométrique : le motif reste lisible et rien n'est tamponné", () => {
    const verdict = castVerdict(0, farRoom());
    expect(verdict.performed).toBe(false);
    expect(verdict.reason).toContain("hors portée");
    expect(useCombatStore.getState().lastActionAt).toBe(0);
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
