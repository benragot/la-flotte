import { describe, expect, it } from "vitest";
import { LAYOUT_BUDGET_MS, budgetMessage, hasEveryBox, pairSummary, pollUntilStable, sameRead } from "../ui/helpers";
import type { Box, SelectorPair, StablePoll } from "../ui/helpers";

/**
 * D84 : `boxOf` mesurait **une seule fois**, donc il pouvait lire le canvas à
 * 1×1 (avant le resize Pixi) ou à une taille intermédiaire. Le contrat n'est
 * plus un seuil magique de taille mais : **deux relevés consécutifs identiques**,
 * dans un budget borné. Ces tests portent sur la fonction pure, sans `Page`.
 */
const RESIZED: Box = { x: 0, y: 0, width: 200, height: 100 };
const FIRST_PAINT: Box = { x: 0, y: 0, width: 1, height: 1 };
const INTERMEDIATE: Box = { x: 0, y: 0, width: 20, height: 20 };

const STEP_MS = 10;

interface ScriptedPoll extends StablePoll<(Box | null)[]> {
  reads: () => number;
}

/** Source de relevés scriptée : chaque `read` consomme le relevé suivant et avance l'horloge. */
function scripted(samples: readonly (Box | null)[][], budgetMs = 100): ScriptedPoll {
  let index = 0;
  let reads = 0;
  const sampleAt = (position: number) => samples[Math.min(position, samples.length - 1)] ?? [RESIZED];
  return {
    read: async () => {
      const sample = sampleAt(index);
      reads += 1;
      index += 1;
      return sample;
    },
    isComplete: hasEveryBox,
    equals: sameRead,
    describe: (sample) => `${sample[0]?.width ?? 0}×${sample[0]?.height ?? 0}`,
    budgetMs,
    now: () => index * STEP_MS,
    reads: () => reads,
  };
}

/** Source qui grossit à chaque relevé : aucune stabilisation possible. */
function endless(budgetMs: number): ScriptedPoll {
  let index = 0;
  const growth = () => {
    const current = index;
    index += 1;
    return { x: 0, y: 0, width: 100 + current, height: 100 };
  };
  return {
    read: async () => [growth()],
    isComplete: hasEveryBox,
    equals: sameRead,
    describe: (sample) => `${sample[0]?.width ?? 0}×${sample[0]?.height ?? 0}`,
    budgetMs,
    now: () => index * STEP_MS,
    reads: () => index,
  };
}

describe("sameRead — deux relevés comparables", () => {
  it("reconnaît deux boîtes identiques et refuse deux tailles différentes", () => {
    expect(sameRead([RESIZED], [{ ...RESIZED }])).toBe(true);
    expect(sameRead([INTERMEDIATE], [RESIZED])).toBe(false);
  });

  it("compare aussi les cases absentes et l'ordre des sélecteurs", () => {
    expect(sameRead([null, RESIZED], [null, { ...RESIZED }])).toBe(true);
    expect(sameRead([null], [RESIZED])).toBe(false);
    expect(sameRead([RESIZED, INTERMEDIATE], [INTERMEDIATE, RESIZED])).toBe(false);
  });

  it("juge un relevé incomplet inexploitable, même répété à l'identique", () => {
    expect(hasEveryBox([null, RESIZED])).toBe(false);
    expect(hasEveryBox([{ x: 0, y: 0, width: 0, height: 0 }])).toBe(false);
    expect(hasEveryBox([FIRST_PAINT, RESIZED])).toBe(true);
  });
});

describe("pollUntilStable — deux relevés identiques, budget borné", () => {
  it("rend la mesure dès deux relevés consécutifs identiques", async () => {
    const source = scripted([[RESIZED], [RESIZED]]);
    expect(await pollUntilStable(source)).toEqual([RESIZED]);
    expect(source.reads()).toBe(2);
  });

  it("relit quand la taille bouge encore", async () => {
    const source = scripted([[FIRST_PAINT], [INTERMEDIATE], [RESIZED], [RESIZED]]);
    expect(await pollUntilStable(source)).toEqual([RESIZED]);
    expect(source.reads()).toBe(4);
  });

  it("ne rend pas la taille intermédiaire que l'ancien seuil jugeait saine", async () => {
    const source = scripted([[FIRST_PAINT], [INTERMEDIATE], [RESIZED], [RESIZED]]);
    expect(await pollUntilStable(source)).toEqual([RESIZED]);
    expect(source.reads()).toBe(4);
  });

  it("attend le montage : deux absences égales ne sont pas une mesure", async () => {
    const source = scripted([[null], [null], [RESIZED], [RESIZED]]);
    expect(await pollUntilStable(source)).toEqual([RESIZED]);
    expect(source.reads()).toBe(4);
  });
});

describe("pollUntilStable — budget borné et erreur utile", () => {
  it("échoue avec un message explicite quand le budget est épuisé", async () => {
    const source = endless(STEP_MS);
    await expect(pollUntilStable(source)).rejects.toThrow(/La boîte n'a pas stabilisé en 10 ms : dernière mesure \d+×100/);
  });

  it("nomme la mesure et le conteneur dans l'erreur de budget", () => {
    const pair: SelectorPair = ["canvas", "section"];
    const input: StablePoll<(Box | null)[]> = {
      ...scripted([[INTERMEDIATE]]),
      describe: (sample) => pairSummary(sample, pair),
    };
    const message = budgetMessage(input, [INTERMEDIATE, RESIZED], 42);
    expect(message).toContain("n'a pas stabilisé en 42 ms");
    expect(message).toContain("dernière mesure 20×20, conteneur 200×100");
  });

  it("expose un budget explicite plutôt qu'une constante cachée dans la boucle", () => {
    expect(LAYOUT_BUDGET_MS).toBeGreaterThan(0);
    expect(pollUntilStable.length).toBe(1);
  });
});
