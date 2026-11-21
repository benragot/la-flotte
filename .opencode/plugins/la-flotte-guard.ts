let dirtySinceLastCheck = false;

export default {
  id: "la-flotte.guard",
  async setup(ctx: {
    tool: {
      hook: (
        event: "execute.before" | "execute.after",
        handler: (payload: { tool: string; input: Record<string, unknown> }) => void
      ) => Promise<void> | void;
    };
  }) {
    await ctx.tool.hook("execute.before", (event) => {
      const input = event.input ?? {};
      const path = String(input.path ?? input.filePath ?? "");
      const content = `${String(input.content ?? "")}${String(input.newString ?? "")}`;
      const cmd = String(input.command ?? "");

      if (event.tool === "edit" || event.tool === "write") {
        if (path.includes(".opencode/plugins/")) {
          throw new Error("INTERDIT : les agents ne peuvent pas modifier le plugin garde-fou.");
        }
        if (content.includes("eslint-disable")) {
          throw new Error("INTERDIT : ne contourne pas ESLint. Découpe en fonctions de 10 lignes max.");
        }
        dirtySinceLastCheck = true;
      }

      if (event.tool === "shell" || event.tool === "bash") {
        if (/git\s+push.*\b(main|master)\b/.test(cmd)) {
          throw new Error("INTERDIT : push direct sur main bloqué. Utilise une branche + PR.");
        }
        if (/git\s+commit/.test(cmd) && dirtySinceLastCheck) {
          throw new Error("TDD GATE : lance `npm run check` avant tout git commit.");
        }
      }
    });

    await ctx.tool.hook("execute.after", (event) => {
      const cmd = String(event.input?.command ?? "");
      if ((event.tool === "shell" || event.tool === "bash") && cmd.includes("npm run check")) {
        dirtySinceLastCheck = false;
      }
    });
  },
};
