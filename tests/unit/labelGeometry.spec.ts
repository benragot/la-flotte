import { describe, expect, it } from "vitest";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";
import { TILE_H } from "../../src/renderer/gridProjection";
import { NAME_LIFT_TILES, clampLabelX, nameLabelFor } from "../../src/renderer/labels";
import { hpBarFor } from "../../src/renderer/tokens";

/**
 * Décision du propriétaire (`ui-dofus-retro.md` §1 et §5) : le nom vit
 * **au-dessus de la tête**, à `-2.2 × TILE_H` du centre bas du losange, en
 * `#E8DCC8` à 11 px. L'ancien ancrage « 4 px au-dessus de la barre de vie »
 * est périmé : la barre garde sa géométrie, le nom ne la suit plus.
 */
const VIEWPORT = { width: 1024, height: 768 };
const LABEL = "Crabe à Clé-à-Molette · Niv. 3";
const BOUNDS = { minX: 100, maxX: 300, minY: 0, maxY: 200 };

function groupToken(extra: { spriteId?: string } = {}) {
  const exploration = {
    playerPos: { x: 1, y: 1 },
    groups: [{ pos: { x: 3, y: 4 }, label: LABEL, totalLevel: 3, ...extra }],
  };
  const token = buildExplorationViewModel({ exploration, viewport: VIEWPORT }).tokens[1];
  if (token === undefined) throw new Error("jeton du groupe absent");
  return token;
}

describe("étiquette du nom — au-dessus de la tête, à 2,2 tuiles", () => {
  it("pose le bas du nom à -2.2 × TILE_H du centre, donc au-dessus de la barre", () => {
    [groupToken(), groupToken({ spriteId: "fer_crabe_cle_molette" })].forEach((token) => {
      const label = nameLabelFor(token);
      const bar = hpBarFor(token);
      expect(label).not.toBeNull();
      expect(label?.y).toBeCloseTo(token.center.y - TILE_H * NAME_LIFT_TILES * token.scale, 6);
      expect(label?.y).toBeLessThan(bar.y);
    });
  });

  it("affiche le nom complet dans l'étiquette", () => {
    expect(nameLabelFor(groupToken())?.text).toBe("Crabe à Clé-à-Molette");
  });
});

describe("étiquette du nom — jamais hors de la carte", () => {
  it("ramène le centre du texte dans les bords", () => {
    expect(clampLabelX({ x: 90, halfWidth: 40, bounds: BOUNDS })).toBe(144);
    expect(clampLabelX({ x: 310, halfWidth: 40, bounds: BOUNDS })).toBe(256);
    expect(clampLabelX({ x: 200, halfWidth: 40, bounds: BOUNDS })).toBe(200);
  });

  it("réserve la place du badge à droite du nom au bord de la carte", () => {
    expect(clampLabelX({ x: 310, halfWidth: 40, bounds: BOUNDS, rightReserve: 22 })).toBe(234);
  });

  it("centre le texte quand la carte est plus étroite que lui", () => {
    expect(clampLabelX({ x: 120, halfWidth: 150, bounds: BOUNDS })).toBe(200);
  });
});
