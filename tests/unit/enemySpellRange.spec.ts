import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runEnemyTurn } from "../../src/engine/combatLoop/enemy";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState, Rng } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import type { Position } from "../../src/engine/grid";
import { parseAsciiMap } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));

const ZERO: Rng = () => 0;
/** Écrou-Baton : `spellIds = [contact 1 case, Lancer d'Écrou 2–4 cases]`. */
const BOULON = "fer_boulon_pousseur";
/** Piou Mazouté : deux sorts de contact seulement. */
const PIOU = "piou_mazoute";

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

const distance = (a: Position, b: Position) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Combat 1v1 sur carte ASCII, phase ennemie (l'IA joue son tour entier). */
function enemyTurn(rows: readonly string[], monsterId: string): CombatState {
  const init = initCombat({
    map: parseAsciiMap([...rows]),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, monsterId),
    spells,
  });
  return { ...init, phase: "enemy_turn" };
}

const journal = (state: CombatState) => state.log.join("\n");

describe("runEnemyTurn — COMBAT-08 : le sort choisi doit porter", () => {
  it("tire Lancer d'Écrou à 3 cases au lieu de venir coller au héros", () => {
    const state = enemyTurn(["P..M.", "....."], BOULON);
    const next = runEnemyTurn(state, ZERO);
    expect(journal(next)).toContain("Lancer d'Écrou");
    expect(journal(next)).not.toContain("Coup de Tête Fileté");
    expect(next.player.hp).toBeLessThan(state.player.hp);
    expect(next.enemy.position).toEqual(state.enemy.position);
  });

  it("garde le sort de contact quand la cible est adjacente", () => {
    const state = enemyTurn(["PM#", "..."], BOULON);
    const next = runEnemyTurn(state, ZERO);
    expect(journal(next)).toContain("Coup de Tête Fileté");
    expect(journal(next)).not.toContain("Lancer d'Écrou");
    expect(next.player.hp).toBeLessThan(state.player.hp);
    expect(next.enemy.position).toEqual(state.enemy.position);
  });

  it("se rapproche quand aucun sort ne porte", () => {
    const state = enemyTurn(["P.........M.", "............"], BOULON);
    const next = runEnemyTurn(state, ZERO);
    expect(next.player.hp).toBe(state.player.hp);
    expect(distance(next.enemy.position, next.player.position)).toBeLessThan(
      distance(state.enemy.position, state.player.position),
    );
  });

  it("conserve le rapprochement quand le contact est le seul sort", () => {
    const state = enemyTurn(["P......M.", "........."], PIOU);
    const next = runEnemyTurn(state, ZERO);
    expect(next.player.hp).toBe(state.player.hp);
    expect(distance(next.enemy.position, next.player.position)).toBeLessThan(
      distance(state.enemy.position, state.player.position),
    );
  });
});
