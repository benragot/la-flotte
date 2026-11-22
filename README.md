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

⚠️ **Chaque worktree a son propre cache Vite.** Le défaut Vite
(`node_modules/.vite`) traverse le symlink `node_modules` : deux serveurs
(`npm run dev`, `test:ui`, `npm run play`) partageaient donc le même cache et se
ré-optimisaient mutuellement, ce qui invalidait les chunks de l'autre
(`504 Outdated Optimize Dep` sur un chunk `pixi`) et affichait
« Canvas indisponible ». `vite.config.ts` fixe `cacheDir: ".vite-cache"`,
résolu depuis le `root` de chaque worktree, donc un cache par dossier.

Si « Canvas indisponible » réapparaît (cache d'une version antérieure, ou
`.vite-cache` corrompu après un arrêt brutal), purge le cache **du dossier
courant** puis recharge à froid :

```bash
rm -rf .vite-cache            # un cache par worktree : le tien seulement
rm -rf node_modules/.vite     # reliquat du cache partagé d'avant ce correctif
# navigateur : DevTools ouvert → Cmd+Shift+R (hard reload)
```

## Jouer une session automatiquement

```bash
npm run play                                   # 1280×720, port libre, 6 étapes
npm run play -- --viewport 1920x1080           # autre viewport
npm run play -- --headed                       # voir la partie se jouer
```

Un script Playwright **hors** de la suite (`scripts/play/`) crée un héros Iop,
explore la carte, joue un combat 1v1 (`?demo=combat`) jusqu'à la fin de tour,
ouvre la **vraie fiche `Donjons`** (constate le refus sans clef), puis bascule
sur `?demo=dungeon` pour la salle, et termine par l'inventaire. Il démarre
**son propre** serveur vite sur un port éphémère : il refuse de démarrer si le
port est déjà pris et vérifie, via un jeton servi par `/@fs`, que l'application
répondant est bien **ce** worktree (le piège du port 4173 codé en dur dans
`playwright.config.ts`, qui peut jouer le code d'un autre dossier).

`play-report/` (gitignoré) contient :

- `NN-<étape>.png` : une capture par étape, plus la fin de tour, la fiche Donjons, la salle et le détail d'objet ;
- `report.json` : par étape `{ step, ok, durationMs, url, notices, boxes, missing }` — `boxes` mesure les zones clés (y compris la fiche Donjons refermée depuis), `missing` liste celles qui n'ont pas été trouvées ;
- `console.log` : **toutes** les entrées console (`debug`, `info`, `warning`, `error`) avec l'étape courante ;
- `errors.json` : `missingZones` (zones clés absentes, bloquantes), `pageerror` avec pile complète, `console.error`, requêtes `status ≥ 400` et `requestfailed`, les exceptions explicitement documentées, et les `warnings` (comptés, non bloquants).

### Lire `errors.json` et l'exit code

Chaque entrée porte `step` : l'étape où l'erreur est apparue. `pageErrors`,
`failedRequests`, les étapes `failed` et les **zones absentes**
(`missingZones` : une étape `status: "ok"` dont le journal, le panneau ou le
canvas n'a pas été mesuré n'a rien prouvé) sont toujours bloquants ;
`consoleErrors` aussi, sauf les règles listées dans `documentedConsoleErrors`
(court, justifié, commenté dans `scripts/play/verdict.mjs`). Un `skipped` n'est
toléré que s'il est déclaré dans `DOCUMENTED_SKIPS` — table vide aujourd'hui,
donc tout skip fait échouer le run.

Un `status: "ok"` ne dit que « aucune exception » : chaque étape doit donc
asserter un **effet** observable. L'étape combat 1v1 le fait sur le compteur
`Tour N` du bandeau (`Tour 1 → Tour 2`) : un clic « Passer » inerte fait échouer
l'étape.

Les `warnings` sont comptés et résumés mais ne bloquent pas : un `console.warn`
(contexte WebGL perdu) doit se voir, pas arrêter la session. Le seuil documenté
est de **2 warnings par capture** (les captures déclenchent légitimement un
ReadPixels WebGL) ; au-delà, le résumé ajoute un avertissement `⚠️ non
bloquant` (readback probablement par frame = coût réel), sans changer l'exit
code.

- **`0`** : les six étapes se sont jouées, aucune zone absente, zéro `pageerror`, zéro requête en échec, zéro `console.error` non documenté ;
- **`1`** : le rapport a trouvé quelque chose (une erreur console, un asset en 404, une étape `failed`, une zone absente, un skip non documenté) ;
- **`2`** : panne du harnais, aucun verdict rendu (port occupé, vite mort, identité de l'app refusée, option invalide).

Le résumé final rappelle les compteurs, les raisons et le chemin des captures.

### Ce que ce n'est pas

Ce n'est **pas** un test de non-régression : il n'entre ni dans `npm run check`
ni dans `test:ui`, et il ne bloque aucune PR. C'est un **instrument de
diagnostic** : les conditions réelles du navigateur (Pixi, WebGL, chargement des
SVG, erreurs de contexte) qu'aucun test `jsdom` ni aucune assertion de mise en
page ne voit. Un `exit 1` n'est pas « le harnais est cassé » : c'est le rapport
qui a trouvé quelque chose.
