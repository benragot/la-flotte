import { describe, expect, it } from "vitest";
import { devMultipliers, resolveDevMultipliers } from "../../src/dev/devMultipliers";

describe("resolveDevMultipliers", () => {
  it("neutralise hors développement, même quand DEV vaut true", () => {
    expect(resolveDevMultipliers({ mode: "test", dev: true })).toEqual({ xp: 1, drop: 1 });
  });

  it("ignore toute surcharge hors développement", () => {
    const env = { mode: "production", dev: false, xp: "3", drop: "5" };
    expect(resolveDevMultipliers(env)).toEqual({ xp: 1, drop: 1 });
  });

  it("applique ×10 par défaut en développement", () => {
    expect(resolveDevMultipliers({ mode: "development", dev: true })).toEqual({ xp: 10, drop: 10 });
  });

  it("laisse une valeur fournie et valide l'emporter", () => {
    const env = { mode: "development", dev: true, xp: "3", drop: "5" };
    expect(resolveDevMultipliers(env)).toEqual({ xp: 3, drop: 5 });
  });

  it.each(["abc", "0", "-2", 0, -3])("retombe sur ×10 pour la valeur invalide %s", (raw) => {
    const env = { mode: "development", dev: true, xp: raw, drop: raw };
    expect(resolveDevMultipliers(env)).toEqual({ xp: 10, drop: 10 });
  });

  it("reste neutre via le wrapper sous Vitest (MODE vaut test)", () => {
    expect(devMultipliers()).toEqual({ xp: 1, drop: 1 });
  });
});
