import { describe, expect, it } from "vitest";
import { readSettledBox } from "../ui/helpers";

/**
 * D84 : au premier paint, le canvas Pixi vaut 1×1 ; `boxOf` mesurait une seule
 * fois et capturait cette taille. Une boîte dégénérée doit être relue après une
 * frame ; une boîte saine ne doit **pas** payer d'attente (suite CI rapide).
 */
const FIRST_PAINT = { x: 0, y: 0, width: 1, height: 1 };
const RESIZED = { x: 0, y: 0, width: 200, height: 100 };

function reader(reads: readonly (typeof FIRST_PAINT)[]) {
  let index = 0;
  let readsDone = 0;
  return {
    read: async () => {
      readsDone += 1;
      return reads[Math.min(index, reads.length - 1)] ?? RESIZED;
    },
    settle: async () => {
      index += 1;
    },
    reads: () => readsDone,
  };
}

describe("readSettledBox — D84, jamais la taille du premier paint", () => {
  it("attend que le canvas quitte son 1×1 initial", async () => {
    const source = reader([FIRST_PAINT, RESIZED]);
    const box = await readSettledBox(source);
    expect(box).toEqual(RESIZED);
    expect(source.reads()).toBe(2);
  });

  it("rend une boîte déjà saine sans payer de frame", async () => {
    const source = reader([RESIZED]);
    const box = await readSettledBox(source);
    expect(box).toEqual(RESIZED);
    expect(source.reads()).toBe(1);
  });

  it("donne la dernière mesure quand le canvas reste dégénéré", async () => {
    const source = reader([FIRST_PAINT, FIRST_PAINT, FIRST_PAINT]);
    const box = await readSettledBox({ ...source, attempts: 2 });
    expect(box).toEqual(FIRST_PAINT);
    expect(source.reads()).toBe(3);
  });
});
