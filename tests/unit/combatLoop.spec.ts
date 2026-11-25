import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { getReachableCells } from "../../src/engine/combatLoop/cells";
import { runEnemyTurn } from "../../src/engine/combatLoop/enemy";
import { initCombat } from "../../src/engine/combatLoop/init";
import { moveActiveEntity } from "../../src/engine/combatLoop/move";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import { endPlayerTurn } from "../../src/engine/combatLoop/turn";
import type { CombatState, Rng } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { isWalkableCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useCombatStore } from "../../src/store/useCombatStore";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));

const alwaysZero: Rng = () => 0;
const alwaysHigh: Rng = () => 0.99;
const DEMO_MAP_ID = "ferraille_plage_01";
const DEMO_MONSTER_ID = "piou_mazoute";

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

const demoMap = () => parseAsciiMap(mustFind(maps, DEMO_MAP_ID).grid);

const iopHero = () => createHero("Balthazar", mustFind(classes, "iop"));

const piou = () => mustFind(monsters, DEMO_MONSTER_ID);

const buildState = (rows: readonly string[] = []): CombatState =>
  initCombat({
    map: rows.length === 0 ? demoMap() : parseAsciiMap([...rows]),
    hero: iopHero(),
    monster: piou(),
    spells,
  });

/**
 * DEC-10 : 1 PM orthogonal, 2 PM diagonal ⇒ toute case atteinte a un Manhattan
 * inférieur ou égal aux PM restants (borne plus forte que l'ancienne Chebyshev).
 */
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const hasCell = (cells: readonly { x: number; y: number }[], x: number, y: number) =>
  cells.some((cell) => cell.x === x && cell.y === y);

describe("initCombat", () => {
  it("place les combattants sur les spawns de la carte", () => {
    const state = buildState();
    expect(state.player.position).toEqual({ x: 3, y: 3 });
    expect(state.enemy.position).toEqual({ x: 5, y: 9 });
  });

  it("démarre au tour 1, en phase joueur, PA/PM pleins", () => {
    const state = buildState();
    expect(state.turn).toBe(1);
    expect(state.phase).toBe("player_turn");
    expect([state.player.ap, state.player.mp]).toEqual([6, 3]);
    expect([state.player.maxAp, state.player.maxMp]).toEqual([6, 3]);
    expect(state.rewards).toBeNull();
  });

  it("démarre sans point de caractéristique investi", () => {
    const state = buildState();
    expect(state.player.stats).toEqual({
      strength: 0,
      intelligence: 0,
      chance: 0,
      agility: 0,
      wisdom: 0,
    });
    expect(state.player.pp).toBe(100);
  });

  it("journalise l'ouverture du combat", () => {
    expect(buildState().log.length).toBeGreaterThan(0);
  });
});

describe("getReachableCells", () => {
  it("ne propose que des cases marchables et libres", () => {
    const state = buildState();
    const cells = getReachableCells(state);
    expect(cells.length).toBeGreaterThan(5);
    cells.forEach((cell) => {
      expect(isWalkableCell(state.map, cell)).toBe(true);
      expect(samePosition(cell, state.player.position)).toBe(false);
      expect(samePosition(cell, state.enemy.position)).toBe(false);
      expect(distance(cell, state.player.position)).toBeLessThanOrEqual(3);
    });
  });

  it("exclut murs, eau et cases hors de portée des PM", () => {
    const cells = getReachableCells(buildState());
    expect(hasCell(cells, 1, 3)).toBe(false);
    expect(hasCell(cells, 2, 2)).toBe(false);
    expect(hasCell(cells, 3, 6)).toBe(false);
    expect(hasCell(cells, 6, 3)).toBe(true);
    expect(hasCell(cells, 7, 3)).toBe(false);
  });

  it("retourne un ensemble vide sans point de mouvement", () => {
    const state = buildState();
    const drained = { ...state, player: { ...state.player, mp: 0 } };
    expect(getReachableCells(drained)).toEqual([]);
  });
});

