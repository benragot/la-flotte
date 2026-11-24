# Sources Dofus 1.29 — où lire

> Dépôt externe **en lecture seule** : `/Users/benjaminragot/dofus-1-29-decompose`,
> déclaré en `references` dans `opencode.jsonc` (accès `external_directory`).

**À lire en premier** : `06_notes/00_index.md`, **leur** index des acquis — il fait
autorité ; si la réponse y est, cite la fiche et **ne re-cherche pas**. Puis
`ARCHITECTURE.md` (namespaces), `07_index/packages.md` (ciblage) et les fiches de
`06_notes/` (`namespaces`, `inventaire`, `assets`, `reseau`) : **pointe**-les, ne
les recopie pas.

**Namespaces utiles** — `dofus.graphics.gapi.ui` (`…/dofus/%18%03%17/gapi/ui/`,
148 classes UI nommées), `ank.battlefield` (`…/%16%04%09/battlefield/`, grille iso
`MapHandler`), `dofus.aks` (`…/dofus/%16%02%11/`, réseau/métier `Items`, `Spells`).

**Règles d'or** — ⚠️ `grep -a` **obligatoire** (les `.as` sont non UTF-8), **lecture
seule**, aucun script lancé, jamais de décompilation en masse (`clips/`, `data/maps/`, `audio/` — **30 clips / 1 Go**).

**Limite** — un subagent ne peut pas en lancer un autre : c'est **l'orchestrateur**
qui appelle `dofus-source` et **transmet** les faits.
