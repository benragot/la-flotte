import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import type { Hero } from "../../src/engine/createHero";
import { createHero } from "../../src/engine/createHero";
import { combatantFromHero, totalStatsFor } from "../../src/engine/hero";
import { buildTimeline } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { battleViewModel } from "../../src/renderer/battleViewModel";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { emptyInventory } from "../../src/store/gameSelectors";
import { useGameStore } from "../../src/store/useGameStore";
import HeroVitalsLine from "../../src/ui/components/HeroVitalsLine";
import { heroStatsView } from "../../src/ui/components/inventory/StatSummary";
import type { EffectiveHp } from "../../src/ui/hudHp";
import { effectiveHp } from "../../src/ui/hudHp";
import { buildStatLines } from "../../src/ui/inventoryHudHelpers";

/**
 * Deux domaines de PV existent : `hero.maxHp` (niveau, persisté) et le maximum
 * effectif rendu par `combatantFromHero` (niveau + objets + Vitalité). Le HUD
 * doit toujours parler du second — sinon il annonce 125 / 125 à un héros qui en
 * a 200 en combat.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const sets = parseSetsYaml(read("sets.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const IOP: ClassDef = mustFind(classes, "iop");

function heroAt(overrides: Partial<Hero>): Hero {
  return { ...createHero("Anselme", IOP), ...overrides };
}

function hpOf(hero: Hero): EffectiveHp {
  return effectiveHp({ hero, inventory: emptyInventory(), items, sets });
}

function combatantOf(hero: Hero) {
  const stats = totalStatsFor({ hero, inventory: emptyInventory(), items, sets });
  return combatantFromHero({ hero, stats, position: { x: 0, y: 0 }, spellIds: [] });
}

/** Le héros projeté tel que `battleViewModel` le lit dans une salle. */
function battlePlayerOf(hero: Hero): CombatantLike {
  const combatant = combatantOf(hero);
  return {
    id: combatant.id,
    side: "player",
    name: combatant.name,
    level: combatant.level,
    hp: combatant.hp,
    maxHp: combatant.maxHp,
    ap: combatant.ap,
    maxAp: combatant.maxAp,
    mp: combatant.mp,
    maxMp: combatant.maxMp,
    position: combatant.position,
    stats: combatant.stats,
    resistances: combatant.resistances,
    spellIds: combatant.spellIds,
    initiative: 0,
  };
}

function battleViewOf(hero: Hero) {
  const player = battlePlayerOf(hero);
  const timeline = buildTimeline([player]);
  const battle: BattleState = { turn: 1, combatants: [player], ...timeline, log: [] };
  const view = battleViewModel(battle)[0];
  if (view === undefined) throw new Error("jeton de combat absent");
  return view;
}

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe("PV du HUD — un seul domaine, celui du moteur", () => {
  it("affiche 93 / 93 pour une sauvegarde ancienne 50 / 50 avec 43 de Vitalité", () => {
    expect(hpOf(heroAt({ vitality: 43 }))).toEqual({ hp: 93, maxHp: 93 });
  });

  it("préserve le déficit : 45 / 50 avec 10 de Vitalité donne 55 / 60", () => {
    expect(hpOf(heroAt({ vitality: 10, hp: 45 }))).toEqual({ hp: 55, maxHp: 60 });
  });

  it("garde le même total pour l'inventaire, le HUD et le jeton de combat", () => {
    const hero = heroAt({ vitality: 10, hp: 45 });
    const inventory = emptyInventory();
    const block = heroStatsView({ hero, inventory, items, sets });
    const hpLine = buildStatLines(block).find((line) => line.key === "hp");
    const hudMarkup = renderToStaticMarkup(createElement(HeroVitalsLine, { hp: hpOf(hero), className: "text-xs" }));
    const view = battleViewOf(hero);
    expect(hpLine?.value).toBe(60);
    expect(hudMarkup).toContain("❤ 55 / 60");
    expect({ hp: view.hp, maxHp: view.maxHp }).toEqual(hpOf(hero));
  });

  it("n'annonce jamais le maximum de niveau quand la Vitalité l'augmente", () => {
    const hero = heroAt({ vitality: 43, hp: 50, maxHp: 50 });
    const view = battleViewOf(hero);
    expect(view.maxHp).toBe(93);
    expect(view.hp).toBe(93);
    expect(view.maxHp).not.toBe(hero.maxHp);
  });
});
