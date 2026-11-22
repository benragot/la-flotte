import { describe, expect, it } from "vitest";
import { TILE_H, TILE_W } from "../../src/renderer/gridProjection";
import { tokenLabelsFor } from "../../src/renderer/labels";
import { groupTokenView, hpBarFor } from "../../src/renderer/tokens";

/**
 * Capture regardée : le badge de niveau restait posé sur le corps du crabe
 * (`center.x + radius`, `center.y - radius`) et son cercle passait **sous** le
 * sprite, laissant le chiffre seul sur l'art. Tous les textes d'un jeton doivent
 * vivre dans la bande haute, hors du losange de la case.
 */
const ORIGIN = { x: 512, y: 80, scale: 1 };
const CRAB = "Crabe à Clé-à-Molette";

function crabToken(extra: { spriteId?: string } = {}) {
  return groupTokenView({ pos: { x: 3, y: 4 }, totalLevel: 3, name: CRAB, ...extra }, ORIGIN);
}

function insideTokenCell(token: ReturnType<typeof crabToken>, label: { x: number; y: number }): boolean {
  const dx = Math.abs(label.x - token.center.x);
  const dy = Math.abs(label.y - token.center.y);
  return dx <= (TILE_W / 2) * token.scale && dy <= (TILE_H / 2) * token.scale;
}

describe("étiquettes d'un jeton — complètes et hors du sprite", () => {
  it("expose le nom et le badge avec leur position, aucun ancré dans le losange du jeton", () => {
    [crabToken(), crabToken({ spriteId: "fer_crabe_cle_molette" })].forEach((token) => {
      const labels = tokenLabelsFor(token, 140);
      expect(labels.map((label) => label.text)).toEqual([CRAB, "3"]);
      labels.forEach((label) => expect(insideTokenCell(token, label)).toBe(false));
    });
  });

  it("place le badge à droite du nom, dans la bande au-dessus de la barre", () => {
    const token = crabToken();
    const [name, badge] = tokenLabelsFor(token, 140);
    expect(badge?.x).toBeGreaterThan(name?.x ?? 0);
    expect(badge?.y).toBeLessThan(hpBarFor(token).y);
  });

  it("n'écrit jamais une ellipse de troncature dans un label", () => {
    tokenLabelsFor(crabToken({ spriteId: "fer_crabe_cle_molette" }), 140).forEach((label) => {
      expect(label.text).not.toContain("..");
    });
  });
});
