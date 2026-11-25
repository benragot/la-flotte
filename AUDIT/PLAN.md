# PLAN — ordre d'attaque

> **État constaté sur `218f8e3` (`main`, 2026-11-25 à 23:40 CET).** Ce plan est
> un **instantané de la file**, pas une réservation éternelle : un merge ou une
> PR ouverte après ce commit peut changer les verrous. Avant de lancer un
> chantier, relire la section « Verrous » et vérifier
> `gh pr list --state open`.
>
> Suite de `AUDIT/ISSUES.md` : **77 constats initiaux + 5 écarts découverts**,
> soit **82 constats suivis**. Au commit constaté : **26 clos**, **4 partiels**
> (INPUT-01, DATA-02, SPELL-02, GRID-03), **1 re-cadré** (COMBAT-03 →
> MONSTER-01), **51 ouverts** (P0 : 0, P1 : 5, P2 : 46). Détail des hashes dans
> `AUDIT/ISSUES.md` → `## Suivi des merges` ; méthode de comptage dans
> `AUDIT/ISSUES.md` → `## Comptage`.

## Verrous de fichiers en cours (instantané `218f8e3`)

La collision se joue **fichier par fichier**, pas par dossier : un dossier
« libre » peut contenir un fichier tenu.

| Chantier | Fichiers verrouillés | Détenteur |
| --- | --- | --- |
| **RENDER-05** — animations `attack`/`hit` | `src/renderer/battleAction.ts`, `src/renderer/battleSceneModel.ts`, `src/renderer/combatSceneModel.ts`, `src/renderer/index.ts`, `src/renderer/sprites/EntitySprite.ts`, `src/renderer/sprites/actionEffect.ts`, `src/renderer/sprites/actorStage.ts` (+ `tests/unit/battleAction.spec.ts`, `battleScene.spec.ts`, `entitySprite.spec.ts`) | branche `feat/render-anim-work`, **PR #182 — en corrections** |
| **SPELL-05** — `castsPerTarget` | `src/engine/combat/spellUsage.ts`, `src/store/battleSelectors.ts` | branche `fix/spell-casts-per-target`, **PR #184 — ouverte** |
| **DATA-02 (reste)** — écran de vente | `src/ui/components/OverlayPanels.tsx`, `src/ui/components/inventory/BackpackList.tsx`, `src/ui/components/inventory/inventoryTheme.ts`, `src/ui/inventoryHudHelpers.ts`, nouveaux `src/ui/components/inventory/saleView.ts` et `useSell.ts`, `tests/ui/sellPanel.spec.ts` | branche locale `design/sell-ui` (worktree `docs/design/specs/.wt/sell-ui`, base `30889b4`, **aucune PR**) |
| **Audit #183** — ce document | `AUDIT/ISSUES.md`, `AUDIT/PLAN.md` | branche `docs/audit-refresh`, **PR #183 ouverte** |

**Fichiers libres, au-delà de cette liste** : `src/engine/**` sauf
`combat/spellUsage.ts` ; `src/store/**` sauf `battleSelectors.ts` ; tout
`src/schemas/**` ; tout `data/**` ; tout `src/ui/**` hors des fichiers de
`design/sell-ui` listés ci-dessus. #179 est mergée (`a44a089`) et a rendu
`useCombatStore.ts`, `battleSpells.ts` et `battleRouting.ts` ; #181 est mergée
(`218f8e3`) et a rendu `App.tsx` et `battleTheme.ts`. En revanche
**`battleSelectors.ts` n'est plus libre** : #184 l'occupe, même si
`src/store/**` l'était dans l'instantané précédent.

## Règle d'ordonnancement

Deux agents ne prennent jamais le même **fichier tenu** en même temps : les
chantiers qui le partagent **se succèdent** dans l'ordre du tableau. Un chantier
qui a besoin de deux fichiers tenus par deux détenteurs est **coupé en deux
PR** ; la seconde attend que la première soit mergée et que le fichier soit
libre. Le tableau des verrous est la seule source : un chantier dont un fichier
est tenu **ne se lance pas**, même pour une seule ligne.

Rappel DEC-12 : **aucune nouvelle règle de combat dans
`src/engine/combatLoop/`**. Toute règle s'implémente dans
`src/engine/multiCombat/` ; l'ancien moteur ne reçoit que des correctifs de
parité déjà planifiés. L'étape 4 ne part qu'après parité complète.

## Chantiers futurs — zone exacte et condition de départ

