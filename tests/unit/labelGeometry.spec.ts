import { describe, expect, it } from "vitest";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";
import { LABEL_BAR_GAP, clampLabelX, nameLabelFor } from "../../src/renderer/labels";
import { hpBarFor } from "../../src/renderer/tokens";

/**
 * Capture regardée : le texte du nom était ancré sur la même ligne que la barre
 * de vie. La géométrie doit prouver un écart constant entre le bas du nom et le
 * haut de la barre, et un texte ramené dans la carte quand le monstre est au bord.
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

describe("étiquette du nom — au-dessus de la barre, écart constant", () => {
  it("place le bas du nom au-dessus du haut de la barre de vie", () => {
    [groupToken(), groupToken({ spriteId: "fer_crabe_cle_molette" })].forEach((token) => {
      const label = nameLabelFor(token);
      const bar = hpBarFor(token);
      expect(label).not.toBeNull();
      expect(label?.y).toBeLessThan(bar.y);
      expect(bar.y - (label?.y ?? Number.NaN)).toBe(LABEL_BAR_GAP * token.scale);
    });
  });

  it("affiche le nom complet dans l'étiquette", () => {
    expect(nameLabelFor(groupToken())?.text).toBe("Crabe à Clé-à-Molette");
  });
});

describe("étiquette du nom — jamais hors de la carte", () => {
  it("ramène le centre du texte dans les bords", () => {
    expect(clampLabelX(90, 40, BOUNDS)).toBe(140);
    expect(clampLabelX(310, 40, BOUNDS)).toBe(260);
    expect(clampLabelX(200, 40, BOUNDS)).toBe(200);
  });

  it("centre le texte quand la carte est plus étroite que lui", () => {
    expect(clampLabelX(120, 150, BOUNDS)).toBe(200);
  });
});
