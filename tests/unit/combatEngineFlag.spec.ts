import { afterEach, describe, expect, it, vi } from "vitest";
import { combatEngine, resolveCombatEngine } from "../../src/dev/combatEngineFlag";

/**
 * Drapeau DEC-12, étape 2 : `VITE_COMBAT_ENGINE=unified` sélectionnera le
 * moteur unique. Absent, vide ou inconnu ⇒ `legacy` (comportement actuel).
 * Il n'est **pas** encore consommé par `useCombatStore` : l'UI bascule à
 * l'étape 3, et `combat` / `battle` sont deux slices distinctes.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveCombatEngine", () => {
  it("seul « unified » active le moteur unique", () => {
    expect(resolveCombatEngine("unified")).toBe("unified");
  });

  it.each([undefined, "", "legacy", "UNIFIED", " unified", "unified "])(
    "retombe sur legacy pour la valeur %s",
    (raw) => {
      expect(resolveCombatEngine(raw)).toBe("legacy");
    },
  );
});

describe("combatEngine", () => {
  it("lit VITE_COMBAT_ENGINE ; variable absente = legacy", () => {
    expect(combatEngine()).toBe("legacy");
    vi.stubEnv("VITE_COMBAT_ENGINE", "unified");
    expect(combatEngine()).toBe("unified");
  });

  it("ignore une valeur inconnue fournie par l'environnement", () => {
    vi.stubEnv("VITE_COMBAT_ENGINE", "both");
    expect(combatEngine()).toBe("legacy");
  });
});
