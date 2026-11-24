import { defineConfig, type UserConfig } from "vite";
import { configDefaults } from "vitest/config";
import type { InlineConfig } from "vitest/node";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import ViteYaml from "@modyfi/vite-plugin-yaml";

// Cache de dépendances PAR WORKTREE. Un chemin relatif est résolu depuis `root`
// (Vite : `path.resolve(resolvedRoot, config.cacheDir)`), or chaque worktree a son
// propre `root` : le cache reste donc local. Le défaut `node_modules/.vite`, lui,
// traverse le symlink `node_modules` et devient partagé par tous les worktrees ;
// deux serveurs y ré-optimisaient les mêmes deps et servaient des chunks 504
// « Outdated Optimize Dep » (carte noire, PixiJS jamais initialisé).
//
// `test.exclude` reprend les exclusions par défaut de Vitest et y ajoute les
// copies de tests générées dans l'arbre : worktrees imbriqués (`.wt/`,
// `.worktrees/`) et rapports de session (`play-report*`). Sans elles, un run
// lancé depuis la racine scanne des centaines de tests dupliqués et rouges.
const testExclude = [
  ...configDefaults.exclude,
  ".wt/**",
  ".worktrees/**",
  "play-report*/**",
];

type VitestConfig = UserConfig & { test: InlineConfig };

const config: VitestConfig = {
  cacheDir: ".vite-cache",
  plugins: [react(), tailwindcss(), ViteYaml()],
  test: { exclude: testExclude },
};

export default defineConfig(config);
