import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { battleFromCombat, PLAYER_BATTLE_ID } from "../../src/engine/battleBridge/fromExploration";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { initCombat } from "../../src/engine/combatLoop/init";
import { moveActiveEntity } from "../../src/engine/combatLoop/move";
import { initiativeOf, openingPhase } from "../../src/engine/combatLoop/opening";
import type { CombatStats, CombatState, Rng } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap } from "../../src/engine/grid";
import { advanceTurn, buildTimeline, moveHero, resolveAttack } from "../../src/engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

/**
 * PONT EXPLORATION → MOTEUR UNIQUE — DEC-12, étape 2.
 *
 * Ces tests prouvent qu'un combat 1v1 d'exploration, projeté en `BattleState`
 * à **un seul monstre**, conserve l'état initial, l'ordre d'ouverture et les
 * dégâts du moteur 1v1. Les différences ajoutées sciemment par DEC-12 (tacle,
 * coup critique) sont testées comme **voulues**, jamais comme des régressions.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));

const NO_STATS: CombatStats = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
/** Jet haut : 12 dégâts (borne max de Pression) et jamais de critique (taux mini 2 %). */
const HIGH_ROLL: Rng = () => 0.99;
const HERO = () => createHero("Balthazar", mustFind(classes, "iop"));
const PIOU = () => mustFind(monsters, "piou_mazoute");
const PRESSION = mustFind(spells, "pression");

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

function initialCombat(rows: readonly string[] = ["P.M."]): CombatState {
  return initCombat({ map: parseAsciiMap([...rows]), hero: HERO(), monster: PIOU(), spells });
}

function battleOf(combat: CombatState, monster: MonsterDef = PIOU()): BattleState {
  return battleFromCombat({ combat, monster });
}

function heroOf(battle: BattleState): CombatantLike {
  return mustFind(battle.combatants, PLAYER_BATTLE_ID);
}

function enemyOf(battle: BattleState): CombatantLike {
  return mustFind(battle.combatants, PIOU().id);
}

function withStats(combat: CombatState, player: CombatStats, enemy: CombatStats): CombatState {
  const pools = { hp: 100, maxHp: 100 };
  const nextPlayer = { ...combat.player, ...pools, stats: player };
  return { ...combat, player: nextPlayer, enemy: { ...combat.enemy, ...pools, stats: enemy } };
}

/** Champs qui doivent survivre à la projection, des deux côtés du pont. */
function projected(source: CombatState["player"] | CombatantLike) {
  const { hp, maxHp, ap, maxAp, mp, maxMp, position, level, stats, resistances } = source;
  return { hp, maxHp, ap, maxAp, mp, maxMp, position, level, stats, resistances };
}

function damageRoll(spell: SpellDef, rng: Rng): number {
  const { min, max } = spell.damage ?? { min: 0, max: 0 };
  return min + Math.floor(rng() * (max - min + 1));
}

/** Même `AttackSpec` que l'UI construira depuis `data/spells.yaml`. */
function pressionAttack(): AttackSpec {
  const spell = PRESSION;
  const geometry = { minRange: spell.minRange, maxRange: spell.maxRange, requiresLos: spell.requiresLos };
  const identity = { spellId: spell.id, spellName: spell.name, baseCrit: 0, apCost: spell.apCost };
  return { base: damageRoll(spell, HIGH_ROLL), element: spell.element ?? "neutral", ...identity, ...geometry };
}

describe("PONT 1v1 — état initial identique", () => {
  it("projette PV, PA, PM, position, niveau, stats et résistances sans perte", () => {
    const combat = initialCombat(["P.M."]);
    const battle = battleOf(combat);
    expect(projected(heroOf(battle))).toEqual(projected(combat.player));
    expect(projected(enemyOf(battle))).toEqual(projected(combat.enemy));
    expect(heroOf(battle).percentDmg).toBe(combat.player.percentDmg);
    expect(enemyOf(battle).percentDmg).toBe(combat.enemy.percentDmg);
  });

  it("conserve les sorts du héros et du monstre, sans les confondre", () => {
    const combat = initialCombat();
    const battle = battleOf(combat);
    expect(heroOf(battle).spellIds).toEqual(combat.player.spellIds);
    expect(enemyOf(battle).spellIds).toEqual(combat.enemy.spellIds);
  });

  it("nomme le héros 0_player (camp player) et le monstre par son id de donnée", () => {
    const battle = battleOf(initialCombat());
    expect(heroOf(battle)).toMatchObject({ id: "0_player", side: "player", armor: 0 });
    expect(enemyOf(battle)).toMatchObject({ id: "piou_mazoute", side: "enemy", armor: 0 });
  });

  it("recopie le tour, la carte et le journal d'ouverture", () => {
    const combat = initialCombat();
    const battle = battleOf(combat);
    expect(battle.turn).toBe(combat.turn);
    expect(battle.map).toBe(combat.map);
    expect(battle.log).toEqual(combat.log);
  });

  it("calcule l'initiative avec exactement la formule du 1v1", () => {
    const stats = { ...NO_STATS, strength: 10 };
    const combat = withStats(initialCombat(), stats, { ...NO_STATS, strength: 5 });
    const battle = battleOf(combat);
    expect(heroOf(battle).initiative).toBe(initiativeOf(combat.player));
    expect(enemyOf(battle).initiative).toBe(initiativeOf(combat.enemy));
  });
});

