import { describe, expect, it } from "vitest";
import { formatGameVersion } from "../../src/engine/version";

describe("formatGameVersion", () => {
  it("préfixe une version brute avec v", () => {
    expect(formatGameVersion("0.0.0")).toBe("v0.0.0");
  });

  it("est idempotent sur une version déjà préfixée", () => {
    expect(formatGameVersion("v0.1.2")).toBe("v0.1.2");
  });

  it("refuse une version vide", () => {
    expect(() => formatGameVersion("")).toThrow();
  });
});
