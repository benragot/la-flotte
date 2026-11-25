import { describe, expect, it } from "vitest";
import type { Position } from "../../src/engine/grid";
import type { GridSize } from "../../src/renderer/gridProjection";
import { gridToIso, originScale, sceneOrigin } from "../../src/renderer/gridProjection";
import type { BoardLayout } from "../../src/renderer/pointer";
import { cellAtTap, cellFromPointer } from "../../src/renderer/pointer";
import { SPRITE_ANCHOR } from "../../src/renderer/sprites/anchor";
import type { ScreenPoint, TokenHitTarget } from "../../src/renderer/sprites/tokenHit";
import { pickToken, tokenHitBox } from "../../src/renderer/sprites/tokenHit";

/**
 * INPUT-01 — le clic était résolu par la case sous le curseur, jamais par le
 * sprite. Or un jeton est peint **au-dessus** de sa case : ancre aux pieds
 * (`sprites/EntitySprite.ts:9`), frame de 64 px affichés (`sprites/frameMath.ts:11`),
 * donc la tête monte à 0,85 × 64 px au-dessus du centre du losange — plus de
 * trois demi-tuiles de haut (`gridProjection.ts:6`). Cliquer la tête tombait sur
 * la case derrière.
 *
 * Ces tests figent la géométrie réelle (boîte du corps, ancre) et l'ordre de
 * résolution (jeton d'abord, case ensuite). Aucun PixiJS : la fonction pure ne
 * reçoit que des points et des rectangles.
 */
const MAP: GridSize = { width: 12, height: 12 };
/** Les deux échelles réellement mesurées en jeu : ×1,45 et ×2,19 (#68). */
const VIEWPORTS: readonly GridSize[] = [
  { width: 1024, height: 570 },
  { width: 1664, height: 840 },
];
const MONSTER: Position = { x: 5, y: 5 };
/** Écart vertical du clic sur la tête, en px à l'échelle 1 : sous le sommet de la frame. */
const HEAD_LIFT = 40;

function layoutOf(viewport: GridSize): BoardLayout {
  return { ...MAP, origin: sceneOrigin(MAP, viewport) };
}

function targetOf(id: string, cell: Position, viewport: GridSize): TokenHitTarget {
  const origin = sceneOrigin(MAP, viewport);
  return { id, cell, center: gridToIso({ ...cell, origin }), scale: originScale(origin), depth: cell.x + cell.y };
}

function lifted(point: ScreenPoint, px: number, scale: number): ScreenPoint {
  return { x: point.x, y: point.y - px * scale };
}

/** Boîte de test hors carte : centre et profondeur choisis à la main. */
function flatTarget(id: string, x: number, y: number, depth: number): TokenHitTarget {
  return { id, cell: { x: 0, y: 0 }, center: { x, y }, scale: 1, depth };
}

/** Point au milieu du recouvrement de deux boîtes : les deux contiennent le clic. */
function overlapPoint(a: TokenHitTarget, b: TokenHitTarget): ScreenPoint {
  const first = tokenHitBox(a);
  const second = tokenHitBox(b);
  const left = Math.max(first.left, second.left);
  const right = Math.min(first.right, second.right);
  const top = Math.max(first.top, second.top);
  const bottom = Math.min(first.bottom, second.bottom);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

describe("géométrie de visée — la boîte du sprite, pas la case", () => {
  it("garde l'ancre aux pieds : 0,5 / 0,85 du centre du losange", () => {
    expect(SPRITE_ANCHOR).toEqual({ x: 0.5, y: 0.85 });
  });

  it("s'étend de la tête aux pieds, sur 70 % de la largeur de frame", () => {
    const box = tokenHitBox(flatTarget("t", 400, 300, 0));
    expect(box.top).toBeCloseTo(300 - 64 * 0.85);
    expect(box.bottom).toBeCloseTo(300 + 64 * 0.15);
    expect(box.right - box.left).toBeCloseTo(64 * 0.7);
    expect((box.left + box.right) / 2).toBeCloseTo(400);
  });
});

describe("géométrie de visée — une scène réelle, aux deux zooms du jeu", () => {
  it("vise le jeton quand on clique sur sa tête, pas la case derrière", () => {
    VIEWPORTS.forEach((viewport) => {
      const monster = targetOf("piou", MONSTER, viewport);
      const head = lifted(monster.center, HEAD_LIFT, monster.scale);
      expect(pickToken(head, [monster])?.id).toBe("piou");
      // La grille seule se trompe encore : c'est exactement le bogue INPUT-01.
      expect(cellFromPointer(head, layoutOf(viewport))).not.toEqual(MONSTER);
    });
  });

  it("laisse les quatre cases orthogonales cliquables : aucun jeton volé", () => {
    const deltas = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];
    VIEWPORTS.forEach((viewport) => {
      const monster = targetOf("piou", MONSTER, viewport);
      const origin = sceneOrigin(MAP, viewport);
      deltas.forEach((delta) => {
        const cell = { x: MONSTER.x + delta.x, y: MONSTER.y + delta.y };
        expect(pickToken(gridToIso({ ...cell, origin }), [monster])).toBeNull();
      });
    });
  });

  it("capte la case derrière, peinte sous le corps : c'est la tête du monstre", () => {
    VIEWPORTS.forEach((viewport) => {
      const monster = targetOf("piou", MONSTER, viewport);
      const behind = gridToIso({ x: MONSTER.x - 1, y: MONSTER.y - 1, origin: sceneOrigin(MAP, viewport) });
      expect(pickToken(behind, [monster])?.id).toBe("piou");
    });
  });
});