describe("PONT 1v1 — ordre d'ouverture identique", () => {
  it("le héros plus rapide ouvre dans les deux moteurs", () => {
    const combat = withStats(initialCombat(), { ...NO_STATS, strength: 10 }, { ...NO_STATS, strength: 5 });
    expect(openingPhase(combat)).toBe("player_turn");
    expect(battleOf(combat).order[0]).toBe(PLAYER_BATTLE_ID);
  });

  it("le monstre strictement plus rapide ouvre dans les deux moteurs", () => {
    const combat = withStats(initialCombat(), NO_STATS, { ...NO_STATS, strength: 15 });
    expect(openingPhase(combat)).toBe("enemy_turn");
    expect(battleOf(combat).order[0]).toBe("piou_mazoute");
  });

  it("à initiative égale, le héros ouvre : 0_player trie avant piou_mazoute", () => {
    const stats = { ...NO_STATS, strength: 10 };
    const combat = withStats(initialCombat(), stats, stats);
    const battle = battleOf(combat);
    expect(openingPhase(combat)).toBe("player_turn");
    expect(battle.order).toEqual([PLAYER_BATTLE_ID, "piou_mazoute"]);
  });

  it("garde-fou : avec l'id player, l'égalité placerait le monstre devant", () => {
    const stats = { ...NO_STATS, strength: 10 };
    const battle = battleOf(withStats(initialCombat(), stats, stats));
    const hero = { ...heroOf(battle), id: "player" };
    expect(buildTimeline([hero, enemyOf(battle)]).order).toEqual(["piou_mazoute", "player"]);
  });
});

describe("PONT 1v1 — dégâts identiques", () => {
  it("un même sort donne les mêmes dégâts, les mêmes PV et le même coût en PA", () => {
    const combat = initialCombat(["P.M."]);
    const viaLoop = castSpell({ state: combat, spellId: "pression", target: { x: 2, y: 0 }, rng: HIGH_ROLL });
    const battle = advanceTurn(battleOf(combat));
    const attack = pressionAttack();
    const input = { state: battle, attackerId: PLAYER_BATTLE_ID, targetId: "piou_mazoute", attack, rng: HIGH_ROLL };
    const viaBattle = resolveAttack(input);
    expect(viaLoop.enemy.hp).toBe(23);
    expect(enemyOf(viaBattle).hp).toBe(viaLoop.enemy.hp);
    expect(heroOf(viaBattle).ap).toBe(3);
    expect(heroOf(viaBattle).ap).toBe(viaLoop.player.ap);
  });
});

describe("DIFFÉRENCE VOULUE (DEC-12) — le tacle existe dans le moteur unique", () => {
  /** Héros 2 000 000 de Force (donc actif) mais 0 Agilité : tacle certain. */
  function tackledSetup(): { combat: CombatState; monster: MonsterDef } {
    const base = initialCombat(["PM...", ".....", "....."]);
    const stats = { ...PIOU().stats, agility: 1_000_000 };
    const player = { ...base.player, stats: { ...NO_STATS, strength: 2_000_000 } };
    const enemy = { ...base.enemy, stats };
    return { combat: { ...base, player, enemy }, monster: { ...PIOU(), stats } };
  }

  it("le 1v1 avance 2 cases ; le pont s'arrête au contact et perd 1 PM", () => {
    const { combat, monster } = tackledSetup();
    const viaLoop = moveActiveEntity(combat, { x: 0, y: 2 });
    const battle = battleOf(combat, monster);
    const viaBattle = moveHero({ state: battle, to: { x: 0, y: 2 }, rng: () => 0 });
    expect(viaLoop.player.position).toEqual({ x: 0, y: 2 });
    expect(viaLoop.player.mp).toBe(1);
    expect(heroOf(viaBattle).position).toEqual({ x: 0, y: 0 });
    expect(heroOf(viaBattle).mp).toBe(2);
  });
});

describe("DIFFÉRENCE VOULUE (DEC-12) — le coup critique peut se déclencher", () => {
  it("un critique garanti ajoute critDamagePct ; le 1v1 ne le calcule pas", () => {
    const combat = initialCombat(["P.M."]);
    const viaLoop = castSpell({ state: combat, spellId: "pression", target: { x: 2, y: 0 }, rng: HIGH_ROLL });
    const battle = advanceTurn(battleOf(combat));
    const attack = { ...pressionAttack(), baseCrit: 100, critDamagePct: 50 };
    const input = { state: battle, attackerId: PLAYER_BATTLE_ID, targetId: "piou_mazoute", attack, rng: HIGH_ROLL };
    const viaBattle = resolveAttack(input);
    expect(viaLoop.enemy.hp).toBe(23);
    expect(enemyOf(viaBattle).hp).toBe(17);
  });
});