| Ordre | ID | Zone touchée | Ne pas lancer avant |
| --- | --- | --- | --- |
| A1 | RENDER-04 — nappe de portée | `src/renderer/tileStyle.ts`, `tilePaint.ts`, `scene.ts`, `battleSceneModel.ts`, `combatSceneModel.ts` | **#182 mergée ou abandonnée** : `battleSceneModel.ts` et `combatSceneModel.ts` sont tenus. |
| A2 | GRID-03 (reste rendu) | `src/renderer/battleSceneModel.ts`, `pathPreview.ts` | #182 mergée (même `battleSceneModel.ts`). |
| B1 | 3b-3 — dock de sorts partagé | `src/ui/App.tsx`, `dockGate.ts`, `components/battle/BattleSpellDock.tsx`, `components/battle/BattlePanel.tsx` | Aucun de ces quatre fichiers n'est tenu à l'instantané (`App.tsx` est libre depuis #181). **Revérifier `git status` de `design/sell-ui` avant de partir** : si elle ajoute une entrée dans `App.tsx`, attendre son merge. |
| B2 | GRID-03 (reste UI) | `src/ui/components/battle/BattlePanel.tsx` | A2 mergée **et** `design/sell-ui` mergée. |
| B3 | SPELL-04 (volet UI) | `src/ui/components/battle/CombatantCard.tsx`, `components/SpellSlots.tsx` | C2 mergée (le moteur expose `spellId` + `targetCell`) **et** sell-ui mergée. |
| B4 | UI-16 — retirer `hasMissingState` | `src/ui/spellSlotState.ts` | C4 livrée (états réellement appliqués). |
| C1 | ARCH-04 — convergence des archétypes | `src/engine/multiCombat/ai.ts`, `src/schemas/monsterSchema.ts`, `data/monsters.yaml` (+ `data/archetypes.yaml` si créé) | Rien : zone moteur libre. À faire avant toute nouvelle IA. |
| C2 | SPELL-04 (moteur) | `src/store/battleSelectors.ts`, `useCombatStore.ts`, `engine/multiCombat/attack.ts`, `multiCombat/spellUse.ts` | **#184 mergée** : `battleSelectors.ts` est tenu par `castsPerTarget`. `useCombatStore.ts` est libre depuis #179. |
| C3 | SPELL-01 — zones | `engine/multiCombat/range.ts`, nouveau `multiCombat/zone.ts`, `schemas/spellSchema.ts`, `data/spells.yaml` | Rien, mais **séquentiel avec C4** (mêmes `spellSchema.ts` + `spells.yaml`). |
| C4 | SPELL-02 (reste) — buffs/debuffs/pièges | `engine/combat/heal.ts` (pour mémoire), nouveau moteur d'effets dans `multiCombat/`, `combatLoop/spellSupport.ts`, `schemas/spellSchema.ts`, `data/spells.yaml`, `store/battleSelectors.ts` | C3 mergée (mêmes schéma et données) **et #184 mergée** (`battleSelectors.ts` tenu) ; le soin est déjà livré par #179. |
| C5 | COMBAT-06 — fin de tour | `engine/multiCombat/turn.ts`, `multiCombat/types.ts`, `schemas/spellSchema.ts`, `data/spells.yaml` | C3 **et** C4 mergées : un tick n'a rien à décrémenter avant. |
| C6 | DATA-02 (moteur) | *déjà livré* (#177, `0754f15`) | — |
| C7 | ARCH-03 — déduplication | `engine/battleBridge/fromExploration.ts`, `engine/dungeon/combatants.ts` | Rien (zone moteur libre) ; à faire **avant** C9. |
| C8 | DEC-12 étape 4a — défaut `unified` | `src/dev/combatEngineFlag.ts`, `store/useCombatStore.ts` | **B1 mergée** : donjon et exploration doivent partager le même dock avant de basculer le défaut. |
| C9 | DEC-12 étape 4b — suppression de `combatLoop` | `src/engine/combatLoop/**`, `tests/` | **Parité complète** : C7 mergée, C8 livrée, zéro occurrence de `engine/combatLoop` dans `src` et `tests`, goldens réécrits à valeurs conservées. |

## Dépendances à respecter

| Contrainte | Raison |
| --- | --- |
| **#182 avant RENDER-04** | `battleSceneModel.ts` / `combatSceneModel.ts` sont tenus par la PR d'animations ; deux peintres sur le même modèle se contredisent. |
| **`design/sell-ui` avant tout chantier qui ajoute une entrée dans `App.tsx`** | Ses fichiers actuels (overlay + inventaire) ne collisionnent pas, mais elle peut ajouter son ouverture dans `App.tsx` ; revérifier avant de partir. |
| **3b-3 avant l'étape 4a** | Basculer le défaut sur `unified` sans dock partagé laisserait le donjon sur un HUD et l'exploration sur un autre. |
| **ARCH-04 avant toute nouvelle IA** | Les distances et drapeaux restent en dur (`ai.ts:22-28`) : changer les données ne prouverait pas que l'IA suit. |
| **SPELL-01 et SPELL-02 avant COMBAT-06** | Un tick de durée ou de zone n'a rien à décrémenter tant que les effets et les états n'existent pas. |
| **SPELL-02 avec UI-16** | Retirer `hasMissingState` n'a de sens qu'une fois les états réellement appliqués. |
| **ARCH-03 avant l'étape 4b** | Supprimer `combatLoop` avec deux copies de la formule d'initiative laisse la divergence vivante. |
| **ARCH-02 clos (#174) avant l'étape 4b** | L'écran de fin unifié existe : un écran oublié ne perd plus ses récompenses. |
| **#184 avant C2 et C4** | `battleSelectors.ts` est tenu par la PR `castsPerTarget` ; SPELL-04 et SPELL-02 y écrivent aussi. |
| **A2 avant B2** | Le coût PM n'a rien à afficher tant que `battleSceneModel.ts` renvoie `path: []`. |
| **C2 avant B3** | Le choix du sort en 1vN est une règle de moteur ; l'UI ne fait que l'exposer. |

## Vagues déjà livrées

| Vague | Périmètre | État |
| --- | --- | --- |
| 0 — P0 | COMBAT-01, COMBAT-02, COMBAT-04 | ✅ 3 sur 3 |
| 1 — P1 courts | GRID-01, BALANCE-01, COMBAT-08, RENDER-02, UI-03, UI-02, GRID-02, RENDER-03, RENDER-06, DATA-03 | ✅ 10 sur 10 |
| 1 — re-cadré | COMBAT-03 → MONSTER-01 | ✅ re-cadré (#148) |
| 2 — P1 moyens | ITEM-01, UI-01, UI-04, DATA-01, COMBAT-09, SPELL-09, MONSTER-01 | ✅ clos par #149, #156, #157, #163, #165, #167 |
| 3 — #168 à #181 | COMBAT-05 (#168), SPELL-03 (#171), ARCH-02 (#174), RENDER-01 (#170), COMBAT-07 (#175 + #178), UI-05 (#181) | ✅ 6 clos ; **partiels** : INPUT-01 (#173), DATA-02 (#177), SPELL-02 (#179, soin seul), GRID-03 (#166, 1v1) |

Total clos : **26** — dont **12** par les PR #154 à #181 (UI-01, UI-04, DATA-01,
COMBAT-09, MONSTER-01, SPELL-09, COMBAT-05, SPELL-03, ARCH-02, RENDER-01,
COMBAT-07, UI-05). GRID-03 est livré en 1v1 (#166) mais reste **partiel** : il
ne compte pas dans les clos.

## Règle d'exécution

1. **Un fix = une micro-PR = une branche = un worktree** (`fix/<slug>` ou
   `feat/<slug>`), jamais deux constats dans la même PR sauf dépendance
   explicite ci-dessus.
2. **Test RED d'abord** : le test décrit le comportement 1.29 attendu, il échoue
   pour la bonne raison.
3. Implémentation minimale, fonctions ≤ 10 lignes, aucune dérogation de lint.
4. `tests/walkthrough/` mis à jour si le comportement de jeu change ; toute PR
   d'IA prouve qu'une salle se termine (`tests/unit/battleRange.spec.ts`,
   `tests/unit/dungeonEntry.spec.ts`).
5. `npm run check` vert avant commit, commit `fix(<scope>): 🐛 …`.
6. PR ouverte, auditée par `qa-reviewer`, mergée par `pr-merger` — jamais en
   direct sur `main`.
7. **Une seule PR active par fichier tenu** : voir le tableau des verrous. Un
   agent ne travaille jamais dans l'arbre principal (voir `AUDIT/ISSUES.md` →
   notes de méthode).

## P2 — après les P1

Les **46 constats P2 ouverts** (42 sur les 77 initiaux + ARCH-03 + ARCH-04 +
CI-01 + UI-16) se traitent par lots de même domaine, sans jamais chevaucher une
zone tenue : `GRID-05`, `GRID-04`, `GRID-06/07/08/09` → `UI-06…UI-15` →
`RENDER-07…RENDER-15` → `ITEM-02…ITEM-07` → `DATA-04…DATA-09` →
`SPELL-05…SPELL-08` → `CI-01` → `TEST-01`.

`UI-06` est le journal sans auto-scroll ; **UI-16** (sorts `requiresState`) se
ferme avec SPELL-02, pas dans un lot UI autonome. `CI-01` est une dette de CI :
`data/*.yaml` n'est pas filtré par `ui-layout`, le risque est atténué par
`quality-gate` complet.

## Points d'arrêt (arbitrage propriétaire)

- **ARCH-01 / DEC-12 — en cours** : étapes 1 (#158), 2 (#160), 3a (#162),
  3b-1 (#164) et **3b-2 (#174, ARCH-02 clos)** livrées. Restent **3b-3** (dock
  de sorts partagé, B1) puis **l'étape 4** : 4a basculer le défaut sur
  `unified` (C8), 4b supprimer `combatLoop` **seulement après parité complète**
  (C9). Tant que l'étape 4 n'est pas livrée, chaque formule corrigée est
  appliquée **deux fois** et testée deux fois.
- **DEC-10** : la diagonale reste à 2 PM ; ne pas « corriger » vers 1 PM.
- **GRID-04** : le refus sec hors budget est une décision
  (`docs/design/PENDING.md:25-26`), pas une préférence d'implémentation.
- **SPELL-02** : le soin est livré (#179), pas les buffs/debuffs/pièges ; ne pas
  solder le constat sur un moteur d'effets partiel.
