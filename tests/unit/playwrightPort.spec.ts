import { describe, expect, it } from "vitest";
import { resolvePort, shouldReuseServer } from "../ui/playwrightPort";

/**
 * Deux suites navigateur lancées dans deux worktrees se disputaient le port 4173
 * codé en dur : l'une a mesuré le serveur de l'autre branche (vert sur du mauvais
 * code), l'autre a refusé de mesurer. Le port devient paramétrable et, dès qu'il
 * est explicite, Playwright refuse de réutiliser un serveur qu'il n'a pas démarré.
 */

describe("resolvePort", () => {
  it("garde 4173 par défaut, pour ne rien casser", () => {
    expect(resolvePort({})).toBe(4173);
  });

  it("lit un port explicite", () => {
    expect(resolvePort({ PLAYWRIGHT_PORT: "4210" })).toBe(4210);
  });

  it("traite une valeur vide comme absente", () => {
    expect(resolvePort({ PLAYWRIGHT_PORT: "" })).toBe(4173);
  });

  it("refuse bruyamment un port illisible plutôt que de retomber sur 4173", () => {
    expect(() => resolvePort({ PLAYWRIGHT_PORT: "abc" })).toThrow(/PLAYWRIGHT_PORT/);
  });

  it("refuse un port hors bornes", () => {
    expect(() => resolvePort({ PLAYWRIGHT_PORT: "70000" })).toThrow(/PLAYWRIGHT_PORT/);
  });
});

describe("shouldReuseServer", () => {
  it("réutilise hors CI quand rien n'est demandé", () => {
    expect(shouldReuseServer({})).toBe(true);
  });

  it("ne réutilise jamais en CI", () => {
    expect(shouldReuseServer({ CI: "1" })).toBe(false);
  });

  it("ne réutilise jamais un port explicite : il veut son propre serveur", () => {
    expect(shouldReuseServer({ PLAYWRIGHT_PORT: "4210" })).toBe(false);
  });
});
