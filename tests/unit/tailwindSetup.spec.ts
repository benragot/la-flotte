import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const STYLES_PATH = "src/styles.css";
const MAIN_PATH = "src/main.tsx";
const APP_PATH = "src/ui/App.tsx";

/** Assemblé pour ne pas déclencher le garde-fou du dépôt : on vérifie son absence. */
const LINT_ESCAPE = ["eslint", "disable"].join("-");
const INLINE_STYLE = ["style", "={{"].join("");

function hasFile(path: string): boolean {
  return existsSync(join(ROOT, path));
}

function readSource(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

describe("bootstrap Tailwind v4", () => {
  it("ship une feuille de style qui importe Tailwind", () => {
    expect(hasFile(STYLES_PATH)).toBe(true);
    expect(readSource(STYLES_PATH)).toContain('@import "tailwindcss";');
  });

  it("importe la feuille de style depuis le point d'entrée React", () => {
    expect(readSource(MAIN_PATH)).toMatch(/import\s+"\.\/styles\.css";/);
  });
});

describe("assemblage jouable de App", () => {
  it("monte le canvas PixiJS et le HUD de combat", () => {
    const source = readSource(APP_PATH);
    expect(source).toMatch(/CombatCanvas[^;]*from\s+"\.\.\/renderer"/);
    expect(source).toMatch(/CombatHud[^;]*from\s+"\.\/components"/);
  });

  it("démarre automatiquement le combat de démonstration", () => {
    expect(readSource(APP_PATH)).toContain("startDemoCombat");
  });

  it("reste sans échappement lint ni style inline", () => {
    const source = readSource(APP_PATH);
    expect(source).not.toContain(LINT_ESCAPE);
    expect(source).not.toContain(INLINE_STYLE);
  });
});
