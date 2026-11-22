import { describe, expect, it } from "vitest";
import { readSettledBox } from "../ui/helpers";

/**
 * D84 : au premier paint, le canvas Pixi vaut 1×1 ; `boxOf` mesurait une seule
 * fois et capturait cette taille. La lecture doit attendre que la géométrie se
 * stabilise (deux mesures identiques) — sans élargir aucun seuil métier.
 */
const FIRST_PAINT = { x: 0, y: 0, width: 1, height: 1 };
const RESIZED = { x: 0, y: 0, width: 200, height: 100 };

function reader(reads: readonly (typeof FIRST_PAINT)[]) {
  let index = 0;
  return {
    read: async () => reads[Math.min(index, reads.length - 1)] ?? RESIZED,
    settle: async () => {
      index += 1;
    },
  };
}

describe("readSettledBox — D84, jamais la taille du premier paint", () => {
  it("attend que le canvas quitte son 1×1 initial", async () => {
    const box = await readSettledBox(reader([FIRST_PAINT, RESIZED]));
    expect(box).toEqual(RESIZED);
  });

  it("rend une boîte déjà stable sans la modifier", async () => {
    const box = await readSettledBox(reader([RESIZED]));
    expect(box).toEqual(RESIZED);
  });

  it("donne la dernière mesure quand rien ne se stabilise", async () => {
    const wobbling = [FIRST_PAINT, RESIZED, FIRST_PAINT, RESIZED, { ...RESIZED, width: 220 }];
    const box = await readSettledBox({ ...reader(wobbling), attempts: 4 });
    expect(box).toEqual({ ...RESIZED, width: 220 });
  });
});
