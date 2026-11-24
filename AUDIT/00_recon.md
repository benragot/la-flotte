# 00 — Reconnaissance

> Audit **lecture seule** de l'état du dépôt au 2026-11-24, branche `chore/audit-1-29`
> partie de `main` @ `5ba4b35`. Aucune ligne de code modifiée par cet audit.

## 1. Stack

| Brique | Version | Preuve |
| --- | --- | --- |
| Vite | `^6.0.5` | `package.json` |
| TypeScript | `^5.7.2`, `strict: true`, `noUncheckedIndexedAccess: true` | `package.json`, `tsconfig.json` |
| React | `^18.3.1` (+ `react-dom`) | `package.json` |
| PixiJS | `^8.6.6` | `package.json` |
| Zustand | `^5.0.2` | `package.json` |
| Zod | `^3.24.1` | `package.json` |
| js-yaml | `^4.1.0` (imports YAML via `@modyfi/vite-plugin-yaml`) | `package.json` |
| Vitest | `^2.1.8` | `package.json` |
| Playwright | `^1.65.1` (`tests/ui`) | `package.json`, `playwright.config.ts` |

- **Zéro donnée métier en dur** : les 11 fichiers `data/*.yaml` (classes, donjons,
  items, maps, monsters, progression, recipes, sets, spawns, spells, sprites) sont
  importés puis validés par un schéma Zod de `src/schemas/` (11 schémas, un par
  fichier de données).
- **Moteur headless** : `grep` de `react`, `pixi.js` et `window.` dans
  `src/engine/**` → **aucune occurrence**, la règle de la constitution tient.

## 2. Entrypoints et découpage

```
index.html  →  src/main.tsx  →  src/ui/App.tsx
```

| Zone | Rôle | Contenu |
| --- | --- | --- |
| `src/engine/**` | moteur headless, sans React/Pixi/window | `combat/`, `combatLoop/`, `multiCombat/`, `dungeon/`, `exploration/`, `grid/`, `hero/`, `inventory/`, `economy/`, `craft/`, `save/` |
| `src/renderer/**` | PixiJS, canvas iso, scènes et calques | `usePixiApp.ts`, `sceneLayers.ts`, `tilePaint.ts`, `tokens.ts`, `sprites/` |
| `src/ui/**` | React, HUD, panneaux, raccourcis | `App.tsx`, `components/`, `uiTokens.ts`, `useGlobalShortcuts.ts` |
| `src/store/**` | Zustand, orchestration | `useGameStore.ts`, `useCombatStore.ts`, `battleSelectors.ts` |
| `src/schemas/**` | validation Zod des YAML | 11 schémas |

### Deux moteurs de combat

| Moteur | Usage | Imports dans le store |
| --- | --- | --- |
| `src/engine/combatLoop/**` (1v1) | combat d'exploration, un héros contre un monstre | `src/store/useCombatStore.ts:9-15` |
| `src/engine/multiCombat/**` (1vN) | salle de donjon, un héros contre N monstres, timeline d'initiative | `src/store/useCombatStore.ts:48-50` |

Les deux sont branchés dans le **même** store : `useCombatStore` choisit le moteur
selon le mode (`battle` vs `combat`). Aucun code partagé de résolution de tour, de
portée ou de dégâts : les formules sont dupliquées, d'où des écarts de
comportement entre les deux modes (voir `ISSUES.md`, GRID-05, GRID-04, SPELL-04).

## 3. Commandes

| Commande | Effet | Sortie |
| --- | --- | --- |
| `npm run dev` | serveur Vite | `http://localhost:5173` |
| `npm run check` | `typecheck` + `lint` + `test:data` + `test:unit` + `test:walkthrough` | 3 suites Vitest |
| `npm run build` | build de production Vite | `dist/` |
| `npm run play` | harness Playwright maison (`scripts/play/run.mjs`) | captures + `report.json` + `console.log` dans `play-report/` |
| `npm run test:ui` | tests Playwright (`tests/ui`) | rapport Playwright |

`npm run check` agrège trois passes : `tests/data` (YAML vs schémas),
`tests/unit` (moteur pur) et `tests/walkthrough` (scénarios de jeu de bout en bout,
sans navigateur).

## 4. État observable

Captures `play-report/` du **2026-11-23** (`report.json` : `generatedAt`
`2026-11-23T23:51:18.651Z`, viewport 1280×720, verdict `code: 0`, 6 étapes `ok`,
0 étape en échec).

| Étape | Constat |
| --- | --- |
| `01-ecran-creation` | écran de création atteignable |
| `02-creation-iop` | création d'un héros, **12 classes** proposées (`data/classes.yaml`) |
| `03-exploration` | exploration jouable, déplacement au clic |
| `04-combat-1v1` | combat d'exploration, **fin de tour vérifiée** |
| `05-combat-donjon` | fiche donjon, **refus sans clef**, puis salle de donjon |
| `06-inventaire` | inventaire et détail d'objet |

Ce qui **manque** à l'observation :

1. **aucun aperçu de chemin ni de coût PM au survol** (`buildPathPreview` sans
   appelant) ;
2. **le héros est masqué par le décor** en salle de donjon
   (`play-report/05b-salle-donjon.png`, décor non intercalé) ;
3. **aucun nom de héros en salle** (les jetons de combat n'en portent pas) ;
4. **résistances et `% Dégâts` d'équipement affichés mais « non appliqué »**,
   comme les panoplies : le stuff est visible, son effet de combat ne l'est pas.

## 5. Mesures

| Mesure | Valeur |
| --- | --- |
| `npm run check` | **vert** — 167 tests `data` + 1612 `unit` + 51 `walkthrough` = **1830 tests**, 116 fichiers |
| `npm run build` | **OK** — `dist/assets/index-*.js` 823,73 kB (250,94 kB gzip), avertissement de chunk > 500 kB |
| Erreurs console dans le harness | **0** `consoleErrors`, 0 `pageErrors`, 0 `failedRequests`, 0 étape en échec ; 4 avertissements et 1 erreur console **documentée** (fallback WebGL logiciel de Chromium headless) |

## 6. Limites de cet audit

- `npm run play` **n'a pas pu être relancé** dans cette session (permissions du
  sandbox) : l'état observable du §4 vient des captures et du `report.json` du
  2026-11-23, pas d'une exécution fraîche.
- La **référence décompilée** Dofus 1.29 (`/Users/benjaminragot/dofus-1-29-decompose`)
  n'est lisible que par l'agent expert `dofus-source` : les chemins cités dans
  `01_reference.md` sont ceux transmis par cet agent, pas re-vérifiés ici.
- Aucun test n'a été ajouté ni modifié : les constats sont **déduits du code**
  (`fichier:ligne`) et des captures, pas d'un nouveau protocole expérimental.
