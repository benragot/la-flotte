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

## Jouer une session automatiquement

```bash
npm run play                                   # 1280×720, port libre, 6 étapes
npm run play -- --viewport 1920x1080           # autre viewport
npm run play -- --headed                       # voir la partie se jouer
```

Un script Playwright **hors** de la suite (`scripts/play/`) crée un héros Iop,
explore la carte, joue un combat 1v1 (`?demo=combat`) jusqu'à la fin de tour,
ouvre une salle de donjon (`?demo=dungeon`) et l'inventaire. Il démarre **son
propre** serveur vite sur un port éphémère : il refuse de démarrer si le port
est déjà pris et vérifie, via un jeton servi par `/@fs`, que l'application
répondant est bien **ce** worktree (le piège du port 4173 codé en dur dans
`playwright.config.ts`, qui peut jouer le code d'un autre dossier).

`play-report/` (gitignoré) contient :

- `NN-<étape>.png` : une capture par étape, plus la fin de tour et le détail d'objet ;
- `report.json` : par étape `{ step, ok, durationMs, url, notices, boxes, missing }` — `boxes` mesure les zones clés, `missing` liste celles qui n'ont pas été trouvées ;
- `console.log` : **toutes** les entrées console (`debug`, `info`, `warning`, `error`) avec l'étape courante ;
- `errors.json` : `pageerror` avec pile complète, `console.error`, requêtes `status ≥ 400` et `requestfailed`, plus les exceptions explicitement documentées.

### Lire `errors.json`

Chaque entrée porte `step` : l'étape où l'erreur est apparue. `pageErrors` et
`failedRequests` sont toujours bloquants ; `consoleErrors` aussi, sauf les
règles listées dans `documentedConsoleErrors` (court, justifié, commenté dans
`scripts/play/verdict.mjs`). Le script sort en `1` dès qu'une de ces catégories
est non vide, `0` sinon — le résumé final rappelle les compteurs et le chemin
des captures.

### Ce que ce n'est pas

Ce n'est **pas** un test de non-régression : il n'entre ni dans `npm run check`
ni dans `test:ui`, et il ne bloque aucune PR. C'est un **instrument de
diagnostic** : les conditions réelles du navigateur (Pixi, WebGL, chargement des
SVG, erreurs de contexte) qu'aucun test `jsdom` ni aucune assertion de mise en
page ne voit. Un `exit 1` n'est pas « le harnais est cassé » : c'est le rapport
qui a trouvé quelque chose.
