import { readFileSync } from "node:fs";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

interface PermissionRule {
  action: string;
  resource: string;
  effect: string;
}

const QA_REVIEWER_PATH = ".opencode/agents/qa-reviewer.md";
const READ_AND_VERDICT = [
  "gh pr review 12 --approve",
  "gh pr review 12 --request-changes --body x",
  "gh pr comment 12 --body x",
  "gh pr view 12",
  "gh pr checks 12",
  "gh pr diff 12",
  "git status",
  "git log --oneline -1",
  "git diff main...HEAD",
  "git show HEAD",
  "git fetch origin",
  "git ls-files src",
  "git grep TODO",
];
const FORBIDDEN = [
  "gh pr merge 12 --squash",
  "gh pr merge 12 --merge",
  "git push",
  "git push -u origin chore/x",
  "git commit -m x",
  "git checkout main",
  "git switch main",
  "git add .",
  "git reset --hard",
  "npm run check",
  "npm run build",
  "npx vitest run",
  "node -e 1",
];
/** Écritures de fichier qui contournent `edit`/`write` via le shell. */
const WRITE_VECTORS = [
  "git status > f",
  "git log >> f",
  "gh pr view 1 | head",
  "git diff --output=f",
  "git log --output=f",
];
const SAFE_READS = ["git status", "gh pr view 1 --json title"];

function readRules(path: string): PermissionRule[] {
  const raw = readFileSync(path, "utf8");
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(raw)?.[1];
  if (frontmatter === undefined) throw new Error(`frontmatter absent : ${path}`);
  return (load(frontmatter) as { permissions: PermissionRule[] }).permissions;
}

function readShellRules(): PermissionRule[] {
  return readRules(QA_REVIEWER_PATH).filter((rule) => rule.action === "shell");
}

/** Glob textuel (`*` → `.*`). Teste la liste des ressources, pas la précédence runtime. */
function toPattern(resource: string): RegExp {
  const escaped = resource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replaceAll("\\*", ".*")}$`);
}

function isAllowed(command: string): boolean {
  return resolveEffect(command) === "allow";
}

/** Effet de la dernière règle qui matche (précédence « dernier match »). */
function resolveEffect(command: string): string | undefined {
  const matching = readShellRules().filter((rule) => toPattern(rule.resource).test(command));
  return matching.at(-1)?.effect;
}

function isFileWriteAllowed(): boolean {
  return readRules(QA_REVIEWER_PATH).some(
    (rule) => rule.effect === "allow" && ["edit", "write"].includes(rule.action),
  );
}

describe("matrice de permissions de qa-reviewer", () => {
  it("garde le shell fermé par défaut", () => {
    const rootDeny = readShellRules().some(
      (rule) => rule.resource === "*" && rule.effect === "deny",
    );
    expect(rootDeny).toBe(true);
  });

  it("autorise la lecture du dépôt et le verdict sur la PR", () => {
    for (const command of READ_AND_VERDICT) expect(isAllowed(command), command).toBe(true);
  });

  it("refuse merge, écriture git et construction", () => {
    for (const command of FORBIDDEN) expect(isAllowed(command), command).toBe(false);
  });

  it("n'accorde aucune écriture de fichier", () => {
    expect(isFileWriteAllowed()).toBe(false);
  });

  it.each(WRITE_VECTORS)("refuse le vecteur d'écriture %s", (command) => {
    expect(isAllowed(command)).toBe(false);
  });

  it.each(SAFE_READS)("continue d'autoriser la lecture %s", (command) => {
    expect(isAllowed(command)).toBe(true);
  });

  it("n'interdit pas les options nommées --output-*", () => {
    expect(isAllowed("git diff --output-indicator-new=+")).toBe(true);
  });
});
