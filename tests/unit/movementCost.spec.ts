import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import { moveActiveEntity } from "../../src/engine/combatLoop/move";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import {
  DIAGONAL_STEP_PM,
  ORTHOGONAL_STEP_PM,
  findPath,
  parseAsciiMap,
  pathCost,
  pathWithinBudget,
  stepCost,
  stepDistance,
} from "../../src/engine/grid";
import type { AsciiMap, Position } from "../../src/engine/grid";
import { buildTimeline, enemiesAct } from "../../src/engine/multiCombat";
import type {
  BattleState,
  CombatantLike,
  EnemyStrategy,
  Side,
} from "../../src/engine/multiCombat";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

/**
 * DEC-10 — entorse assumée à Dofus 1.29 : un pas **orthogonal** coûte 1 PM, un
 * pas **diagonal** en coûte 2. La diagonale ne fait donc plus gagner de temps,
 * et la facture est la **somme du chemin réellement trouvé**, jamais la distance
 * à vol d'oiseau (`stepDistance`, Chebyshev) qui offrait les détours.
 *
 * L'heuristique de A* devient Manhattan : avec une diagonale à 2 PM, Chebyshev
 * sous-estimerait le coût restant et rendrait la recherche non optimale.
 */
const p = (x: number, y: number): Position => ({ x, y });

const OPEN = parseAsciiMap([".....", ".....", ".....", ".....", "....."]);

/** Mur vertical en colonne 0 (y = 1, 2) : le contournement passe par la colonne 1. */
const DETOUR_ROWS = ["P...", "#..M", "#...", "...."];
const DETOUR = parseAsciiMap(DETOUR_ROWS);

/** Héros en (1,1), monstre en (3,1) : une diagonale plein champ reste possible. */
const HERO_SPAWNS = parseAsciiMap(["....", ".P.M", "...."]);

/** Deux cases libres en diagonale, un mur sur chacun des deux orthogonaux. */
const CORNER_CLOSED = parseAsciiMap(["###", "#.#", "##."]);

/** Un seul orthogonal bloqué : la diagonale reste licite (DEC-10). */
const CORNER_OPEN = parseAsciiMap(["###", "#.#", "#.."]);

const route = (map: AsciiMap, from: Position, to: Position, maxPm: number) => findPath({ map, from, to, maxPm });

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

function heroState(map: AsciiMap, mp: number): CombatState {
  const input = { map, hero: createHero("Balthazar", mustFind(classes, "iop")), monster: mustFind(monsters, "piou_mazoute"), spells };
  const state = initCombat(input);
  return { ...state, player: { ...state.player, mp, maxMp: mp } };
}

const STATS = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
const ZEROS = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };

function combatant(id: string, side: Side, position: Position, mp: number): CombatantLike {
  const base = { id, side, name: id, level: 1, hp: 100, maxHp: 100, ap: 6, maxAp: 6, mp, maxMp: mp };
  const rest = { position, stats: STATS, resistances: { flat: ZEROS, percent: ZEROS }, initiative: side === "enemy" ? 500 : 10 };
  return { ...base, ...rest };
}

/** Bataille sur `DETOUR` : l'ennemi en (0,0) est actif, le héros attend en (3,3). */
function battle(enemyMp: number): BattleState {
  const hero = combatant("p1", "player", p(3, 3), 3);
  const enemy = combatant("e1", "enemy", p(0, 0), enemyMp);
  return { turn: 1, ...buildTimeline([hero, enemy]), combatants: [hero, enemy], log: [], map: DETOUR };
}

