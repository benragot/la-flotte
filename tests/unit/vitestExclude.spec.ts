import { matchesGlob } from "node:path";
import { describe, expect, it } from "vitest";
import { testExclude } from "../../vite.config";

/**
 * Un fichier est collecté quand **aucun** motif de `test.exclude` ne le couvre.
 * `path.matchesGlob` suit la même sémantique de glob (`**`, segments cachés)
 * que le matcher utilisé par Vitest pour filtrer ses fichiers de test.
 */
const isCollected = (file: string): boolean =>
  !testExclude.some((pattern) => matchesGlob(file, pattern));

/**
 * Positions réelles des copies de `tests/unit` créées par les worktrees d'agent :
 * à la racine (`.wt/`, `.worktrees/`) et imbriquées dans l'arbre, notamment sous
 * `docs/design/specs/.wt/` (repli imposé par la sandbox).
 */
const NESTED_COPIES = [
  ".wt/agent/tests/unit/dup.spec.ts",
  ".worktrees/agent/tests/unit/dup.spec.ts",
  "docs/design/specs/.wt/probe/tests/unit/dup.spec.ts",
  "docs/design/specs/.worktrees/probe/tests/unit/dup.spec.ts",
];

describe("test.exclude", () => {
  it.each(NESTED_COPIES)("refuse la copie imbriquée %s", (file) => {
    expect(isCollected(file)).toBe(false);
  });

  it("conserve les tests de la racine", () => {
    expect(isCollected("tests/unit/garde.spec.ts")).toBe(true);
    expect(isCollected("tests/data/grille.spec.ts")).toBe(true);
  });

  it("exclut node_modules et dist à toute profondeur", () => {
    expect(isCollected("node_modules/pkg/x.spec.ts")).toBe(false);
    expect(isCollected("docs/pkg/node_modules/x.spec.ts")).toBe(false);
    expect(isCollected("dist/x.spec.ts")).toBe(false);
    expect(isCollected("src/dist/x.spec.ts")).toBe(false);
  });
});
