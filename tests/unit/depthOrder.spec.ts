import { describe, expect, it } from "vitest";
import { compareDepth, depthOf, depthOrder } from "../../src/renderer/depthOrder";

interface Item {
  id: string;
  depth: number;
  order: number;
}

function item(id: string, depth: number, order: number): Item {
  return { id, depth, order };
}

function ids(items: readonly Item[]): string[] {
  return depthOrder(items).map((entry) => entry.id);
}

/**
 * Convention constatée : `depthOf` (`x + y`) trie les tuiles, les acteurs et le
 * décor (`src/renderer/scene.ts`, `src/renderer/sprites/actorStage.ts`). Le rang
 * `order` départage deux objets de même profondeur : le décor est posé avant
 * l'acteur, donc l'acteur reste visible sur la case du décor.
 */
describe("depthOrder — un seul axe peintre pour les acteurs et le décor", () => {
  it("peint d'abord la profondeur la plus faible : le décor derrière passe avant l'acteur", () => {
    expect(ids([item("actor", 3, 2), item("decor", 9, 0)])).toEqual(["actor", "decor"]);
  });

  it("peint après l'acteur un décor plus profond : un baril devant le masque", () => {
    expect(ids([item("decor", 14, 0), item("actor", 5, 1)])).toEqual(["actor", "decor"]);
  });

  it("départage une égalité d'axe par le rang de pose : décor puis acteur sur la même case", () => {
    expect(ids([item("actor", 7, 1), item("decor", 7, 0)])).toEqual(["decor", "actor"]);
  });

  it("garde l'ordre d'entrée quand profondeur et rang sont identiques", () => {
    expect(ids([item("a", 4, 0), item("b", 4, 0)])).toEqual(["a", "b"]);
  });

  it("ne crée aucun axe vertical : une case en relief garde la profondeur `x + y`", () => {
    const wall = { x: 4, y: 2 };
    expect(depthOf(wall)).toBe(6);
    expect(compareDepth(item("wall", depthOf(wall), 0), item("actor", 6, 1))).toBeLessThan(0);
  });
});
