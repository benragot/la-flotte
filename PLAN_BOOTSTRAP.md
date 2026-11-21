# PLAN_BOOTSTRAP.md — Initialisation du Harness & Socle "La Flotte"

Tu es en phase de bootstrap (agent `Build`).
Ta mission : installer le socle technique et le harness OpenCode 2.3.2 pour le projet **La Flotte** (RPG tactique solo local, mécaniques Dofus 1.29, données 100 % YAML).

**Règles absolues d'exécution :**
- Exécute les étapes **dans l'ordre (1 → 5)**.
- Ne passe JAMAIS à l'étape suivante tant que le **Checkpoint** de l'étape en cours n'est pas vert.
- Toutes les fonctions dans `src/` doivent faire **10 lignes maximum** (hors lignes vides et commentaires).

---

## ÉTAPE 1 — Arborescence & Socle Technique (Vite + TS strict + ESLint 10L + Vitest + YAML/Zod)

1. Crée l'arborescence suivante :
   - `.opencode/agents/`
   - `.opencode/plugins/`
   - `.opencode/skills/tdd-micro-functions/`
   - `.opencode/skills/yaml-data-design/`
   - `.opencode/skills/dofus-129-classes/`
   - `.opencode/skills/dofus-129-combat/`
   - `.opencode/skills/dofus-129-economy-drop/`
   - `.opencode/skills/lore-kaamelott-onepiece/`
   - `.github/workflows/`
   - `data/`
   - `src/engine/`, `src/schemas/`, `src/renderer/`, `src/ui/`
   - `tests/unit/`, `tests/data/`, `tests/walkthrough/`

2. Initialise `package.json` (si absent) en `"type": "module"` et installe :
   - Dépendances : `react`, `react-dom`, `pixi.js`, `zustand`, `zod`, `js-yaml`
   - DevDependencies : `typescript`, `vite`, `@vitejs/plugin-react`, `@modyfi/vite-plugin-yaml`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `eslint`, `@eslint/js`, `typescript-eslint`, `@types/react`, `@types/react-dom`, `@types/js-yaml`, `@types/node`

3. Configure les scripts suivants dans `package.json` :
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "typecheck": "tsc --noEmit",
       "lint": "eslint src tests",
       "test:data": "vitest run tests/data",
       "test:unit": "vitest run tests/unit",
       "test:walkthrough": "vitest run tests/walkthrough",
       "test": "vitest run",
       "check": "npm run typecheck && npm run lint && npm run test:data && npm run test:unit && npm run test:walkthrough"
     }
   }
   ```

4. Configure :
   - `tsconfig.json` : `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noEmit": true`, JSX `react-jsx`.
   - `vite.config.ts` : plugins `react()`, `tailwindcss()`, et `ViteYaml()` (`@modyfi/vite-plugin-yaml`).
   - `index.html`, `src/main.tsx`, `src/ui/App.tsx` (squelette minimal qui affiche le titre "La Flotte", fonctions ≤ 10 lignes).
   - `eslint.config.js` (flat config) avec les règles mécaniques strictes sur `src/**/*.{ts,tsx}` :
     - `"max-lines-per-function": ["error", { "max": 10, "skipBlankLines": true, "skipComments": true, "IIFEs": true }]`
     - `"complexity": ["error", 4]`
     - `"max-depth": ["error", 2]`
     - `"max-params": ["error", 3]`
     Et une règle assouplie sur `tests/**/*.ts` uniquement (`max: 35` pour les scénarios `describe`/`it`).

**Checkpoint 1 :** `npm run typecheck && npm run lint && npm run build` doit réussir sans erreur ni warning.

---

## ÉTAPE 2 — Fil d'Ariane TDD (YAML + Zod + Engine Headless + Walkthrough)

Crée une tranche verticale minimale prouvant que toute la chaîne fonctionne :