describe("moveActiveEntity", () => {
  it("déplace le joueur et déduit les PM consommés", () => {
    const state = buildState();
    const moved = moveActiveEntity(state, { x: 6, y: 3 });
    expect(moved.player.position).toEqual({ x: 6, y: 3 });
    expect(moved.player.mp).toBe(0);
    expect(moved.player.ap).toBe(6);
    expect(moved.log.length).toBe(state.log.length + 1);
  });

  it("refuse une case inatteignable", () => {
    const state = buildState();
    expect(moveActiveEntity(state, { x: 3, y: 6 })).toBe(state);
  });

  it("ne déplace jamais le joueur pendant le tour ennemi", () => {
    const state = { ...buildState(), phase: "enemy_turn" as const };
    const moved = moveActiveEntity(state, { x: 5, y: 8 });
    expect(moved.player.position).toEqual({ x: 3, y: 3 });
    expect(moved.enemy.position).toEqual({ x: 5, y: 8 });
  });

  it("refuse de bouger hors phase de jeu", () => {
    const state = { ...buildState(), phase: "victory" as const };
    expect(moveActiveEntity(state, { x: 4, y: 3 })).toBe(state);
  });

  it("ne mute pas l'état d'entrée", () => {
    const state = buildState();
    const before = structuredClone(state);
    moveActiveEntity(state, { x: 4, y: 3 });
    expect(state).toEqual(before);
  });
});

describe("getCastableCells : sorts de dégâts", () => {
  it("ne retient que la case de l'adversaire dans la portée", () => {
    const state = buildState(["P.M.", "...."]);
    expect(getCastableCells(state, "pression")).toEqual([{ x: 2, y: 0 }]);
  });

  it("refuse une cible hors de portée", () => {
    const state = buildState(["P...M", "....."]);
    expect(getCastableCells(state, "pression")).toEqual([]);
  });

  it("bloque la cible derrière un mur", () => {
    const state = buildState(["P#M."]);
    expect(getCastableCells(state, "pression")).toEqual([]);
  });

  it("laisse passer la ligne de vue au-dessus de l'eau", () => {
    const state = buildState(["P~M."]);
    expect(getCastableCells(state, "pression")).toEqual([{ x: 2, y: 0 }]);
  });

  it("garde la portée en carré (Chebyshev), jamais en losange", () => {
    const state = buildState(["P...", "....", "..M.", "...."]);
    // GRID-01 : (0,0) → (2,2) vaut 2 en Chebyshev (la diagonale est un pas de
    // portée), donc la cible diagonale de Pression (2 PO) est atteignable.
    expect(getCastableCells(state, "pression")).toEqual([{ x: 2, y: 2 }]);
    expect(getCastableCells(buildState(["P...", "....", "...M", "...."]), "pression")).toEqual([]);
  });

  it("respecte la portée 1 du Bec Mazouté", () => {
    expect(getCastableCells(buildState(["PM.."]), "bec_mazoute")).toEqual([{ x: 1, y: 0 }]);
    expect(getCastableCells(buildState(["P.M."]), "bec_mazoute")).toEqual([]);
  });
});

describe("getCastableCells : Bond", () => {
  it("propose les cases marchables libres de la portée", () => {
    const cells = getCastableCells(buildState(["P.M.", "...."]), "bond");
    expect(cells.length).toBe(6);
    expect(hasCell(cells, 2, 0)).toBe(false);
    expect(hasCell(cells, 0, 0)).toBe(false);
  });

  it("exclut les murs de la téléportation", () => {
    const cells = getCastableCells(buildState(["P.M.", "#..."]), "bond");
    expect(cells.length).toBe(5);
    expect(hasCell(cells, 0, 1)).toBe(false);
  });
});

