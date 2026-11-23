import { describe, expect, it } from "vitest";
import { TILE_H, TILE_W } from "../../src/renderer/gridProjection";
import { LABEL_FONT_SIZE, NAME_LABEL_ALPHA, NAME_LABEL_FILL, NAME_LIFT_TILES, nameLabelFor } from "../../src/renderer/labels";
import { SCENE_LAYER_ORDER } from "../../src/renderer/sceneLayerOrder";
import type { TokenView } from "../../src/renderer/tokens";
import { ENEMY_TOKEN_COLOR, PLAYER_TOKEN_COLOR, STATIC_TOKEN_SPRITE } from "../../src/renderer/tokens";
import { ALLY_RING_COLOR, ENEMY_RING_COLOR, teamRingFor } from "../../src/renderer/teamRing";

/**
 * `ui-dofus-retro.md` §3.2, §5 et §8.6 : le jeton n'est plus un disque plein mais
 * un anneau d'équipe au sol — bleu allié `#3F7FD6`, rouge ennemi `#D64545` — posé
 * sous le sprite et sous son ombre, et un nom `#E8DCC8` à `-2.2 × TILE_H`.
 * Les valeurs de §5 sont **[I]** : calibrées, donc épinglées au chiffre près.
 */
const CENTER = { x: 320, y: 240 };
const RING_RX = TILE_W * 0.46;
const RING_RY = TILE_H * 0.23;

function token(overrides: Partial<TokenView> = {}): TokenView {
  const base: TokenView = {
    id: "t",
    cell: { x: 2, y: 3 },
    center: CENTER,
    radius: 12.8,
    scale: 1,
    fill: PLAYER_TOKEN_COLOR,
    hp: 10,
    maxHp: 20,
    hpRatio: 0.5,
    badge: null,
    name: "Balthazar",
    depth: 5,
    active: false,
    ...STATIC_TOKEN_SPRITE,
  };
  return { ...base, ...overrides };
}

function ringOf(fill: number, scale = 1) {
  return teamRingFor(token({ fill, scale }));
}

describe("anneau d'équipe — couleurs exactes de la palette", () => {
  it("distingue l'allié du ennemi avec les hex de §3.2", () => {
    expect(ALLY_RING_COLOR).toBe(0x3f7fd6);
    expect(ENEMY_RING_COLOR).toBe(0xd64545);
    expect(ALLY_RING_COLOR).not.toBe(ENEMY_RING_COLOR);
    expect(ringOf(PLAYER_TOKEN_COLOR).color).toBe(0x3f7fd6);
    expect(ringOf(ENEMY_TOKEN_COLOR).color).toBe(0xd64545);
  });

  it("peint un anneau, jamais un aplat : alpha plein et aucun remplissage", () => {
    const ring = ringOf(PLAYER_TOKEN_COLOR);
    expect(ring.kind).toBe("ring");
    expect(ring.alpha).toBe(1);
  });
});

describe("anneau d'équipe — la géométrie suit la caméra", () => {
  it("trace 0,92 × 0,46 tuile et 2 px à l'échelle ×1", () => {
    const ring = ringOf(PLAYER_TOKEN_COLOR, 1);
    expect(ring.rx).toBeCloseTo(RING_RX, 6);
    expect(ring.ry).toBeCloseTo(RING_RY, 6);
    expect(ring.rx).toBeCloseTo(29.44, 6);
    expect(ring.ry).toBeCloseTo(7.36, 6);
    expect(ring.width).toBeCloseTo(2, 6);
  });

  it("double chaque mesure à l'échelle ×2", () => {
    const ring = ringOf(PLAYER_TOKEN_COLOR, 2);
    expect(ring.rx).toBeCloseTo(58.88, 6);
    expect(ring.ry).toBeCloseTo(14.72, 6);
    expect(ring.width).toBeCloseTo(4, 6);
  });

  it("reste centré sur le losange du jeton, ombre comprise", () => {
    const ring = ringOf(ENEMY_TOKEN_COLOR);
    expect(ring.x).toBe(CENTER.x);
    expect(ring.y).toBe(CENTER.y);
  });
});

describe("nom au-dessus de la tête — valeurs de §5", () => {
  it("épingle 11 px, #E8DCC8 et alpha 0.9", () => {
    expect(LABEL_FONT_SIZE).toBe(11);
    expect(NAME_LABEL_FILL).toBe(0xe8dcc8);
    expect(NAME_LABEL_ALPHA).toBe(0.9);
  });

  it("pose le nom à -2.2 × TILE_H du centre bas, à ×1 puis ×2", () => {
    expect(NAME_LIFT_TILES).toBe(2.2);
    const one = nameLabelFor(token({ scale: 1 }));
    const two = nameLabelFor(token({ scale: 2 }));
    expect(one?.y).toBeCloseTo(CENTER.y - 2.2 * TILE_H, 6);
    expect(one?.y).toBeCloseTo(CENTER.y - 70.4, 6);
    expect(two?.y).toBeCloseTo(CENTER.y - 2.2 * TILE_H * 2, 6);
    expect(two?.y).toBeCloseTo(CENTER.y - 140.8, 6);
  });

  it("suit la caméra pour la taille et le texte, jamais pour l'identité", () => {
    const one = nameLabelFor(token({ scale: 1 }));
    const two = nameLabelFor(token({ scale: 2 }));
    expect(one?.scale).toBe(1);
    expect(two?.scale).toBe(2);
    expect(two?.text).toBe(one?.text);
  });
});

describe("ordre des couches — anneau sous le sprite, nom au-dessus", () => {
  const rank = (name: string): number => SCENE_LAYER_ORDER.indexOf(name as never);

  it("empile teamRings sous les jetons et sous les acteurs", () => {
    expect(rank("teamRings")).toBeGreaterThanOrEqual(0);
    expect(rank("teamRings")).toBeLessThan(rank("tokens"));
    expect(rank("teamRings")).toBeLessThan(rank("actors"));
  });

  it("laisse le survol au-dessus du décor mais sous l'anneau", () => {
    expect(rank("decor")).toBeLessThan(rank("hover"));
    expect(rank("hover")).toBeLessThan(rank("teamRings"));
  });

  it("place le nom au-dessus des acteurs et des barres", () => {
    expect(rank("labels")).toBeGreaterThan(rank("actors"));
    expect(rank("labels")).toBeGreaterThan(rank("hpBars"));
  });
});