1. `data/classes.yaml` : définis uniquement la classe `iop` (id, name, basePa: 6, basePm: 3, baseHp: 50, basePp: 100).
2. `src/schemas/classSchema.ts` : schéma Zod validant `data/classes.yaml` + helper pur `parseClassesYaml(raw: string)`.
3. `src/engine/createHero.ts` : fonction pure `createHero(name: string, classDef: ClassDef)` retournant un personnage niveau 1 (≤ 10 lignes, zéro import React/PixiJS).
4. Les 3 suites de tests :
   - `tests/data/validate-yaml.spec.ts` : charge tous les `.yaml` de `data/` via `fs` + `js-yaml` et les valide avec Zod.
   - `tests/unit/createHero.spec.ts` : teste la création d'un héros niveau 1 (6 PA, 3 PM, 50 PV, 100 PP).
   - `tests/walkthrough/progression.spec.ts` : premier jalon du walkthrough (charge `classes.yaml` → crée un personnage Iop niveau 1 → vérifie ses stats de départ).

**Checkpoint 2 :** `npm run check` doit passer intégralement au vert.

---

## ÉTAPE 3 — CI GitHub Actions

Crée `.github/workflows/ci.yml` déclenché sur `pull_request` (branche `main`) et `push` (branche `main`), avec un job `quality-gate` (Node 22, `npm ci`, `npm run check`, `npm run build`).

**Checkpoint 3 :** Vérifie la syntaxe YAML de `.github/workflows/ci.yml` via `node -e "const fs=require('fs'),y=require('js-yaml'); y.load(fs.readFileSync('.github/workflows/ci.yml','utf8')); console.log('CI YAML OK')"`.

---

## ÉTAPE 4 — Installation du Harness OpenCode 2.3.2

