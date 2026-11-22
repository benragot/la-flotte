import { describe, expect, it, vi } from "vitest";
import type { FloatingEvent } from "../../src/engine/combat";

vi.mock("pixi.js", async () => {
  const { FakeGraphics, FakeNode, FakeText } = await import("./support/fakePixi");
  return {
    Container: FakeNode,
    Graphics: FakeGraphics,
    Text: FakeText,
    Assets: { load: () => new Promise(() => undefined) },
    Texture: class {},
    Rectangle: class {},
  };
});

const { FLOAT_EDGE_PADDING, FLOAT_MS, FLOAT_RISE_PX, floatAlpha, floatLabel, floatOrigin, floatRise, floatY, stackOffset } =
  await import("../../src/renderer/floatingText");
const { FloatingTextLayer } = await import("../../src/renderer/floatingTextLayer");

/**
 * Le rendu PixiJS n'est pas testable : la position, la montée et l'opacité sont
 * donc des **fonctions pures** (testées ici au pixel et à la milliseconde), et la
 * couche ne fait que les appliquer à des `Text`. Le seul comportement de couche
 * vérifié est celui qui fuit : durée de vie, destruction et changement de scène.
 */

type Token = Parameters<typeof floatOrigin>[0];

function token(id: string, hp = 30): Token {
  return {
    id,
    center: { x: 100, y: 200 },
    radius: 12,
    scale: 1,
    fill: 0xd64545,
    hp,
    maxHp: 40,
    hpRatio: hp / 40,
    badge: null,
    name: null,
    depth: 0,
    active: false,
    spriteId: null,
    facing: "left",
    animation: "idle",
    animationKey: "static",
  };
}

function event(overrides: Partial<FloatingEvent> = {}): FloatingEvent {
  return { id: 1, targetId: "piou-0", amount: 8, kind: "damage", ...overrides };
}

const MAP = { id: "ferraille_plage_01" };
const OTHER_MAP = { id: "crique_des_noyes" };

function spawn(events: readonly FloatingEvent[] = [event()]): InstanceType<typeof FloatingTextLayer> {
  const layer = new FloatingTextLayer();
  layer.sync({ events, tokens: [token("piou-0")], scene: MAP });
  return layer;
}

describe("texte flottant — étiquettes et trajectoire", () => {
  it("affiche les dégâts avec un signe moins et le soin avec un signe plus", () => {
    expect(floatLabel("damage", 8)).toBe("-8");
    expect(floatLabel("heal", 5)).toBe("+5");
  });

  it("part de zéro et monte de FLOAT_RISE_PX sur toute la durée", () => {
    expect(floatRise(0)).toBe(0);
    expect(floatRise(FLOAT_MS / 2)).toBe(FLOAT_RISE_PX / 2);
    expect(floatRise(FLOAT_MS)).toBe(FLOAT_RISE_PX);
  });

  it("ne dépasse jamais la course, même en retard d'une image", () => {
    expect(floatRise(FLOAT_MS * 3)).toBe(FLOAT_RISE_PX);
  });

  it("part opaque et s'estompe jusqu'à zéro sur 1,5 s", () => {
    expect(FLOAT_MS).toBe(1500);
    expect(floatAlpha(0)).toBe(1);
    expect(floatAlpha(FLOAT_MS / 2)).toBe(0.5);
    expect(floatAlpha(FLOAT_MS)).toBe(0);
  });

  it("s'arrête au bord haut du canevas au lieu de sortir de l'écran", () => {
    expect(floatY(100, FLOAT_MS / 2)).toBe(100 - FLOAT_RISE_PX / 2);
    expect(floatY(4, FLOAT_MS)).toBe(FLOAT_EDGE_PADDING);
  });

  it("démarre au-dessus du jeton de la cible, jamais dedans", () => {
    const origin = floatOrigin(token("piou-0"));
    expect(origin.y).toBeLessThan(200);
    expect(origin.x).toBe(100);
  });

  it("décale les coups multiples d'une même cible, symétriquement", () => {
    expect(stackOffset(0)).toEqual({ x: 0, y: 0 });
    expect(stackOffset(1).x).toBeLessThan(0);
    expect(stackOffset(2).x).toBeGreaterThan(0);
    expect(stackOffset(3).y).toBeLessThan(stackOffset(1).y);
  });
});

describe("couche flottante — durée de vie et changement de scène", () => {
  it("pose la première image dès la création : aucun clignotement au coin (0,0)", () => {
    const layer = spawn();
    const text = layer.container.children[0] as unknown as { position: { x: number; y: number }; alpha: number };
    expect(text.position.y).toBeGreaterThan(0);
    expect(text.position.x).toBe(floatOrigin(token("piou-0")).x);
    expect(text.alpha).toBe(1);
  });

  it("crée un texte au-dessus de la cible et détruit le nœud après 1,5 s", () => {
    const layer = spawn();
    expect(layer.container.children).toHaveLength(1);
    expect(layer.busy()).toBe(true);
    layer.advance(0);
    layer.advance(FLOAT_MS);
    expect(layer.container.children).toHaveLength(0);
    expect(layer.busy()).toBe(false);
  });

  it("écrit le libellé signé dans le texte, pas le montant brut", () => {
    const layer = spawn([event({ amount: 12 })]);
    const text = layer.container.children[0] as unknown as { text: string };
    expect(text.text).toBe("-12");
  });

  it("ne rejoue pas un événement déjà consommé au rendu suivant", () => {
    const layer = spawn();
    layer.sync({ events: [event()], tokens: [token("piou-0")], scene: MAP });
    expect(layer.container.children).toHaveLength(1);
  });
});

describe("couche flottante — une carte neuve ne rejoue jamais un tampon", () => {
  it("détruit tout au changement de carte : aucun texte fantôme", () => {
    const layer = spawn();
    layer.sync({ events: [], tokens: [token("piou-0")], scene: OTHER_MAP });
    expect(layer.busy()).toBe(false);
    expect(layer.container.children).toHaveLength(0);
  });

  it("change de carte avec un tampon plein sans rejouer un seul nombre", () => {
    const layer = new FloatingTextLayer();
    const buffer = [event({ id: 1 }), event({ id: 2 }), event({ id: 3 })];
    layer.sync({ events: buffer, tokens: [token("piou-0")], scene: MAP });
    expect(layer.container.children).toHaveLength(3);
    layer.sync({ events: buffer, tokens: [token("piou-0")], scene: OTHER_MAP });
    expect(layer.busy()).toBe(false);
    expect(layer.container.children).toHaveLength(0);
  });

  it("affiche de nouveau après un changement de carte, même si l'identifiant repart de 1", () => {
    const layer = new FloatingTextLayer();
    layer.sync({ events: [event({ id: 7 })], tokens: [token("piou-0")], scene: MAP });
    layer.sync({ events: [], tokens: [token("piou-0")], scene: OTHER_MAP });
    layer.sync({ events: [event({ id: 1 })], tokens: [token("piou-0")], scene: OTHER_MAP });
    expect(layer.container.children).toHaveLength(1);
  });

  it("ignore un événement dont la cible a quitté la scène", () => {
    const layer = new FloatingTextLayer();
    layer.sync({ events: [event({ targetId: "fantome" })], tokens: [token("piou-0")], scene: MAP });
    expect(layer.busy()).toBe(false);
  });
});
