import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "scripts", "generate-sprites.mjs");

interface CheckRun {
  status: number;
  stdout: string;
}

/** Lance `node scripts/generate-sprites.mjs --check` : c'est la garde anti-dérive des SVG. */
function runCheck(): CheckRun {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, "--check"], { encoding: "utf8" });
    return { status: 0, stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string };
    return { status: failure.status ?? 1, stdout: failure.stdout ?? "" };
  }
}

describe("générateur de feuilles — garde anti-dérive", () => {
  it("sort en succès quand les SVG commités sont ceux du générateur", () => {
    const run = runCheck();
    expect(run.stdout).toContain("0 échec(s)");
    expect(run.status).toBe(0);
  });

  it("vérifie les 13 feuilles et pas moins", () => {
    const run = runCheck();
    expect(run.stdout).toContain("13 feuilles");
  });

  it("compare le contenu des SVG au rendu du générateur", () => {
    const run = runCheck();
    expect(run.stdout).not.toContain("désynchronisée");
  });
});
