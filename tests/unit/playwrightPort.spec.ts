import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  DERIVED_PORT_MAX,
  DERIVED_PORT_MIN,
  devCommand,
  resolvePort,
  serverBanner,
} from "../ui/playwrightPort";

/**
 * Deux suites navigateur lancées dans deux worktrees se disputaient le port 4173
 * codé en dur : l'une a mesuré le serveur de l'autre branche (vert sur du mauvais
 * code), l'autre a refusé de mesurer. Le port se dérive donc du chemin du
 * worktree : deux arbres ne peuvent plus viser le même serveur par accident.
 */

const ROOT_A = "/Users/benjaminragot/la-flotte/.worktrees/sell-ui";
const ROOT_B = "/Users/benjaminragot/la-flotte/docs/design/specs/.wt/range-overlay";

describe("resolvePort", () => {
  it("donne le même port deux fois pour la même racine", () => {
    expect(resolvePort({}, ROOT_A)).toBe(resolvePort({}, ROOT_A));
  });

  it("donne deux ports différents pour deux racines différentes", () => {
    expect(resolvePort({}, ROOT_A)).not.toBe(resolvePort({}, ROOT_B));
  });

  it("ignore la barre finale du chemin", () => {
    expect(resolvePort({}, `${ROOT_A}/`)).toBe(resolvePort({}, ROOT_A));
  });

  it("reste loin de 4173, le port partagé qui a causé le bug", () => {
    const port = resolvePort({}, ROOT_A);
    expect(port).toBeGreaterThanOrEqual(DERIVED_PORT_MIN);
    expect(port).toBeLessThanOrEqual(DERIVED_PORT_MAX);
  });

  it("respecte PLAYWRIGHT_PORT tel quel, quelle que soit la racine", () => {
    expect(resolvePort({ PLAYWRIGHT_PORT: "4210" }, ROOT_A)).toBe(4210);
    expect(resolvePort({ PLAYWRIGHT_PORT: "4210" }, ROOT_B)).toBe(4210);
  });

  it("traite une valeur vide ou blanche comme absente", () => {
    expect(resolvePort({ PLAYWRIGHT_PORT: "  " }, ROOT_A)).toBe(resolvePort({}, ROOT_A));
  });

  it("refuse bruyamment un port illisible plutôt que de retomber sur 4173", () => {
    expect(() => resolvePort({ PLAYWRIGHT_PORT: "abc" }, ROOT_A)).toThrow(/PLAYWRIGHT_PORT/);
  });

  it("refuse un port hors bornes", () => {
    expect(() => resolvePort({ PLAYWRIGHT_PORT: "70000" }, ROOT_A)).toThrow(/PLAYWRIGHT_PORT/);
  });
});

describe("devCommand", () => {
  it("épingle le port et interdit à Vite de glisser sur un port libre", () => {
    expect(devCommand(4312)).toContain("--port 4312");
    expect(devCommand(4312)).toContain("--strictPort");
  });
});

describe("serverBanner", () => {
  it("affiche le port, la racine et le fait que le serveur n'est jamais emprunté", () => {
    const banner = serverBanner(4312, ROOT_B);
    expect(banner).toContain("4312");
    expect(banner).toContain(ROOT_B);
    expect(banner).toContain("jamais réutilisé");
  });
});

describe("playwright.config.ts", () => {
  it("interdit la réutilisation du serveur d'un autre arbre", () => {
    const file = new URL("../../playwright.config.ts", import.meta.url);
    expect(readFileSync(file, "utf8")).toContain("reuseExistingServer: false");
  });
});
