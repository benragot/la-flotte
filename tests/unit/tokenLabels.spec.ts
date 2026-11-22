import { describe, expect, it } from "vitest";
import { TILE_H, TILE_W, sceneOrigin } from "../../src/renderer/gridProjection";
import { LABEL_BADGE_GAP, LABEL_EDGE_PADDING, labelsFor, viewportBounds } from "../../src/renderer/labels";
import { BADGE_RADIUS, hpBarFor, groupTokenView } from "../../src/renderer/tokens";

/**
 * Capture regardée : le badge de niveau restait posé sur le corps du crabe.
 * Première correction : déplacé à droite du nom. Défaut QA : il était calculé
 * depuis l'x **brut** du nom, alors que le nom affiché est borné par
 * `clampLabelX` ; au bord droit il sortait du canvas, au bord gauche il tombait
 * sur les lettres. `labelsFor(token, bounds)` borne désormais les deux ensemble.
 */
const MAP = { width: 12, height: 12 };
const VIEWPORT = { width: 1024, height: 570 };
const ORIGIN = sceneOrigin(MAP, VIEWPORT);
const BOUNDS = viewportBounds({ minX: -46, maxX: 1070, minY: -20, maxY: 590 }, VIEWPORT);
const CRAB = "Crabe à Clé-à-Molette";
const NAME_WIDTH = 170;

function crabAt(pos: { x: number; y: number }) {
  return groupTokenView({ pos, totalLevel: 3, name: CRAB }, ORIGIN);
}

function labelsOf(token: ReturnType<typeof crabAt>) {
  return labelsFor({ token, bounds: BOUNDS, nameWidth: NAME_WIDTH });
}

function nameOf(labels: ReturnType<typeof labelsOf>) {
  const label = labels.find((entry) => entry.kind === "name");
  if (label === undefined) throw new Error("étiquette du nom absente");
  return label;
}

function badgeOf(labels: ReturnType<typeof labelsOf>) {
  const label = labels.find((entry) => entry.kind === "badge");
  if (label === undefined) throw new Error("étiquette du badge absente");
  return label;
}

function insideTokenCell(token: ReturnType<typeof crabAt>, label: { x: number; y: number }): boolean {
  const dx = Math.abs(label.x - token.center.x);
  const dy = Math.abs(label.y - token.center.y);
  return dx <= (TILE_W / 2) * token.scale && dy <= (TILE_H / 2) * token.scale;
}

describe("étiquettes d'un jeton — complètes et hors du sprite", () => {
  it("expose le nom et le badge avec leur position, aucun ancré dans le losange du jeton", () => {
    [crabAt({ x: 5, y: 5 }), crabAt({ x: 11, y: 0 })].forEach((token) => {
      const labels = labelsOf(token);
      expect(labels.map((label) => label.text)).toEqual([CRAB, "3"]);
      labels.forEach((label) => expect(insideTokenCell(token, label)).toBe(false));
    });
  });

  it("place le badge à droite du nom, dans la bande au-dessus de la barre", () => {
    const token = crabAt({ x: 5, y: 5 });
    const name = nameOf(labelsOf(token));
    const badge = badgeOf(labelsOf(token));
    expect(badge.x).toBeGreaterThan(name.x);
    expect(badge.y).toBeLessThan(hpBarFor(token).y);
  });

  it("n'écrit jamais une ellipse de troncature dans un label", () => {
    labelsOf(crabAt({ x: 11, y: 0 })).forEach((label) => {
      expect(label.text).not.toContain("..");
    });
  });
});

describe("labelsFor — badge borné dans le viewport", () => {
  it("garde le badge dans le viewport au bord droit", () => {
    const token = crabAt({ x: 11, y: 0 });
    const labels = labelsOf(token);
    const name = nameOf(labels);
    const badge = badgeOf(labels);
    expect(name.x).toBeCloseTo(BOUNDS.maxX - NAME_WIDTH / 2 - LABEL_EDGE_PADDING - 2 * BADGE_RADIUS * token.scale - LABEL_BADGE_GAP * token.scale);
    expect(badge.x + BADGE_RADIUS * token.scale).toBeLessThanOrEqual(BOUNDS.maxX - LABEL_EDGE_PADDING + 1e-6);
  });

  it("garde le badge dans le viewport au bord gauche", () => {
    const token = crabAt({ x: 0, y: 11 });
    const labels = labelsOf(token);
    const name = nameOf(labels);
    const badge = badgeOf(labels);
    expect(name.x).toBeCloseTo(BOUNDS.minX + NAME_WIDTH / 2 + LABEL_EDGE_PADDING);
    expect(badge.x - BADGE_RADIUS * token.scale).toBeGreaterThanOrEqual(BOUNDS.minX + LABEL_EDGE_PADDING - 1e-6);
  });

  it("borne les étiquettes au viewport, pas à l'encre de la carte", () => {
    const clipped = viewportBounds({ minX: -46, maxX: 1070, minY: -20, maxY: 590 }, VIEWPORT);
    expect(clipped).toEqual({ minX: 0, maxX: 1024, minY: 0, maxY: 570 });
  });
});

describe("labelsFor — écart constant, jamais sur le nom", () => {
  it("garde un écart constant nom ↔ badge, clampé ou non", () => {
    [{ x: 5, y: 5 }, { x: 11, y: 0 }, { x: 0, y: 11 }].forEach((pos) => {
      const token = crabAt(pos);
      const name = nameOf(labelsOf(token));
      const badge = badgeOf(labelsOf(token));
      expect(badge.x - (name.x + NAME_WIDTH / 2)).toBeCloseTo((LABEL_BADGE_GAP + BADGE_RADIUS) * token.scale);
    });
  });

  it("ne pose jamais le badge sur l'encre du nom au bord gauche", () => {
    const token = crabAt({ x: 0, y: 11 });
    const name = nameOf(labelsOf(token));
    const badge = badgeOf(labelsOf(token));
    expect(badge.x - BADGE_RADIUS * token.scale).toBeGreaterThan(name.x + NAME_WIDTH / 2);
  });
});