describe("castSpell : PA et dégâts", () => {
  it("déduit les PA et applique un jet déterministe", () => {
    const state = buildState(["P.M.", "...."]);
    const cast = castSpell({ state, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero });
    expect(cast.player.ap).toBe(3);
    expect(cast.enemy.hp).toBe(27);
    expect(cast.enemy.ap).toBe(state.enemy.ap);
    expect(cast).not.toBe(state);
  });

  it("borne les dégâts hauts à la plage du sort", () => {
    const state = buildState(["P.M.", "...."]);
    const cast = castSpell({ state, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysHigh });
    expect(cast.enemy.hp).toBe(23);
  });

  it("refuse le sort sans PA suffisants", () => {
    const state = buildState(["P.M.", "...."]);
    const drained = { ...state, player: { ...state.player, ap: 2 } };
    const cast = castSpell({ state: drained, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero });
    expect(cast).toBe(drained);
  });
});

/**
 * ITEM-01 — mêmes cinq cas chiffrés que `multiCombat.spec.ts`, appliqués au
 * moteur 1v1 : base nue 100, stat nulle, pour que les valeurs attendues se
 * lisent sans recalcul.
 */
describe("castSpell : stats d'équipement", () => {
  const BASE = 100;
  const NO_STAT = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };

  function damageWith(options: { percentDmg?: number; pctRes?: number } = {}): number {
    const state = buildState(["P.M.", "...."]);
    const spell = { ...mustFind(spells, "pression"), damage: { min: BASE, max: BASE } };
    const percent = { ...state.enemy.resistances.percent, earth: options.pctRes ?? 0 };
    const crafted = {
      ...state,
      player: { ...state.player, stats: NO_STAT, percentDmg: options.percentDmg ?? 0 },
      enemy: { ...state.enemy, hp: 1000, maxHp: 1000, resistances: { ...state.enemy.resistances, percent } },
      spellsById: { ...state.spellsById, pression: spell },
    };
    const cast = castSpell({ state: crafted, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero });
    return crafted.enemy.hp - cast.enemy.hp;
  }

  it("retranche 10 % de résistance sans % Dégâts : 100 → 90", () => {
    expect(damageWith({ pctRes: 10 })).toBe(90);
  });

  it("ajoute 20 % Dégâts sans résistance : 100 → 120", () => {
    expect(damageWith({ percentDmg: 20 })).toBe(120);
  });

  it("applique le % Dégâts AVANT la résistance : 100 → 120 → 108", () => {
    expect(damageWith({ percentDmg: 20, pctRes: 10 })).toBe(108);
  });

  it("tombe à 0 dégât sur 100 % de résistance, jamais négatif", () => {
    expect(damageWith({ pctRes: 100 })).toBe(0);
  });

  it("ne change rien à 0 % Dégâts et 0 % résistance", () => {
    expect(damageWith()).toBe(BASE);
  });
});

describe("castSpell : validation de cible", () => {
  it("refuse une cible hors portée ou sans ligne de vue", () => {
    const near = buildState(["P.M.", "...."]);
    const offTarget = castSpell({ state: near, spellId: "pression", target: { x: 1, y: 0 }, rng: alwaysZero });
    expect(offTarget).toBe(near);
    const blocked = buildState(["P#M."]);
    expect(castSpell({ state: blocked, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero })).toBe(blocked);
  });

  it("accepte la cible à travers l'eau", () => {
    const state = buildState(["P~M."]);
    const cast = castSpell({ state, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero });
    expect(cast.enemy.hp).toBe(27);
  });

  it("passe en victoire quand le monstre tombe à 0 PV", () => {
    const state = buildState(["P.M.", "...."]);
    const weakened = { ...state, enemy: { ...state.enemy, hp: 5 } };
    const cast = castSpell({ state: weakened, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero });
    expect(cast.enemy.hp).toBe(0);
    expect(cast.phase).toBe("victory");
  });
});

describe("castSpell : Bond", () => {
  it("téléporte sans consommer de PM", () => {
    const state = buildState();
    const cast = castSpell({ state, spellId: "bond", target: { x: 4, y: 3 }, rng: alwaysZero });
    expect(cast.player.position).toEqual({ x: 4, y: 3 });
    expect(cast.player.mp).toBe(3);
    expect(cast.player.ap).toBe(1);
  });

  it("refuse une case occupée par l'adversaire", () => {
    const state = buildState(["PM.."]);
    const cast = castSpell({ state, spellId: "bond", target: { x: 1, y: 0 }, rng: alwaysZero });
    expect(cast).toBe(state);
  });
});

