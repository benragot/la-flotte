import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import ViteYaml from "@modyfi/vite-plugin-yaml";

// Cache de dépendances PAR WORKTREE. Un chemin relatif est résolu depuis `root`
// (Vite : `path.resolve(resolvedRoot, config.cacheDir)`), or chaque worktree a son
// propre `root` : le cache reste donc local. Le défaut `node_modules/.vite`, lui,
// traverse le symlink `node_modules` et devient partagé par tous les worktrees ;
// deux serveurs y ré-optimisaient les mêmes deps et servaient des chunks 504
// « Outdated Optimize Dep » (carte noire, PixiJS jamais initialisé).
export default defineConfig({
  cacheDir: ".vite-cache",
  plugins: [react(), tailwindcss(), ViteYaml()],
});