function combatantOf(state: BattleState, id: string): CombatantLike {
  const found = state.combatants.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de la bataille`);
  return found;
}

/** Une seule action de déplacement, puis fin de tour : la facture reste isolée. */
function moveOnce(to: Position): EnemyStrategy {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? { kind: "move", to } : null;
  };
}

const enemyTurn = (state: BattleState, to: Position) => enemiesAct({ state, rng: () => 0.99, strategy: moveOnce(to) });

describe("DEC-10 — la diagonale coûte deux orthogonaux", () => {
  it("champ libre : (0,0) → (2,2) coûte 4 PM, jamais 2", () => {
    // Deux pas diagonaux à 2 PM : le budget de 3 PM (ancien coût) ne suffit plus.
    const path = route(OPEN, p(0, 0), p(2, 2), 4);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(p(2, 2));
    expect(route(OPEN, p(0, 0), p(2, 2), 3)).toBeNull();
  });

  it("ligne droite : trois pas orthogonaux coûtent 3 PM (inchangé)", () => {
    const path = route(OPEN, p(0, 0), p(0, 3), 3);
    expect(path).toEqual([p(0, 0), p(0, 1), p(0, 2), p(0, 3)]);
    expect(pathCost(path ?? [])).toBe(3);
    expect(route(OPEN, p(0, 0), p(0, 3), 2)).toBeNull();
  });

  it("chemin mixte : une diagonale puis un orthogonal coûtent 3 PM", () => {
    const path = route(OPEN, p(0, 0), p(2, 1), 3);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(p(2, 1));
    // 2 PM (diagonale) + 1 PM (orthogonal) = 3 PM : l'ancien coût (2 pas) est faux.
    expect(route(OPEN, p(0, 0), p(2, 1), 2)).toBeNull();
  });
});

describe("DEC-10 — un détour et un coin se paient", () => {
  it("un détour n'est pas offert : la facture suit le chemin, pas le vol d'oiseau", () => {
    // (0,0) → (0,3) : Chebyshev vaut 3, mais le mur force un détour facturé 5 PM.
    expect(stepDistance(p(0, 0), p(0, 3))).toBe(3);
    expect(route(DETOUR, p(0, 0), p(0, 3), 3)).toBeNull();
    const path = route(DETOUR, p(0, 0), p(0, 3), 5);
    expect(path).not.toBeNull();
    expect(path?.length).toBeGreaterThan(3);
    expect(route(DETOUR, p(0, 0), p(0, 3), 4)).toBeNull();
  });

  it("coin coupé interdit : les deux orthogonaux bloqués ferment la diagonale", () => {
    expect(route(CORNER_CLOSED, p(1, 1), p(2, 2), 4)).toBeNull();
  });

  it("un seul orthogonal bloqué laisse passer la diagonale", () => {
    expect(route(CORNER_OPEN, p(1, 1), p(2, 2), 2)).toEqual([p(1, 1), p(2, 2)]);
  });

  it("1 PM pour une cible diagonale : aucun pas, budget respecté", () => {
    expect(route(OPEN, p(1, 1), p(2, 2), 1)).toBeNull();
  });
});

describe("DEC-10 — une seule fonction de coût, nommée", () => {
  it("exporte les deux coûts au lieu de littéraux éparpillés", () => {
    expect([ORTHOGONAL_STEP_PM, DIAGONAL_STEP_PM]).toEqual([1, 2]);
    expect(stepCost(p(0, 0), p(0, 1))).toBe(ORTHOGONAL_STEP_PM);
    expect(stepCost(p(0, 0), p(1, 1))).toBe(DIAGONAL_STEP_PM);
    expect(stepCost(p(0, 0), p(0, 0))).toBe(0);
  });

  it("pathCost somme les pas du chemin : (0,0) → (2,2) vaut 4 PM pour 3 cases", () => {
    const path = [p(0, 0), p(1, 1), p(2, 2)];
    expect(path.length).toBe(3);
    expect(pathCost(path)).toBe(4);
    expect(pathCost([p(0, 0), p(1, 1), p(2, 1)])).toBe(3);
    expect(pathCost([p(0, 0)])).toBe(0);
    expect(pathCost([])).toBe(0);
  });

  it("pathWithinBudget rend le plus long préfixe payable, sans sauter de case", () => {
    const path = [p(0, 0), p(1, 0), p(1, 1), p(1, 2), p(0, 3)];
    expect(pathWithinBudget(path, 4)).toEqual([p(0, 0), p(1, 0), p(1, 1), p(1, 2)]);
    expect(pathWithinBudget(path, 1)).toEqual([p(0, 0), p(1, 0)]);
    expect(pathWithinBudget(path, 0)).toEqual([p(0, 0)]);
  });

  it("une entité sur un orthogonal bloque le coin comme un mur", () => {
    const input = { map: CORNER_OPEN, from: p(1, 1), to: p(2, 2), maxPm: 4 };
    expect(findPath(input)).toEqual([p(1, 1), p(2, 2)]);
    expect(findPath({ ...input, occupied: [p(1, 2)] })).toBeNull();
  });
});

describe("DEC-10 — héros et monstres paient le même prix", () => {
  it("le même détour coûte 5 PM au héros comme au monstre", () => {
    const path = route(DETOUR, p(0, 0), p(0, 3), 5) ?? [];
    expect(pathCost(path)).toBe(5);
    expect(stepDistance(p(0, 0), p(0, 3))).toBe(3);
    const hero = moveActiveEntity(heroState(DETOUR, 6), p(0, 3));
    expect(hero.player.position).toEqual(p(0, 3));
    expect(hero.player.mp).toBe(1);
    const monster = combatantOf(enemyTurn(battle(6), p(0, 3)), "e1");
    expect(monster.position).toEqual(p(0, 3));
    expect(monster.mp).toBe(1);
  });

  it("1 PM et une cible diagonale : le héros ne bouge pas, PM intacts", () => {
    const state = heroState(HERO_SPAWNS, 1);
    const next = moveActiveEntity(state, p(2, 2));
    expect(next).toBe(state);
    expect(next.player.position).toEqual(p(1, 1));
    expect(next.player.mp).toBe(1);
  });

  it("1 PM et une cible diagonale : le monstre ne bouge pas, PM intacts", () => {
    const state = battle(1);
    const next = enemyTurn(state, p(1, 1));
    expect(next).toBe(state);
    expect(combatantOf(next, "e1").position).toEqual(p(0, 0));
    expect(combatantOf(next, "e1").mp).toBe(1);
  });
});

describe("DEC-10 — moveEnemy débite le chemin réel", () => {
  it("moveEnemy débite le chemin (5 PM), pas stepDistance (3)", () => {
    const next = enemyTurn(battle(6), p(0, 3));
    expect(combatantOf(next, "e1").position).toEqual(p(0, 3));
    expect(combatantOf(next, "e1").mp).toBe(1);
    expect(next.log).toContain("e1 se déplace de 5 case(s).");
  });

  it("PM épuisés en cours de chemin : arrêt sur la dernière case payée", () => {
    const next = enemyTurn(battle(4), p(0, 3));
    const moved = combatantOf(next, "e1");
    // Chemin optimal [(0,0),(1,1),(1,2),(0,3)] = 2+1+2 = 5 PM. Avec 4 PM,
    // l'ennemi paie (1,1) puis (1,2) — 3 PM — et s'arrête là, sans reculer.
    expect(moved.position).toEqual(p(1, 2));
    expect(moved.mp).toBe(1);
    expect(next.log).toContain("e1 se déplace de 3 case(s).");
  });
});
