import { describe, expect, it } from "vitest";
import { demoEntryFrom } from "../../src/ui/demoEntry";

describe("demoEntryFrom", () => {
  it("ignore totalement le paramètre en production", () => {
    expect(demoEntryFrom("?demo=combat", false)).toBeNull();
    expect(demoEntryFrom("?demo=dungeon", false)).toBeNull();
  });

  it("reconnaît les deux entrées de démo en dev", () => {
    expect(demoEntryFrom("?demo=combat", true)).toBe("combat");
    expect(demoEntryFrom("?demo=dungeon", true)).toBe("dungeon");
  });

  it("ignore un paramètre absent ou inconnu", () => {
    expect(demoEntryFrom("", true)).toBeNull();
    expect(demoEntryFrom("?demo=autre", true)).toBeNull();
  });
});
