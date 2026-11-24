import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Hero } from "../../src/engine/createHero";
import { createHero } from "../../src/engine/createHero";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import { emptyInventory } from "../../src/store/gameSelectors";
import CombatHud from "../../src/ui/components/CombatHud";
import { HeroSheet } from "../../src/ui/components/OverlayPanels";

/**
 * Garde-fou de **câblage** : le helper `effectiveHp` peut rester parfait alors
 * que le composant lit encore le domaine de niveau (`hero.maxHp`). Ce test rend
 * les vrais consommateurs — dock d'exploration et fiche perso — avec un héros
 * 55 / 55 porteur de 43 Vitalité : ils doivent écrire 98 / 98, jamais 55 / 55.
 *
 * Le dépôt n'a ni jsdom ni testing-library : `renderToStaticMarkup` suffit car
 * on n'observe que le texte, pas la géométrie. Le store est doublé pour fixer
 * le héros sans dépendre de `localStorage` (absent en Node).
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const IOP: ClassDef = mustFind(classes, "iop");

const storeState = vi.hoisted(() => ({ hero: null as unknown, inventory: null as unknown }));

vi.mock("../../src/store/useGameStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/store/useGameStore")>();
  type State = { hero: unknown; inventory: unknown };
  const useGameStore = (selector: (state: State) => unknown) => selector(storeState);
  return { ...actual, useGameStore: useGameStore as unknown as typeof actual.useGameStore };
});

/** 55 / 55 persisté, 43 de Vitalité : le domaine effectif vaut 98 / 98. */
const HERO: Hero = { ...createHero("Anselme", IOP), vitality: 43 };

function markup(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

function expectEffectiveHp(html: string): void {
  expect(html).toContain("98 / 98");
  expect(html).not.toContain("55 / 55");
}

beforeEach(() => {
  storeState.hero = HERO;
  storeState.inventory = emptyInventory();
});

describe("câblage du HUD sur le domaine de PV effectif", () => {
  it("le dock d'exploration affiche 98 / 98, pas le maximum de niveau", () => {
    expectEffectiveHp(markup(createElement(CombatHud, { mode: "exploration" })));
  });

  it("la fiche perso affiche 98 / 98, pas le maximum de niveau", () => {
    expectEffectiveHp(markup(createElement(HeroSheet, { hero: HERO, onClose: () => undefined })));
  });
});
