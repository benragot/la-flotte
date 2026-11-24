# Worktrees des écrivains

**Pourquoi** : deux écrivains dans un même arbre = même branche = commits mélangés, un seul peut écrire.

1. **`worktree.directory: ".wt"`** (`opencode.jsonc`) : réglage officiel qui fait naître les
   worktrees **dans** le dépôt. La permission `external_directory` refuse par défaut les
   chemins **hors** du projet : c'était la cause du blocage (`../la-flotte-wt-*`).
2. **`.wt/` dans `.gitignore`** : sinon `git status` du root voit les arbres.
3. **Commande manuelle** : `git worktree add .wt/<slug> -b <branche>` puis
   `ln -s ../../node_modules .wt/<slug>/node_modules` (lien **relatif**).

**Règles** : jamais `npm install` dans un worktree ; cache Vite par racine
(`cacheDir: ".vite-cache"`, PR #103).
**Limite** : `.wt/` vit **dans** le dépôt, donc `.gitignore` doit le couvrir.