### 4.1 `AGENTS.md` (à la racine)
Rédige une constitution concise (< 70 lignes) imposant :
- Cible : Dofus 1.29 (Retro), 12 classes, PA/PM/PO, LoS, soft caps, Sagesse/PP/Drop/XP.
- Univers : La Flotte (post-apo médiéval maritime, La Coupure, Fruits d'Écho, ton One Piece × Kaamelott).
- Données : 100 % YAML dans `data/*.yaml` validés par Zod. Zéro donnée métier en dur dans `src/`.
- Règles non négociables :
  1. `orchestrator` ne modifie jamais de fichier et délègue tout à un subagent.
  2. 1 feature = 1 branche (`feat/`, `fix/`, `design/`) = 1 PR GitHub (`gh pr create`). Zéro commit sur `main`.
  3. TDD strict : écrire le test → vérifier qu'il échoue (RED) → implémenter → vérifier qu'il passe (GREEN).
  4. Fonctions de 10 lignes max (`eslint` obligatoire, `eslint-disable` interdit).
  5. `src/engine/` ne doit jamais importer PixiJS, React ou `window`.

### 4.2 `opencode.jsonc` (à la racine)
```jsonc
{
  "$schema": "[https://opencode.ai/config.json](https://opencode.ai/config.json)",
  "default_agent": "orchestrator",
  "instructions": [
    "AGENTS.md"
  ],
  "permission": {
    "skill": {
      "*": "allow"
    }
  }
}
```
> Important : NE PAS ajouter de clé `plugins` pour le plugin local `.opencode/plugins/la-flotte-guard.ts` car OpenCode V2 auto-découvre `.opencode/plugins/`.

### 4.3 Les 5 agents dans `.opencode/agents/`
Utilise les noms d'outils OpenCode V2 (`read`, `glob`, `grep`, `edit`, `write`, `shell`, `subagent`) :

1. `.opencode/agents/orchestrator.md` (`mode: primary`)
   - Permissions : `read`, `glob`, `grep` = `allow` ; `edit`, `write`, `shell` = `deny` ; `subagent`: `{"*": "deny", "dofus-129-expert": "allow", "game-designer": "allow", "tdd-coder": "allow", "qa-reviewer": "allow"}`.
   - Rôle : seul interlocuteur utilisateur. Découpe chaque demande en 1 micro-PR. Consulte `dofus-129-expert` pour toute règle métier, délègue le contenu YAML à `game-designer` et le code à `tdd-coder`, puis fait auditer la PR par `qa-reviewer`.

2. `.opencode/agents/dofus-129-expert.md` (`mode: subagent`)
   - Permissions : lecture seule (`edit`, `write`, `shell`, `subagent` = `deny`).
   - Rôle : charge les skills `dofus-129-*`, produit des fiches Spec TDD exactes (formules 1.29, arrondis `Math.floor`, caps, 3 à 5 cas de tests chiffrés).

3. `.opencode/agents/game-designer.md` (`mode: subagent`)
   - Permissions : `edit` et `write` autorisés UNIQUEMENT sur `data/**` et `docs/design/**` (`*`: `deny`) ; `shell`: `allow`.
   - Rôle : charge `yaml-data-design` et `lore-kaamelott-onepiece`, crée maps (grille ASCII), monstres, sorts, panoplies et donjons en YAML, lance `npm run test:data`, ouvre une PR `design/<sujet>`.

4. `.opencode/agents/tdd-coder.md` (`mode: subagent`)
   - Permissions : `read`, `glob`, `grep`, `edit`, `write`, `shell` = `allow` ; `subagent` = `deny`.
   - Rôle : charge `tdd-micro-functions`. Exécute strictement : branche depuis `main` → test qui FAIL (RED) → implémentation minimale ≤ 10 lignes/fonction (GREEN) → mise à jour du walkthrough si pertinent → `npm run check` → commits (`test:` puis `feat:`) → `git push` → `gh pr create --fill`.

5. `.opencode/agents/qa-reviewer.md` (`mode: subagent`)
   - Permissions : `edit`, `write`, `subagent` = `deny` ; `shell` autorisé uniquement pour `git diff*`, `git log*`, `gh pr view*`, `gh pr diff*`, `npm run check`.
   - Rôle : audite la PR (TDD, 10 lignes max, pas d'import UI dans `src/engine/`, pas de hardcode, fidélité 1.29, walkthrough à jour). Verdict : `APPROUVÉ` ou `CHANGEMENTS REQUIS`.

### 4.4 Les 6 skills dans `.opencode/skills/<nom>/SKILL.md`
Crée chaque `SKILL.md` avec un frontmatter YAML valide (`name` identique au dossier + `description` claire) :
- `tdd-micro-functions/SKILL.md` : règles de découpage en fonctions pures ≤ 10 lignes (early returns, composition, types dédiés) + protocole Red/Green/Refactor.
- `yaml-data-design/SKILL.md` : conventions d'IDs `snake_case`, format des maps en grille ASCII (`.`, `#`, `~`, `P`, `M`), règle Zod obligatoire.
- `lore-kaamelott-onepiece/SKILL.md` : guide de ton (La Coupure, archipel, Fruits d'Écho, dialogues absurdes).
- `dofus-129-classes/SKILL.md`, `dofus-129-combat/SKILL.md`, `dofus-129-economy-drop/SKILL.md` : crée la structure de sections prête à recevoir les formules détaillées (paliers, dégâts/CC/esquive/poussée/LoS, courbe XP/Sagesse/PP/drop).

### 4.5 Plugin garde-fou V2 (`.opencode/plugins/la-flotte-guard.ts`)
Crée un unique module TypeScript **sans import npm externe** (format natif OpenCode V2 `{ id, setup }`) :
```typescript
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
```

**Checkpoint 4 :**
1. Lance `opencode debug config` et vérifie qu'il n'y a aucune erreur de chargement (config, agents, permissions, skills, plugin). Si une clé de permission est signalée invalide par ta build 2.3.2, corrige-la immédiatement selon la sortie de `opencode debug config`.
2. Relance `npm run check` (tout doit rester vert).

---

## ÉTAPE 5 — Vérification finale & Rapport

1. Vérifie `git status` : aucun fichier temporaire ou parasite (ajoute un `.gitignore` standard Node/Vite/macOS si absent).
2. Ne fais PAS de push forcé. Affiche simplement :
   - La liste des fichiers créés,
   - Le résultat de `npm run check`,
   - Le résultat de `opencode debug config`,
   - Les commandes git exactes pour que l'utilisateur fasse le commit initial de bootstrap sur `main` avant de redémarrer OpenCode sur `orchestrator`.
