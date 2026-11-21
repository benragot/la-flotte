import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatGameVersion } from "../../src/engine/version";

const readJson = (file: string) =>
  JSON.parse(readFileSync(join(process.cwd(), file), "utf8"));

describe("walkthrough : version affichée", () => {
  it("aligne la version du manifeste Release Please sur package.json", () => {
    const manifest = readJson(".release-please-manifest.json");
    expect(manifest["."]).toBe(readJson("package.json").version);
  });

  it("affiche la version du jeu avec le préfixe v", () => {
    const version = formatGameVersion(readJson("package.json").version);
    expect(version).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});
