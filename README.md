# la-flotte

La Flotte : monde post-apo médiéval maritime après **La Coupure** (Dofus 1.29 ×
One Piece × Kaamelott). Les données métier vivent dans `data/*.yaml`, validées
par des schémas Zod dans `src/schemas/`.

## Tests d'interface

La mise en page du HUD est vérifiée dans un **vrai navigateur headless**
(`@playwright/test`, chromium, trois viewports : 1024×768, 1280×720, 1920×1080).
`jsdom` renvoie des rectangles à zéro : il ne peut pas voir une superposition.

```bash
npm run test:ui   # démarre vite sur :4173 puis joue tests/ui
```

`npm run check` reste rapide et **n'inclut pas** Playwright : la suite navigateur
est un job CI séparé (`ui-layout`, `needs: quality-gate`).

⚠️ **Piège du `node_modules` partagé.** Un worktree n'a pas de `node_modules`
propre : il pointe par symlink vers `la-flotte/node_modules`. `@playwright/test`
doit donc être installé dans ce dossier **partagé**, depuis le **dépôt
principal** :

```bash
cd /Users/benjaminragot/la-flotte
npm install                 # dépendances partagées
npx playwright install chromium
```

Ne lance **jamais `npm install` dans un worktree** : npm supprime le symlink,
installe une copie locale, et `npm run test:ui` casse partout ailleurs.
