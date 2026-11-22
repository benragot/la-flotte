import { describe, expect, it } from "vitest";
import type { PixelPoint } from "../../src/renderer/gridProjection";
import {
  WALK_MS_PER_CELL,
  interpolatedCell,
  pathAt,
  sampleWalk,
  startWalk,
  stepProgress,
  walkDuration,
  walkPlan,
} from "../../src/renderer/sprites/walkMotion";

/**
 * Le glissement est purement **visuel** : la position logique change en une
 * frame, seule la position peinte avance. Tout ce qui décide du trajet est donc
 * isolé ici, en fonctions pures, sans PixiJS ni horloge implicite.
 */
const A: PixelPoint = { x: 0, y: 0 };
const B: PixelPoint = { x: 64, y: 32 };
const C: PixelPoint = { x: 128, y: 0 };

function plan(points: readonly PixelPoint[]) {
  const built = walkPlan(points);
  if (built === null) throw new Error("plan attendu");
  return built;
}

describe("stepProgress — progression bornée", () => {
  it("vaut 0 au départ, 0.5 à la moitié, 1 à l'arrivée", () => {
    expect(stepProgress(0, 300)).toBe(0);
    expect(stepProgress(150, 300)).toBe(0.5);
    expect(stepProgress(300, 300)).toBe(1);
  });

  it("borne la progression : jamais négative, jamais au-delà de 1", () => {
    expect(stepProgress(-50, 300)).toBe(0);
    expect(stepProgress(900, 300)).toBe(1);
  });

  it("une durée nulle est déjà une arrivée", () => {
    expect(stepProgress(0, 0)).toBe(1);
  });
});

describe("interpolatedCell — interpolation en pixels monde", () => {
  it("donne le départ à 0, le milieu exact à 0.5, l'arrivée à 1", () => {
    expect(interpolatedCell(A, B, 0)).toEqual(A);
    expect(interpolatedCell(A, B, 0.5)).toEqual({ x: 32, y: 16 });
    expect(interpolatedCell(A, B, 1)).toEqual(B);
  });
});

describe("walkPlan — une case = une durée nommée", () => {
  it("facture une durée par case et refuse un trajet d'une seule case", () => {
    expect(walkDuration(3)).toBe(3 * WALK_MS_PER_CELL);
    expect(walkPlan([A])).toBeNull();
    expect(plan([A, B]).durationMs).toBe(WALK_MS_PER_CELL);
  });
});

describe("pathAt — le trajet suit le chemin, case par case", () => {
  /** Trajet en L : (0,0) → (64,0) → (64,32). */
  const CORNER: PixelPoint = { x: 64, y: 0 };
  const END: PixelPoint = { x: 64, y: 32 };
  const TRAIL = plan([A, CORNER, END]);

  it("commence sur la première case et finit sur la dernière", () => {
    expect(pathAt(TRAIL, 0).point).toEqual(A);
    expect(pathAt(TRAIL, TRAIL.durationMs).point).toEqual(END);
    expect(pathAt(TRAIL, TRAIL.durationMs * 10).point).toEqual(END);
  });

  it("au milieu du trajet, il est exactement sur la case intermédiaire", () => {
    const sample = pathAt(TRAIL, TRAIL.durationMs / 2);
    expect(sample.point).toEqual(CORNER);
    expect(sample.segment).toBe(1);
    expect(sample.done).toBe(false);
  });

  it("ne coupe jamais à travers un mur : pas de ligne droite entre départ et arrivée", () => {
    /** Si le rendu reliait A directement à END, `y` bougerait dès 25 %. */
    const quarter = pathAt(TRAIL, TRAIL.durationMs / 4);
    expect(quarter.point.y).toBe(A.y);
    expect(quarter.point.x).toBeCloseTo(CORNER.x / 2, 6);
  });

  it("chaque échantillon reste sur un segment du chemin, jamais à côté", () => {
    const samples = Array.from({ length: 21 }, (_, step) => pathAt(TRAIL, step * 15));
    samples.forEach((sample) => {
      const expected = interpolatedCell(TRAIL.points[sample.segment]!, TRAIL.points[sample.segment + 1]!, sample.t);
      expect(sample.point).toEqual(expected);
    });
  });
});

describe("startWalk — un nouvel état remplace l'ancien, sans segment résiduel", () => {
  it("repart de la première case du nouveau chemin", () => {
    const replaced = startWalk(plan([A, B, C]), 500);
    const sample = sampleWalk(replaced, 500);
    expect(sample.point).toEqual(A);
    expect(sample.segment).toBe(0);
    expect(sample.done).toBe(false);
  });

  it("oublie complètement le trajet précédent", () => {
    const stale = startWalk(plan([A, B, C]), 0);
    expect(sampleWalk(stale, 300).done).toBe(true);
    const fresh = startWalk(plan([B, C]), 900);
    expect(sampleWalk(fresh, 900 + WALK_MS_PER_CELL - 1).done).toBe(false);
    expect(sampleWalk(fresh, 900 + WALK_MS_PER_CELL).done).toBe(true);
  });

  it("ne dépend pas de l'ancien état : deux démarrages identiques donnent le même échantillon", () => {
    const first = startWalk(plan([A, B]), 100);
    const second = startWalk(plan([A, B]), 100);
    expect(sampleWalk(first, 175)).toEqual(sampleWalk(second, 175));
  });
});
