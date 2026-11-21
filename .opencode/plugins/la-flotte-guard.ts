import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dirtyByRoot = new Map<string, boolean>();

function existingDir(target: string): string {
  let cur = path.resolve(target);
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) return REPO_ROOT;
    cur = parent;
  }
  return fs.statSync(cur).isDirectory() ? cur : path.dirname(cur);
}

function resolveDirFromCmd(cmd: string, input: Record<string, unknown>): string {
  const cdMatch = cmd.match(/(?:^|&&|;)\s*cd\s+["']?([^"'&;|\n]+)["']?/);
  if (cdMatch?.[1]) return existingDir(cdMatch[1].trim());
  const gitCMatch = cmd.match(/\bgit\s+-C\s+["']?([^\s"']+)["']?/);
  if (gitCMatch?.[1]) return existingDir(gitCMatch[1].trim());
  const explicit = input.cwd ?? input.workdir;
  if (typeof explicit === "string" && explicit.trim()) return existingDir(explicit);
  return REPO_ROOT;
}

function getGitRoot(target: string): string {
  try {
    return execSync("git rev-parse --show-toplevel", { cwd: existingDir(target), encoding: "utf8" }).trim();
  } catch {
    return REPO_ROOT;
  }
}

function getCurrentBranch(dir: string): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: existingDir(dir), encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function targetsMainBranch(cmd: string): boolean {
  return /(?:^|\s|:)(main|master)(?:\s|$)/.test(cmd);
}

function modifiesPluginsDir(cmd: string): boolean {
  return cmd
    .split(/&&|;|\n/)
    .map((seg) => seg.trim())
    .some((seg) => {
      if (/^(gh\s+pr\s+(create|comment|edit)|git\s+commit)\b/.test(seg)) return false;
      return seg.includes(".opencode/plugins/") && (/\b(rm|mv|cp|sed|tee|cat)\b/.test(seg) || seg.includes(">"));
    });
}

function assertCiPassed(cmd: string, dir: string): void {
  if (!cmd.includes("--squash")) {
    throw new Error("MERGE REFUSÉ : utilise toujours `--squash --delete-branch`.");
  }
  const match = cmd.match(/\bgh\s+pr\s+merge\b[^|;&\n]*?\b(\d+)\b/);
  const prArg = match ? match[1] : "";
  try {
    const out = execSync(`gh pr checks ${prArg}`, { cwd: existingDir(dir), encoding: "utf8" });
    if (!/quality-gate\s+pass/i.test(out)) {
      throw new Error("`quality-gate` n'est pas encore en `pass`.");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`MERGE BLOQUÉ : CI GitHub non verte (${msg}). Lance \`gh pr checks ${prArg} --watch\`.`);
  }
}

export default {
  id: "la-flotte.guard",
  async setup(ctx: {
    tool: {
      hook: (
        event: "execute.before" | "execute.after",
        handler: (payload: { tool: string; input: Record<string, unknown>; error?: unknown }) => void
      ) => Promise<void> | void;
    };
  }) {
    await ctx.tool.hook("execute.before", (event) => {
      const input = event.input ?? {};
      const filePath = String(input.path ?? input.filePath ?? "");
      const content = `${String(input.content ?? "")}${String(input.newString ?? "")}`;
      const cmd = String(input.command ?? "");

      if (event.tool === "edit" || event.tool === "write") {
        if (filePath.includes(".opencode/plugins/")) {
          throw new Error("INTERDIT : les agents ne peuvent pas modifier le plugin garde-fou.");
        }
        if (content.includes("eslint-disable")) {
          throw new Error("INTERDIT : ne contourne pas ESLint. Découpe en fonctions de 10 lignes max.");
        }
        dirtyByRoot.set(getGitRoot(filePath || REPO_ROOT), true);
      }

      if (event.tool === "shell" || event.tool === "bash") {
        const dir = resolveDirFromCmd(cmd, input);
        const root = getGitRoot(dir);
        const branch = getCurrentBranch(dir);
        const isMain = branch === "main" || branch === "master";

        if (modifiesPluginsDir(cmd)) {
          throw new Error("INTERDIT : modification du plugin garde-fou bloquée.");
        }
        if (/\bgh\s+pr\s+merge\b/.test(cmd)) {
          assertCiPassed(cmd, dir);
        }
        if (/\bgit\s+(merge|rebase)\b/.test(cmd) && targetsMainBranch(cmd)) {
          throw new Error("INTERDIT : utilise `gh pr merge --squash` via `pr-merger`, jamais un merge manuel.");
        }
        if (/\bgit\s+push\b/.test(cmd)) {
          const isDelete = /\s(--delete|-d)\s/.test(cmd);
          if (targetsMainBranch(cmd) || (isMain && !isDelete)) {
            throw new Error("INTERDIT : push direct sur main bloqué. Utilise une branche + PR.");
          }
        }
        if (/\bgit\s+commit\b/.test(cmd)) {
          if (isMain) {
            throw new Error("INTERDIT : commit direct sur main bloqué. Crée d'abord une branche/worktree.");
          }
          if (dirtyByRoot.get(root)) {
            throw new Error(`TDD GATE (${path.basename(root)}) : lance \`npm run check\` dans ce worktree avant git commit.`);
          }
          const msgMatch = cmd.match(/-m\s+["']([^"']+)["']/);
          if (msgMatch && !/^(feat|fix|test|refactor|chore|docs|ci)(\([a-z0-9-]+\))?!?: \p{Extended_Pictographic}\uFE0F? /u.test(msgMatch[1])) {
            throw new Error("FORMAT COMMIT INVALIDE : utilise `type(scope): <gitmoji> description`.");
          }
        }
      }
    });

    await ctx.tool.hook("execute.after", (event) => {
      const input = event.input ?? {};
      const cmd = String(input.command ?? "");
      if ((event.tool === "shell" || event.tool === "bash") && cmd.includes("npm run check") && !event.error) {
        dirtyByRoot.set(getGitRoot(resolveDirFromCmd(cmd, input)), false);
      }
    });
  },
};
