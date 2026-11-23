import { describe, expect, it } from "vitest";
import { sceneOrigin } from "../../src/renderer/gridProjection";
import {
  LABEL_BADGE_GAP,
  LABEL_EDGE_PADDING,
  clampLabelY,
  hoverBarInBounds,
  labelsFor,
  nameLabelFor,
  viewportBounds,
} from "../../src/renderer/labels";
import { BADGE_RADIUS, groupTokenView, hpBarFor } from "../../src/renderer/tokens";

/**
 * Dette `D98` : `viewportBounds` calcule `minY`/`maxY` que **personne ne
 * lisait** — le clamp des étiquettes était x-only (`clampLabelX`) et la pose
 * (`text.position.set(name.x, name.y)`) non bornée. Un jeton sur la case du
 * sommet iso posait donc son nom, son badge et sa barre **hors du canvas**.
 *
 * Décision : on borne le **haut de l'encre**, puis on reconstruit l'ancre par la
 * hauteur du texte (`anchorY` : 1 pour le nom — `anchor.set(0.5, 1)` —, 0.5 pour
 * le badge, 0 pour la barre). Borner l'ancre seule laisserait déborder d'autant
 * de pixels que le texte est haut.
 */
const MAP = { width: 12, height: 12 };
/** Arène réelle ×1,45 (`pointerPicking.spec.ts`, `ui-dofus-retro.md` §12.1). */
const VIEWPORT = { width: 1024, height: 570 };
const ORIGIN = sceneOrigin(MAP, VIEWPORT);
const SHORT_INK = { minX: -46, maxX: 1070, minY: -20, maxY: 590 };
const BOUNDS = viewportBounds(SHORT_INK, VIEWPORT);
const SHORT = viewportBounds(SHORT_INK, { width: 1024, height: 400 });
const CRAB = "Crabe à Clé-à-Molette";
const NAME_WIDTH = 170;
/** Hauteur mesurée par Pixi (`text.height`) au zoom ×1,45. */
const NAME_HEIGHT = 16;

function crabAt(pos: { x: number; y: number }) {
  return groupTokenView({ pos, totalLevel: 3, name: CRAB }, ORIGIN);
}

function labelsOf(token: ReturnType<typeof crabAt>) {
  return labelsFor({ token, bounds: BOUNDS, nameWidth: NAME_WIDTH, nameHeight: NAME_HEIGHT });
}

function nameOf(labels: ReturnType<typeof labelsOf>) {
  const label = labels.find((entry) => entry.kind === "name");
  if (label === undefined) throw new Error("étiquette du nom absente");
  return label;
}

describe("clampLabelY — la borne verticale lit enfin minY/maxY", () => {
  it("borne le haut de l'encre, puis reconstruit l'ancre par la hauteur", () => {
    expect(clampLabelY({ y: -80, height: 16, bounds: BOUNDS, anchorY: 1 })).toBe(LABEL_EDGE_PADDING + 16);
    expect(clampLabelY({ y: 900, height: 16, bounds: BOUNDS, anchorY: 1 })).toBe(BOUNDS.maxY - LABEL_EDGE_PADDING);
  });

  it("laisse intact un point déjà dans les bornes", () => {
    expect(clampLabelY({ y: 300, height: 16, bounds: BOUNDS, anchorY: 1 })).toBe(300);
  });

  it("centre l'encre quand les bornes sont plus courtes qu'elle", () => {
    const tight = { minX: 0, maxX: 100, minY: 100, maxY: 110 };
    expect(clampLabelY({ y: 400, height: 40, bounds: tight, anchorY: 0.5 })).toBe(105);
  });
});

describe("nom d'un jeton — borné en y comme en x", () => {
  it("ramène le nom du sommet iso sous le bord haut du canvas", () => {
    const token = crabAt({ x: 0, y: 0 });
    const raw = nameLabelFor(token);
    expect(raw?.y).toBeLessThan(BOUNDS.minY);
    const name = nameOf(labelsOf(token));
    expect(name.y).toBe(BOUNDS.minY + LABEL_EDGE_PADDING + NAME_HEIGHT);
  });

  it("ne déplace pas le nom d'un jeton au centre de la carte", () => {
    const token = crabAt({ x: 6, y: 6 });
    const raw = nameLabelFor(token);
    expect(nameOf(labelsOf(token)).y).toBe(raw?.y);
    expect(nameOf(labelsOf(token)).y).toBeGreaterThan(BOUNDS.minY + LABEL_EDGE_PADDING);
    expect(nameOf(labelsOf(token)).y).toBeLessThan(BOUNDS.maxY - NAME_HEIGHT - LABEL_EDGE_PADDING);
  });

  it("ramène le nom d'un jeton sous la ligne basse quand elle est plus courte que l'encre", () => {
    const token = crabAt({ x: 11, y: 11 });
    const raw = nameLabelFor(token);
    expect(raw?.y).toBeGreaterThan(SHORT.maxY);
    const name = nameOf(labelsFor({ token, bounds: SHORT, nameWidth: NAME_WIDTH, nameHeight: NAME_HEIGHT }));
    expect(name.y).toBe(SHORT.maxY - LABEL_EDGE_PADDING);
  });
});

describe("badge d'un jeton — borné par sa propre encre ronde", () => {
  it("garde le badge entier dans le canvas, sous le bord haut", () => {
    const token = crabAt({ x: 0, y: 0 });
    const radius = BADGE_RADIUS * token.scale;
    const badge = labelsOf(token).find((entry) => entry.kind === "badge");
    expect(badge?.y).toBe(BOUNDS.minY + LABEL_EDGE_PADDING + radius);
    expect((badge?.y ?? 0) - radius).toBeGreaterThanOrEqual(BOUNDS.minY + LABEL_EDGE_PADDING);
  });

  it("garde l'écart nom ↔ badge constant après le clamp vertical", () => {
    const token = crabAt({ x: 0, y: 0 });
    const labels = labelsOf(token);
    const name = nameOf(labels);
    const badge = labels.find((entry) => entry.kind === "badge");
    expect((badge?.x ?? 0) - (name.x + NAME_WIDTH / 2)).toBeCloseTo((LABEL_BADGE_GAP + BADGE_RADIUS) * token.scale, 6);
  });
});

describe("barre de vie de survol — bornée comme les étiquettes", () => {
  it("pose la barre du sommet iso entièrement sous le bord haut", () => {
    const token = crabAt({ x: 0, y: 0 });
    expect(hpBarFor(token).y).toBeLessThan(BOUNDS.minY);
    const bar = hoverBarInBounds(token, BOUNDS);
    expect(bar.y).toBe(BOUNDS.minY + LABEL_EDGE_PADDING);
    expect(bar.y + bar.height).toBeLessThanOrEqual(BOUNDS.maxY - LABEL_EDGE_PADDING);
  });

  it("ne déplace pas la barre d'un jeton au centre de la carte", () => {
    const token = crabAt({ x: 6, y: 6 });
    expect(hoverBarInBounds(token, BOUNDS).y).toBe(hpBarFor(token).y);
  });

  it("borne la barre par la ligne basse (maxY)", () => {
    const bar = hoverBarInBounds(crabAt({ x: 11, y: 11 }), SHORT);
    expect(bar.y).toBe(SHORT.maxY - LABEL_EDGE_PADDING - bar.height);
  });
});