describe("classement des candidats — le plus proche, puis le plus devant", () => {
  it("pile sur un jeton rend ce jeton", () => {
    const monster = targetOf("piou", MONSTER, VIEWPORTS[0] ?? MAP);
    expect(pickToken(monster.center, [monster])?.cell).toEqual(MONSTER);
  });

  it("entre deux jetons, la boîte sous le curseur l'emporte sur la plus avancée", () => {
    VIEWPORTS.forEach((viewport) => {
      const back = targetOf("back", MONSTER, viewport);
      const front = targetOf("front", { x: MONSTER.x + 1, y: MONSTER.y }, viewport);
      const head = lifted(back.center, HEAD_LIFT, back.scale);
      expect(pickToken(head, [back, front])?.id).toBe("back");
      expect(pickToken(head, [front, back])?.id).toBe("back");
    });
  });

  it("hors de toute boîte rend null", () => {
    const monster = targetOf("piou", MONSTER, VIEWPORTS[0] ?? MAP);
    expect(pickToken({ x: -500, y: -500 }, [monster])).toBeNull();
    expect(pickToken(monster.center, [])).toBeNull();
  });

  it("deux boîtes chevauchées : la plus devant gagne, quel que soit l'ordre", () => {
    VIEWPORTS.forEach((viewport) => {
      const back = targetOf("back", MONSTER, viewport);
      const front = targetOf("front", { x: MONSTER.x + 1, y: MONSTER.y }, viewport);
      const point = overlapPoint(back, front);
      expect(pickToken(point, [back, front])?.id).toBe("front");
      expect(pickToken(point, [front, back])?.id).toBe("front");
    });
  });

  it("deux jetons superposés : départage par identifiant, déterministe", () => {
    const alpha = flatTarget("alpha", 300, 200, 4);
    const beta = flatTarget("beta", 300, 200, 4);
    expect(pickToken(alpha.center, [beta, alpha])?.id).toBe("alpha");
    expect(pickToken(alpha.center, [alpha, beta])?.id).toBe("alpha");
  });
});

describe("pointeur — le jeton passe avant la conversion de case", () => {
  it("cellAtTap demande d'abord le picker de jetons", () => {
    const layout = layoutOf(VIEWPORTS[0] ?? MAP);
    const point = { x: 500, y: 300 };
    expect(cellAtTap({ point, layout, pick: () => MONSTER })).toEqual(MONSTER);
  });

  it("sans jeton touché, retombe exactement sur la case sous le pointeur", () => {
    const layout = layoutOf(VIEWPORTS[0] ?? MAP);
    const centre = { x: 512, y: 285 };
    expect(cellAtTap({ point: centre, layout })).toEqual(cellFromPointer(centre, layout));
    expect(cellAtTap({ point: centre, layout, pick: () => null })).toEqual(cellFromPointer(centre, layout));
  });

  it("rend null quand ni jeton ni case ne sont touchés", () => {
    const layout = layoutOf(VIEWPORTS[0] ?? MAP);
    expect(cellAtTap({ point: { x: -400, y: -400 }, layout })).toBeNull();
  });
});