describe("castSpell : poussée", () => {
  it("pousse la cible d'une case", () => {
    const state = buildState(["P.M.#", "....."]);
    const cast = castSpell({ state, spellId: "epee_du_destin", target: { x: 2, y: 0 }, rng: alwaysZero });
    expect(cast.enemy.position).toEqual({ x: 3, y: 0 });
    expect(cast.enemy.hp).toBe(25);
  });

  it("ajoute les dégâts de collision quand le mur bloque", () => {
    const state = buildState(["P.M.#", "....."]);
    const spear = mustFind(spells, "epee_du_destin");
    const pushed = { ...state, spellsById: { ...state.spellsById, epee_du_destin: { ...spear, pushCells: 2 } } };
    const cast = castSpell({ state: pushed, spellId: "epee_du_destin", target: { x: 2, y: 0 }, rng: alwaysZero });
    expect(cast.enemy.position).toEqual({ x: 3, y: 0 });
    expect(cast.enemy.hp).toBe(17);
  });
});

describe("runEnemyTurn", () => {
  it("rapproche le monstre quand le joueur est hors portée", () => {
    const state = { ...buildState(), phase: "enemy_turn" as const };
    const next = runEnemyTurn(state, alwaysZero);
    const before = distance(state.enemy.position, state.player.position);
    expect(distance(next.enemy.position, next.player.position)).toBeLessThan(before);
    expect(next.phase).toBe("enemy_turn");
  });

  it("attaque deux fois quand le joueur est au contact", () => {
    const state = { ...buildState(["PM.."]), phase: "enemy_turn" as const };
    const next = runEnemyTurn(state, alwaysZero);
    expect(next.player.hp).toBe(45);
    expect(next.enemy.ap).toBe(0);
  });

  it("fait basculer le combat en défaite", () => {
    const state = buildState(["PM.."]);
    const weak = { ...state, phase: "enemy_turn" as const, player: { ...state.player, hp: 10 } };
    const next = runEnemyTurn(weak, alwaysZero);
    expect(next.player.hp).toBe(0);
    expect(next.phase).toBe("defeat");
  });
});

describe("endPlayerTurn", () => {
  it("incrémente le tour et restaure PA/PM du joueur", () => {
    const state = buildState();
    const moved = moveActiveEntity(state, { x: 6, y: 3 });
    const next = endPlayerTurn(moved, alwaysZero);
    expect(next.turn).toBe(2);
    expect(next.phase).toBe("player_turn");
    expect([next.player.ap, next.player.mp]).toEqual([6, 3]);
  });

  it("laisse l'état intact si le combat est déjà gagné", () => {
    const won = { ...buildState(), phase: "victory" as const };
    expect(endPlayerTurn(won, alwaysZero)).toBe(won);
  });
});

describe("resolveCombatRewards", () => {
  const rewards = (rng: Rng) =>
    resolveCombatRewards({ heroXp: 0, hero: buildState().player, monster: piou(), progression, rng });

  it("accorde XP, niveau et montée de niveau", () => {
    const result = rewards(alwaysZero);
    expect(result.xpGained).toBe(120);
    expect(result.totalXp).toBe(120);
    expect(result.level).toBe(2);
    expect(result.levelUp).toEqual({ hp: 5, capitalPoints: 5, spellPoints: 1 });
    expect(result.prospection).toBe(100);
  });

  it("accorde le butin quand le tirage passe sous la chance", () => {
    // §2 de la fiche Ferraille : le Piou Mazouté lâche aussi la goutte de mazout (0.45).
    expect(rewards(alwaysZero).drops).toEqual(["plume_mazoutee", "fer_goutte_mazout"]);
  });

  it("n'accorde aucun butin quand le tirage échoue", () => {
    expect(rewards(alwaysHigh).drops).toEqual([]);
  });
});

