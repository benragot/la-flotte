import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CombatPhase } from "../../src/engine/combatLoop/types";
import type { Shortcut, ShortcutInput } from "../../src/ui/shortcuts";
import { resolveShortcut, spellIndexFromCode } from "../../src/ui/shortcuts";

const SOURCE_PATH = join(process.cwd(), "src/ui/shortcuts.ts");

const NONE: Shortcut = { kind: "none" };

/** `event.key` d'une rangée 1–9 sur un clavier Mac AZERTY, sans Shift. */
const AZERTY_RAW_KEYS = ["&", "é", '"', "'", "(", "-", "è", "_", "ç"];

function input(overrides: Partial<ShortcutInput> = {}): ShortcutInput {
  return { code: "Digit1", phase: "player_turn", focusInTextField: false, ...overrides };
}

function selectSpell(index: number): Shortcut {
  return { kind: "selectSpell", index };
}

function phasesWithoutPlayerTurn(): readonly CombatPhase[] {
  return ["enemy_turn", "victory", "defeat"];
}

describe("spellIndexFromCode", () => {
  it("mappe Digit1 sur l'index 0 (0-based)", () => {
    expect(spellIndexFromCode("Digit1")).toBe(0);
  });

  it("mappe Digit9 sur l'index 8", () => {
    expect(spellIndexFromCode("Digit9")).toBe(8);
  });

  it("ignore Digit0, le pavé numérique et les lettres", () => {
    expect(spellIndexFromCode("Digit0")).toBeNull();
    expect(spellIndexFromCode("Numpad1")).toBeNull();
    expect(spellIndexFromCode("KeyA")).toBeNull();
  });

  it("ignore les codes vides ou hors bornes", () => {
    expect(spellIndexFromCode("Digit")).toBeNull();
    expect(spellIndexFromCode("Digit10")).toBeNull();
    expect(spellIndexFromCode("Digit1x")).toBeNull();
  });
});

describe("resolveShortcut — rangée 1 à 9", () => {
  it("sélectionne le sort 0 sur Digit1 pendant le tour du joueur", () => {
    expect(resolveShortcut(input({ code: "Digit1" }))).toEqual(selectSpell(0));
  });

  it("sélectionne le sort 8 sur Digit9", () => {
    expect(resolveShortcut(input({ code: "Digit9" }))).toEqual(selectSpell(8));
  });

  it("ne sélectionne aucun sort hors du tour du joueur", () => {
    phasesWithoutPlayerTurn().forEach((phase) => {
      expect(resolveShortcut(input({ phase }))).toEqual(NONE);
    });
  });
});

describe("resolveShortcut — AZERTY : seul event.code compte", () => {
  it("résout Digit1 alors que la touche produit « & » sur un clavier Mac AZERTY", () => {
    const producedKey = AZERTY_RAW_KEYS[0] ?? "";
    expect(producedKey).toBe("&");
    // `event.key` vaut « & » sur AZERTY : un résolveur basé sur `key` renverrait none.
    expect(resolveShortcut(input({ code: "Digit1" }))).toEqual(selectSpell(0));
  });

  it("résout Digit2 alors que la touche produit « é » sur AZERTY", () => {
    expect(AZERTY_RAW_KEYS[1]).toBe("é");
    expect(resolveShortcut(input({ code: "Digit2" }))).toEqual(selectSpell(1));
  });

  it("ne consulte jamais event.key dans son implémentation", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    expect(source).toContain("code");
    expect(source).not.toContain("event.key");
    expect(source).not.toContain(".key ");
  });
});

describe("resolveShortcut — fin de tour", () => {
  it("termine le tour sur Space", () => {
    expect(resolveShortcut(input({ code: "Space" }))).toEqual({ kind: "endTurn" });
  });

  it("accepte l'alias Spacebar des anciens navigateurs", () => {
    expect(resolveShortcut(input({ code: "Spacebar" }))).toEqual({ kind: "endTurn" });
  });

  it("ignore Space hors du tour du joueur", () => {
    phasesWithoutPlayerTurn().forEach((phase) => {
      expect(resolveShortcut(input({ code: "Space", phase }))).toEqual(NONE);
    });
  });
});

describe("resolveShortcut — annulation", () => {
  it("annule le sort sélectionné sur Escape", () => {
    const allPhases: readonly CombatPhase[] = ["player_turn", "enemy_turn", "victory", "defeat"];
    allPhases.forEach((phase) => {
      expect(resolveShortcut(input({ code: "Escape", phase }))).toEqual({ kind: "cancelSpell" });
    });
  });
});

describe("resolveShortcut — focus dans un champ de saisie", () => {
  it("ne vole jamais la frappe d'un champ sur Digit1", () => {
    expect(resolveShortcut(input({ focusInTextField: true }))).toEqual(NONE);
  });

  it("ne vole jamais la frappe d'un champ sur Space", () => {
    expect(resolveShortcut(input({ code: "Space", focusInTextField: true }))).toEqual(NONE);
  });

  it("laisse aussi Escape au champ de saisie", () => {
    expect(resolveShortcut(input({ code: "Escape", focusInTextField: true }))).toEqual(NONE);
  });
});

describe("resolveShortcut — touches ignorées", () => {
  it("ignore les codes inconnus", () => {
    expect(resolveShortcut(input({ code: "KeyA" }))).toEqual(NONE);
    expect(resolveShortcut(input({ code: "Digit0" }))).toEqual(NONE);
    expect(resolveShortcut(input({ code: "Numpad1" }))).toEqual(NONE);
    expect(resolveShortcut(input({ code: "" }))).toEqual(NONE);
  });
});
