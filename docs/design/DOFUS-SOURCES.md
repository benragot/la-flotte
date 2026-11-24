# Sources Dofus 1.29 — index de lecture

> Dépôt externe **en lecture seule** : `/Users/benjaminragot/dofus-1-29-decompose`.
> L'agent `dofus-source` l'interroge ; `opencode.jsonc` le déclare en `references`.

- **Briefing** : `EXPLORATION.md` (règles d'or, recettes, pièges) — à lire en premier.
- **Carte** : `ARCHITECTURE.md` (launcher Electron, modules Flash, namespaces).

## Chemins utiles
- `03_decompiled_as/loader|core|preloader|soma` : ActionScript décompilé (7 218 `.as`).
- `04_retro_client_raw/…/clips/sprites/sprites.xml` : catalogue **1 183 sprites** (id → nom).
- `02_electron_src/` : launcher Zaap ; `tools/` : scripts Python à ne **pas** lancer.

## Namespaces
- `dofus.graphics.gapi.ui` → `__Packages/dofus/%18%03%17/gapi/ui/` : **148 classes UI nommées**.
- `ank.battlefield` → `__Packages/%16%04%09/battlefield/` : **grille iso** (`MapHandler`).
- `dofus.aks` → `__Packages/dofus/%16%02%11/` : réseau/métier (`Items`, `Spells`, `Chat`).

## Règles d'or
- ⚠️ **30 clips** et **1 Go** max par session ; `grep -a` **obligatoire** (`.as` non UTF-8).
- ⚠️ Jamais de décompilation en masse de `clips/`, `data/maps/`, `audio/`.
- ⚠️ **Lecture seule** : aucune écriture, aucun script exécuté, donc aucun export.
- ⚠️ Un subagent ne peut pas en lancer un autre : **l'orchestrateur** appelle
  `dofus-source` puis transmet les faits à `dofus-129-expert` ou à un codeur.