describe("resolveCombatRewards : multiplicateurs injectés", () => {
  const boosted = (
    multipliers: { xp?: number; drop?: number },
    hero = buildState().player,
    rng: Rng = alwaysZero,
  ) => resolveCombatRewards({ heroXp: 0, hero, monster: piou(), progression, rng, multipliers });

  it("conserve à l'identique les valeurs 1.29 sans multiplicateur", () => {
    const neutral = resolveCombatRewards({
      heroXp: 0,
      hero: buildState().player,
      monster: piou(),
      progression,
      rng: alwaysZero,
    });
    expect(boosted({})).toEqual(neutral);
  });

  it("applique ×10 à l'XP après l'arrondi 1.29", () => {
    expect(boosted({ xp: 10 }).xpGained).toBe(1200);
  });

  it("plafonne la chance de drop à 1 avec ×10", () => {
    // 0.95 échoue aux taux 1.29 (0.4 / 0.45) mais passe sous min(1, 0.4 × 10).
    const roll = () => 0.95;
    expect(boosted({ drop: 10 }, buildState().player, roll).drops).toEqual([
      "plume_mazoutee",
      "fer_goutte_mazout",
    ]);
  });

  it("n'accorde toujours aucun butin sous le seuil de PP, même à ×10", () => {
    const underThreshold = { ...buildState().player, pp: 50 };
    expect(boosted({ drop: 10 }, underThreshold).drops).toEqual([]);
  });
});

describe("endPlayerTurn : restauration des PA/PM ennemis", () => {
  it("remet les PA et PM de l'ennemi à chaque début de tour", () => {
    const state = buildState(["PM.."]);
    const first = endPlayerTurn(state, alwaysZero);
    expect(first.player.hp).toBe(45);
    expect(first.turn).toBe(2);
    expect(first.enemy.ap).toBe(first.enemy.maxAp % 3);
    const second = endPlayerTurn(first, alwaysZero);
    expect(second.player.hp).toBe(35);
    expect(second.turn).toBe(3);
  });

  it("laisse le monstre se déplacer au tour suivant", () => {
    const state = buildState();
    const first = endPlayerTurn(state, alwaysZero);
    expect(first.enemy.mp).toBe(0);
    const second = endPlayerTurn(first, alwaysZero);
    expect(second.enemy.position).not.toEqual(first.enemy.position);
  });

  it("ne mute pas l'état d'entrée", () => {
    const state = buildState(["PM.."]);
    const before = structuredClone(state);
    endPlayerTurn(state, alwaysZero);
    expect(state).toEqual(before);
  });
});

describe("immuabilité du moteur", () => {
  it("ne mute jamais l'état d'entrée d'un cast", () => {
    const state = buildState(["P.M.", "...."]);
    const before = structuredClone(state);
    castSpell({ state, spellId: "pression", target: { x: 2, y: 0 }, rng: alwaysZero });
    expect(state).toEqual(before);
  });
});

describe("useCombatStore", () => {
  it("démarre le combat de démonstration", () => {
    useCombatStore.getState().startDemoCombat();
    const { combat, mapId } = useCombatStore.getState();
    expect(mapId).toBe(DEMO_MAP_ID);
    expect(combat?.phase).toBe("player_turn");
    expect(combat?.player.name).toBe("Balthazar");
    expect(combat?.enemy.name).toBe("Piou Mazouté");
    expect(combat?.player.spellIds.length).toBe(3);
  });

  it("déplace le héros sur une case jouable", () => {
    useCombatStore.getState().startDemoCombat();
    useCombatStore.getState().clickCell({ x: 4, y: 3 });
    expect(useCombatStore.getState().combat?.player.position).toEqual({ x: 4, y: 3 });
  });

  it("garde le sort sélectionné quand le cast est refusé", () => {
    useCombatStore.getState().startDemoCombat();
    useCombatStore.getState().selectSpell("pression");
    useCombatStore.getState().clickCell({ x: 4, y: 3 });
    expect(useCombatStore.getState().selectedSpellId).toBe("pression");
  });

  it("passe la main et incrémente le tour", () => {
    useCombatStore.getState().startDemoCombat();
    useCombatStore.getState().endTurn();
    expect(useCombatStore.getState().combat?.turn).toBe(2);
  });
});
