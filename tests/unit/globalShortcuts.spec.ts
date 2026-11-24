import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CombatState } from "../../src/engine/combatLoop/types";
import type { ShortcutContext } from "../../src/ui/useGlobalShortcuts";
import { INTERACTIVE_SELECTOR, isInteractiveTarget, shortcutForKey } from "../../src/ui/useGlobalShortcuts";

/**
 * UI-03 : la barre Espace terminait le tour alors qu'un bouton avait le focus,
 * ce qui jetait les PA/PM restants au lieu d'activer le bouton (comportement
 * natif du navigateur). Le dépôt n'a ni jsdom ni testing-library : la décision
 * est donc extraite dans `shortcutForKey`, qui ne consomme que le `code` et la
 * cible de l'événement, doublée ici par un faux élément `closest`.
 */

const SOURCE_PATH = join(process.cwd(), "src/ui/useGlobalShortcuts.ts");

/** Contrôles dont Espace est le comportement natif. */
const INTERACTIVE_TOKENS = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  '[role="button"]',
  '[contenteditable="true"]',
];

interface Focusable {
  closest: (selector: string) => unknown;
  seen: string[];
}

function focusable(interactive: boolean): Focusable {
  const seen: string[] = [];
  const closest = (selector: string) => {
    seen.push(selector);
    return interactive ? { selector } : null;
  };
  return { closest, seen };
}

function context(overrides: Partial<ShortcutContext> = {}): ShortcutContext {
  return {
    phase: "player_turn",
    mode: "combat",
    combat: null,
    selectedSpellId: null,
    selectSpell: vi.fn(),
    endTurn: vi.fn(),
    ...overrides,
  };
}

describe("isInteractiveTarget", () => {
  it("refuse les cibles absentes ou sans `closest`", () => {
    expect(isInteractiveTarget(null)).toBe(false);
    expect(isInteractiveTarget(undefined)).toBe(false);
    expect(isInteractiveTarget({})).toBe(false);
    expect(isInteractiveTarget("button")).toBe(false);
  });

  it("délègue au DOM via `closest` et retient un élément interactif", () => {
    const button = focusable(true);
    expect(isInteractiveTarget(button)).toBe(true);
    expect(button.seen).toEqual([INTERACTIVE_SELECTOR]);
  });

  it("laisse passer un élément décoratif", () => {
    expect(isInteractiveTarget(focusable(false))).toBe(false);
  });

  it("interroge tous les contrôles attendus dans un seul sélecteur", () => {
    INTERACTIVE_TOKENS.forEach((token) => expect(INTERACTIVE_SELECTOR).toContain(token));
  });
});

describe("shortcutForKey — Espace sur un contrôle interactif", () => {
  it("ne coupe pas le tour quand un bouton a le focus", () => {
    const endTurn = vi.fn();
    const effect = shortcutForKey({ code: "Space", target: focusable(true) }, context({ endTurn }));
    expect(effect).toBeNull();
    expect(endTurn).not.toHaveBeenCalled();
  });

  it("ne coupe pas le tour sur l'alias Spacebar non plus", () => {
    expect(shortcutForKey({ code: "Spacebar", target: focusable(true) }, context())).toBeNull();
  });

  it("réserve le garde-fou à Espace : Digit1 sélectionne toujours le sort", () => {
    const selectSpell = vi.fn();
    const combat = { player: { spellIds: ["flamme"] } } as unknown as CombatState;
    const effect = shortcutForKey({ code: "Digit1", target: focusable(true) }, context({ combat, selectSpell }));
    expect(effect).not.toBeNull();
    effect?.();
    expect(selectSpell).toHaveBeenCalledWith("flamme");
  });
});

describe("shortcutForKey — Espace hors contrôle interactif", () => {
  it("termine le tour quand la cible est décorative", () => {
    const endTurn = vi.fn();
    const effect = shortcutForKey({ code: "Space", target: focusable(false) }, context({ endTurn }));
    expect(effect).not.toBeNull();
    effect?.();
    expect(endTurn).toHaveBeenCalledTimes(1);
  });

  it("termine le tour sans cible du tout (document sans focus)", () => {
    const endTurn = vi.fn();
    const effect = shortcutForKey({ code: "Space", target: null }, context({ endTurn }));
    effect?.();
    expect(endTurn).toHaveBeenCalledTimes(1);
  });

  it("ignore Espace hors du tour du joueur", () => {
    const context_ = context({ phase: "enemy_turn" });
    expect(shortcutForKey({ code: "Space", target: null }, context_)).toBeNull();
  });
});

describe("câblage de l'écouteur clavier", () => {
  it("fait passer chaque keydown par shortcutForKey avant de consommer l'événement", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");
    expect(source).toMatch(/shortcutForKey\(event, context\)/);
  });
});
