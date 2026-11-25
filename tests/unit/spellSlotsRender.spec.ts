import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { allPositions } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import { createHero } from "../../src/engine/createHero";
import { isWalkableCell, parseAsciiMap, rangeDistance, samePosition } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import SpellSlots from "../../src/ui/components/SpellSlots";

/**
 * UI-01, rendu : la case d'un sort non implémenté est désactivée **et** le dit.
 * Le store est doublé (aucun jsdom dans le dépôt) : on n'observe que le HTML.
 */
vi.mock("../../src/store/useCombatStore", () => ({
  useCombatStore: (selector: (state: { selectSpell: () => void }) => unknown) => selector({ selectSpell: () => undefined }),
}));

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const HERO = createHero("Balthazar", mustFind(classes, "iop"));
const MAP = parseAsciiMap(mustFind(maps, "ferraille_plage_01").grid);
const UPCOMING = "glyphe_agressif";
const RECHARGING = "fer_spell_coup_daile_gras";

function combatWith(overrides: Partial<CombatState> = {}): CombatState {
  const base = initCombat({ map: MAP, hero: HERO, monster: mustFind(monsters, "fer_rat_de_cale"), spells });
  const spellIds = ["pression", UPCOMING, RECHARGING];
  return { ...base, player: { ...base.player, spellIds }, ...overrides };
}

function slotMarkup(spellName: string, combat: CombatState): string {
  const html = renderToStaticMarkup(createElement(SpellSlots, { combat, selectedSpellId: null }));
  const match = new RegExp(`<button[^>]*>(?:(?!</button>).)*${spellName}(?:(?!</button>).)*</button>`, "s").exec(html);
  if (match === null) throw new Error(`case « ${spellName} » absente du rendu`);
  return match[0];
}

/** Pression est à portée 1–2 : on place le héros sur une case libre voisine. */
function inReach(base: CombatState): CombatState {
  const enemy = base.enemy.position;
  const free = (cell: { x: number; y: number }): boolean => isWalkableCell(base.map, cell) && !samePosition(cell, enemy);
  const cell = allPositions(base.map).find((candidate) => free(candidate) && rangeDistance(candidate, enemy) <= 1);
  if (cell === undefined) throw new Error("aucune case libre à portée du monstre");
  return { ...base, player: { ...base.player, position: cell, ap: 12 } };
}

describe("SpellSlots — plus de clic mort", () => {
  it("un sort `kind: other` est disabled, aria-disabled et badgé « à venir »", () => {
    const combat = combatWith();
    const html = renderToStaticMarkup(createElement(SpellSlots, { combat, selectedSpellId: null }));
    const slot = slotMarkup("Glyphe Agressif", combat);
    expect(slot).toContain("disabled");
    expect(slot).toContain('aria-disabled="true"');
    expect(slot).toContain("à venir");
    expect(slot).toContain("Effet pas encore implémenté");
    expect(html).toContain("3"); // coût PA toujours lisible
  });

  it("un sort en recharge affiche « Recharge (n) » et reste désactivé", () => {
    const base = combatWith();
    const usage = { [`${base.player.id}:${RECHARGING}`]: { casts: 1, turn: 1, readyAt: 3 } };
    const combat = { ...base, turn: 2, spellUsage: usage };
    const slot = slotMarkup("Aile Gras", combat);
    expect(slot).toContain("disabled");
    expect(slot).toContain("Recharge (1)");
  });

  it("un sort lançable reste actif, sans badge", () => {
    const slot = slotMarkup("Pression", inReach(combatWith()));
    expect(slot).not.toContain('aria-disabled="true"');
    expect(slot).not.toContain("à venir");
  });
});
