import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CombatResistances } from "../../src/engine/combatLoop";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { isWalkableCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { activeCombatant, buildTimeline, moveHero, resolveAttack, tackleCheck } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike, Rng } from "../../src/engine/multiCombat";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { NO_TRAILS } from "../../src/store/trails";
import { useCombatStore } from "../../src/store/useCombatStore";

const STATS = { strength: 100, intelligence: 60, chance: 40, agility: 100, wisdom: 80 };
const LEVEL = 10;
const ZERO = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function resistances(): CombatResistances {
  return { flat: { ...ZERO }, percent: { ...ZERO } };
}

function makeCombatant(overrides: Partial<CombatantLike> = {}): CombatantLike {
  return {
    id: "base",
    side: "enemy",
    name: "Base",
    level: LEVEL,
    hp: 200,
    maxHp: 200,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: { ...STATS },
    resistances: resistances(),
    initiative: 50,
    ...overrides,
  };
}

function makeState(combatants: CombatantLike[], extra: Partial<BattleState> = {}): BattleState {
  return { turn: 1, ...buildTimeline(combatants), combatants, log: [], ...extra };
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

function sequenceRng(values: readonly number[]): { rng: Rng; calls: () => number } {
  let calls = 0;
  const rng = () => {
    const value = values[calls] ?? values[values.length - 1] ?? 0;
    calls += 1;
    return value;
  };
  return { rng, calls: () => calls };
}

function enemyAt(id: string, position: Position, agility: number): CombatantLike {
  return makeCombatant({ id, side: "enemy", name: id, position, stats: { ...STATS, agility } });
}

interface DuelOverrides {
  player?: Partial<CombatantLike>;
  enemy?: Partial<CombatantLike>;
}

function duel(overrides: DuelOverrides = {}): { player: CombatantLike; enemy: CombatantLike } {
  const player = makeCombatant({ id: "p1", side: "player", name: "Iop", initiative: 120, ...overrides.player });
  const enemy = makeCombatant({ id: "e1", side: "enemy", name: "Piou", initiative: 40, ...overrides.enemy });
  return { player, enemy };
}

const OPEN: AsciiMap = parseAsciiMap([".....", ".....", ".....", ".....", "....."]);
const COLUMN_WALL: AsciiMap = parseAsciiMap(["..#..", "..#..", "..#..", "..#..", "..#.."]);

function openDuel(overrides: DuelOverrides = {}): BattleState {
  const { player, enemy } = duel(overrides);
  return makeState([player, enemy], { map: OPEN });
}

function combatantOf(state: BattleState, id: string): CombatantLike {
  const found = state.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent`);
  return found;
}

function moveInput(state: BattleState, to: Position, rng: Rng = () => 0.99) {
  return { state, to, rng };
}

describe("moveHero — T1 facture du chemin réel", () => {
  it("paie 2 PM pour deux pas orthogonaux et n'appelle jamais rng", () => {
    const enemy = { position: { x: 4, y: 4 }, stats: { ...STATS, agility: 0 } };
    const state = openDuel({ player: { mp: 3 }, enemy });
    const rng = countingRng(0);
    const next = moveHero(moveInput(state, { x: 2, y: 0 }, rng.rng));
    expect(combatantOf(next, "p1").position).toEqual({ x: 2, y: 0 });
    expect(combatantOf(next, "p1").mp).toBe(1);
    expect(rng.calls()).toBe(0);
    expect(next.log).toEqual(["Iop se déplace de 2 case(s)."]);
  });
});

describe("moveHero — T2 diagonale", () => {
  it("paie 2 PM la diagonale", () => {
    const state = openDuel({ player: { mp: 2 }, enemy: { position: { x: 4, y: 4 } } });
    const next = moveHero(moveInput(state, { x: 1, y: 1 }));
    expect(combatantOf(next, "p1").position).toEqual({ x: 1, y: 1 });
    expect(combatantOf(next, "p1").mp).toBe(0);
  });

  it("budget insuffisant : même référence, aucun tirage", () => {
    const state = openDuel({ player: { mp: 1 }, enemy: { position: { x: 4, y: 4 } } });
    const rng = countingRng(0);
    expect(moveHero(moveInput(state, { x: 1, y: 1 }, rng.rng))).toBe(state);
    expect(rng.calls()).toBe(0);
  });
});

describe("moveHero — T3 clic plus loin que le budget", () => {
  it("s'arrête sur la dernière case payable, sans message de refus", () => {
    const state = openDuel({ player: { mp: 3 }, enemy: { position: { x: 4, y: 4 } } });
    const next = moveHero(moveInput(state, { x: 4, y: 0 }));
    expect(combatantOf(next, "p1").position).toEqual({ x: 3, y: 0 });
    expect(combatantOf(next, "p1").mp).toBe(0);
    expect(next.log).toEqual(["Iop se déplace de 3 case(s)."]);
  });
});

describe("moveHero — T4 sans PM", () => {
  it("rend l'état par identité, sans log ni tirage", () => {
    const state = openDuel({ player: { mp: 0 }, enemy: { position: { x: 4, y: 4 } } });
    const rng = countingRng(0);
    expect(moveHero(moveInput(state, { x: 2, y: 0 }, rng.rng))).toBe(state);
    expect(rng.calls()).toBe(0);
    expect(state.log).toEqual([]);
  });
});

describe("moveHero — T5 mur", () => {
  it("findPath rend null : identité", () => {
    const { player, enemy } = duel({ player: { mp: 6 }, enemy: { position: { x: 4, y: 4 } } });
    const state = makeState([player, enemy], { map: COLUMN_WALL });
    expect(moveHero(moveInput(state, { x: 4, y: 0 }))).toBe(state);
  });
});

describe("moveHero — T6 bloqueur vivant", () => {
  it("contourne l'ennemi : 5 PM, jamais la distance de Manhattan", () => {
    const enemy = { position: { x: 2, y: 0 }, stats: { ...STATS, agility: 0 } };
    const state = openDuel({ player: { mp: 6 }, enemy });
    const next = moveHero(moveInput(state, { x: 3, y: 0 }));
    expect(combatantOf(next, "p1").position).toEqual({ x: 3, y: 0 });
    expect(combatantOf(next, "p1").mp).toBe(1);
  });

  it("arrivée occupée : identité", () => {
    const state = openDuel({ player: { mp: 6 }, enemy: { position: { x: 2, y: 0 } } });
    expect(moveHero(moveInput(state, { x: 2, y: 0 }))).toBe(state);
  });
});

describe("moveHero — T7 tacle systématique", () => {
  it("perd 1 PM, reste sur place, puis reperd 1 PM au clic suivant", () => {
    const player = { position: { x: 1, y: 1 }, mp: 3, stats: { ...STATS, agility: 0 } };
    const enemy = { position: { x: 2, y: 1 }, stats: { ...STATS, agility: 200 } };
    const state = openDuel({ player, enemy });
    const first = moveHero(moveInput(state, { x: 1, y: 0 }, () => 0));
    expect(combatantOf(first, "p1").position).toEqual({ x: 1, y: 1 });
    expect(combatantOf(first, "p1").mp).toBe(2);
    const second = moveHero(moveInput(first, { x: 1, y: 0 }, () => 0));
    expect(combatantOf(second, "p1").position).toEqual({ x: 1, y: 1 });
    expect(combatantOf(second, "p1").mp).toBe(1);
  });
});

describe("moveHero — T8 un seul jet par pas", () => {
  it("échappe au premier pas et sort du contact sans second tirage", () => {
    const player = { position: { x: 1, y: 1 }, mp: 3, stats: { ...STATS, agility: 100 } };
    const enemy = { position: { x: 2, y: 1 }, stats: { ...STATS, agility: 0 } };
    const state = openDuel({ player, enemy });
    const rng = countingRng(0.99);
    const next = moveHero(moveInput(state, { x: 1, y: 3 }, rng.rng));
    expect(combatantOf(next, "p1").position).toEqual({ x: 1, y: 3 });
    expect(combatantOf(next, "p1").mp).toBe(1);
    expect(rng.calls()).toBe(1);
  });
});

describe("moveHero — T9 voisin diagonal", () => {
  it("ne tacle pas : aucun tirage", () => {
    const player = { position: { x: 1, y: 1 }, mp: 3 };
    const enemy = { position: { x: 2, y: 2 }, stats: { ...STATS, agility: 200 } };
    const state = openDuel({ player, enemy });
    const rng = countingRng(0);
    const next = moveHero(moveInput(state, { x: 0, y: 0 }, rng.rng));
    expect(combatantOf(next, "p1").position).toEqual({ x: 0, y: 0 });
    expect(combatantOf(next, "p1").mp).toBe(1);
    expect(rng.calls()).toBe(0);
  });
});

describe("moveHero — T10 tacle avant paiement", () => {
  it("un tacle sur une diagonale coûte 1 PM, pas les 2 PM du pas", () => {
    const player = { position: { x: 1, y: 1 }, mp: 2, stats: { ...STATS, agility: 0 } };
    const enemy = { position: { x: 2, y: 1 }, stats: { ...STATS, agility: 200 } };
    const state = openDuel({ player, enemy });
    const next = moveHero(moveInput(state, { x: 0, y: 0 }, () => 0));
    expect(combatantOf(next, "p1").position).toEqual({ x: 1, y: 1 });
    expect(combatantOf(next, "p1").mp).toBe(1);
  });
});

describe("moveHero — T11 sort et déplacement sans couplage", () => {
  it("laisse sortir puis marcher puis resortir, PA et PM indépendants", () => {
    const player = { position: { x: 1, y: 1 }, ap: 6, mp: 3 };
    const enemy = { position: { x: 4, y: 4 }, stats: { ...STATS, agility: 0 } };
    const state = openDuel({ player, enemy });
    const cast = resolveAttack({ state, attackerId: "p1", targetId: "e1", attack: attackSpec(), rng: () => 0.99 });
    expect(combatantOf(cast, "p1").ap).toBe(3);
    const moved = moveHero(moveInput(cast, { x: 2, y: 1 }));
    expect(combatantOf(moved, "p1").ap).toBe(3);
    expect(combatantOf(moved, "p1").mp).toBe(2);
    const again = resolveAttack({
      state: moved,
      attackerId: "p1",
      targetId: "e1",
      attack: attackSpec(),
      rng: () => 0.99,
    });
    expect(combatantOf(again, "p1").ap).toBe(0);
    expect(combatantOf(again, "p1").mp).toBe(2);
  });
});

describe("moveHero — T12 tacle raté au 2e pas", () => {
  it("s'arrête sur la case du 1er pas, sans sauter de case", () => {
    const player = { position: { x: 1, y: 1 }, mp: 3, stats: { ...STATS, agility: 0 } };
    const enemy = { position: { x: 2, y: 2 }, stats: { ...STATS, agility: 200 } };
    const state = openDuel({ player, enemy });
    const rng = countingRng(0);
    const next = moveHero(moveInput(state, { x: 1, y: 4 }, rng.rng));
    expect(combatantOf(next, "p1").position).toEqual({ x: 1, y: 2 });
    expect(combatantOf(next, "p1").mp).toBe(1);
    expect(rng.calls()).toBe(1);
    expect(next.log).toEqual(["Iop se déplace de 1 case(s)."]);
  });
});

describe("moveHero — T13 un jet réussi puis un raté", () => {
  it("paie le 1er pas, s'arrête au 2e et ne tire que deux fois", () => {
    const player = makeCombatant({ id: "p1", side: "player", name: "Iop", initiative: 120, mp: 3, position: { x: 1, y: 1 } });
    const guards = [enemyAt("e1", { x: 2, y: 1 }, 100), enemyAt("e2", { x: 2, y: 2 }, 100)];
    const state = makeState([player, ...guards], { map: OPEN });
    const rng = sequenceRng([0.2, 0.9]);
    const next = moveHero(moveInput(state, { x: 1, y: 4 }, rng.rng));
    expect(combatantOf(next, "p1").position).toEqual({ x: 1, y: 2 });
    expect(combatantOf(next, "p1").mp).toBe(1);
    expect(rng.calls()).toBe(2);
    expect(next.log).toEqual(["Iop se déplace de 1 case(s)."]);
  });
});

describe("moveHero — T14 deux pas, deux échappées", () => {
  it("atteint la case exacte et paie les deux pas", () => {
    const player = makeCombatant({ id: "p1", side: "player", name: "Iop", initiative: 120, mp: 3, position: { x: 1, y: 1 } });
    const guards = [enemyAt("e1", { x: 2, y: 1 }, 100), enemyAt("e2", { x: 2, y: 2 }, 100)];
    const state = makeState([player, ...guards], { map: OPEN });
    const rng = sequenceRng([0.2, 0.2]);
    const next = moveHero(moveInput(state, { x: 1, y: 3 }, rng.rng));
    expect(combatantOf(next, "p1").position).toEqual({ x: 1, y: 3 });
    expect(combatantOf(next, "p1").mp).toBe(1);
    expect(rng.calls()).toBe(2);
    expect(next.log).toEqual(["Iop se déplace de 2 case(s)."]);
  });
});

describe("moveHero — gardes", () => {
  it("refuse hors du tour du héros et sur un héros mort", () => {
    const state = openDuel({ enemy: { initiative: 500, position: { x: 4, y: 4 } } });
    expect(activeCombatant(state)?.side).toBe("enemy");
    expect(moveHero(moveInput(state, { x: 1, y: 0 }))).toBe(state);
    const dead = openDuel({ player: { hp: 0, mp: 3 }, enemy: { position: { x: 4, y: 4 } } });
    expect(moveHero(moveInput(dead, { x: 1, y: 0 }))).toBe(dead);
  });

  it("refuse sans carte", () => {
    const { player, enemy } = duel();
    const state = makeState([player, enemy]);
    expect(moveHero(moveInput(state, { x: 1, y: 0 }))).toBe(state);
  });

  it("clic sur sa propre case : identité", () => {
    const state = openDuel({ player: { position: { x: 0, y: 0 }, mp: 3 } });
    expect(moveHero(moveInput(state, { x: 0, y: 0 }))).toBe(state);
  });
});

describe("tackleCheck — jet d'échappée sans jet de PA", () => {
  it("retient le tacleur le plus agile et ne consomme qu'un tirage", () => {
    const player = { position: { x: 1, y: 1 }, stats: { ...STATS, agility: 0 } };
    const enemy = { position: { x: 2, y: 1 }, stats: { ...STATS, agility: 200 } };
    const state = openDuel({ player, enemy });
    const rng = countingRng(0);
    const check = tackleCheck({ state, moverId: "p1", rng: rng.rng });
    expect(check).toEqual({ escaped: false, mpLoss: 1 });
    expect(rng.calls()).toBe(1);
  });
});

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";

function roomOne(): DungeonRoom {
  const dungeon: DungeonDef | undefined = dungeons.find((entry) => entry.id === DUNGEON_ID);
  const room = dungeon?.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

const battle = (): BattleState | null => useCombatStore.getState().battle;

function withActive(id: string): BattleState {
  const state = battle();
  if (state === null) throw new Error("aucun battle");
  return { ...state, activeIndex: Math.max(0, state.order.indexOf(id)) };
}

function findIn(id: string): CombatantLike | undefined {
  return battle()?.combatants.find((entry) => entry.id === id);
}

function freeNeighbor(state: BattleState, from: Position): Position {
  const map = state.map;
  if (map === undefined) throw new Error("carte absente");
  const taken = state.combatants.filter((entry) => entry.hp > 0).map((entry) => entry.position);
  const cells = [
    { x: from.x + 1, y: from.y },
    { x: from.x, y: from.y + 1 },
    { x: from.x - 1, y: from.y },
    { x: from.x, y: from.y - 1 },
  ];
  const free = cells.find((cell) => isWalkableCell(map, cell) && !taken.some((takenCell) => samePosition(takenCell, cell)));
  if (free === undefined) throw new Error("aucune case libre");
  return free;
}

beforeEach(() => {
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null, selectedSpellId: null });
  useCombatStore.getState().startDungeonRoom({ room: roomOne() });
  useCombatStore.setState({ battle: withActive("player") });
});

describe("useCombatStore — battleMove paie et peint le chemin", () => {
  it("déplace le héros, paie 1 PM et garde le sort sélectionné", () => {
    const state = battle();
    const hero = findIn("player");
    if (state === null || hero === undefined) throw new Error("battle incomplet");
    const to = freeNeighbor(state, hero.position);
    useCombatStore.getState().selectSpell("pression");
    useCombatStore.getState().battleMove({ to, rng: () => 0.99 });
    expect(findIn("player")?.position).toEqual(to);
    expect(findIn("player")?.mp).toBe(hero.mp - 1);
    expect(findIn("player")?.ap).toBe(hero.ap);
    expect(useCombatStore.getState().selectedSpellId).toBe("pression");
  });

  it("peint le chemin réel du moteur dans les trajets", () => {
    const { player, enemy } = duel({ player: { mp: 3 }, enemy: { position: { x: 4, y: 4 } } });
    useCombatStore.setState({ battle: makeState([player, enemy], { map: OPEN }), trails: NO_TRAILS });
    useCombatStore.getState().battleMove({ to: { x: 2, y: 0 }, rng: () => 0.99 });
    expect(useCombatStore.getState().trails.trails).toEqual([
      { id: "p1", cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] },
    ]);
  });
});

describe("useCombatStore — battleMove refuse sans rien écrire", () => {
  it("refuse un pas hors du tour du héros sans toucher aux trajets", () => {
    const previous = withActive("piou_mazoute-0");
    useCombatStore.setState({ battle: previous, trails: NO_TRAILS });
    useCombatStore.getState().battleMove({ to: { x: 1, y: 1 } });
    expect(battle()).toBe(previous);
    expect(useCombatStore.getState().trails).toBe(NO_TRAILS);
  });

  it("sans PM, le clic ne produit ni état neuf ni trajet", () => {
    const state = battle();
    if (state === null) throw new Error("battle incomplet");
    const combatants = state.combatants.map((entry) => (entry.id === "player" ? { ...entry, mp: 0 } : entry));
    const frozen = { ...state, combatants };
    useCombatStore.setState({ battle: frozen, trails: NO_TRAILS });
    useCombatStore.getState().battleMove({ to: freeNeighbor(frozen, combatantOf(frozen, "player").position) });
    expect(battle()).toBe(frozen);
    expect(useCombatStore.getState().trails).toBe(NO_TRAILS);
  });

  it("ne fait rien sans battle", () => {
    useCombatStore.setState({ battle: null });
    useCombatStore.getState().battleMove({ to: { x: 1, y: 1 } });
    expect(battle()).toBeNull();
  });
});

describe("useCombatStore — R7 portée revue au lancer", () => {
  it("un sort devenu hors portée est refusé sans perdre la sélection", () => {
    const state = battle();
    if (state === null) throw new Error("battle incomplet");
    const enemyId = state.combatants.find((entry) => entry.side === "enemy")?.id ?? "";
    const near = state.combatants.map((entry) => {
      if (entry.id === "player") return { ...entry, position: { x: 2, y: 1 } };
      if (entry.id === enemyId) return { ...entry, position: { x: 4, y: 1 } };
      return entry;
    });
    useCombatStore.setState({ battle: { ...state, combatants: near }, selectedSpellId: "pression" });
    useCombatStore.getState().battleMove({ to: { x: 1, y: 1 }, rng: () => 0.99 });
    expect(findIn("player")?.position).toEqual({ x: 1, y: 1 });
    expect(useCombatStore.getState().battleSpellAttack({ targetId: enemyId, rng: () => 0.99 })).toBe(false);
    expect(useCombatStore.getState().selectedSpellId).toBe("pression");
  });
});
