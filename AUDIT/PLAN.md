# PLAN — ordre d'attaque

> Suite de `AUDIT/ISSUES.md` : **77 constats initiaux + 5 écarts découverts en
> cours de route**, soit **82 constats suivis**. La règle est la même pour chaque
> ligne, sans exception.
>
> **État au 2026-11-25, après la nuit #168 à #180** : **24 constats clos**, **4
> partiels** (INPUT-01, DATA-02, COMBAT-07, GRID-03), **1 re-cadré**
> (COMBAT-03 → MONSTER-01), **53 ouverts** (P0 : 0, P1 : 7, P2 : 46). Détail des
> hashes dans `AUDIT/ISSUES.md` → `## Suivi des merges` ; PR encore ouvertes dans
> `AUDIT/ISSUES.md` → `## PR ouvertes` ; méthode de comptage dans
> `AUDIT/ISSUES.md` → `## Comptage`.

## Règle d'ordonnancement

La file est découpée **par zone de fichiers**, pas par sévérité. Deux agents ne
prennent jamais la même zone en même temps : ils se succèdent dans l'ordre du
tableau. Un chantier qui a besoin de deux zones est **coupé en deux PR** ; la
seconde attend que la première soit mergée et que la zone soit libre.

| Zone | Chemins exclusifs | Interdiction |
| --- | --- | --- |
| **A — rendu** | `src/renderer/**` | Ne touche ni `src/ui/**`, ni `src/engine/**`. |
| **B — UI** | `src/ui/**` | Ne touche ni `src/renderer/**`, ni `src/engine/**`. |
| **C — moteur** | `src/engine/**`, `src/store/**`, `src/schemas/**`, `data/**` | Ne touche ni `src/renderer/**`, ni `src/ui/**`. |

Rappel DEC-12 : **aucune nouvelle règle de combat dans
`src/engine/combatLoop/`**. Toute règle s'implémente dans
`src/engine/multiCombat/` ; l'ancien moteur ne reçoit que des correctifs de
parité déjà planifiés. L'étape 4 (suppression) ne part qu'après parité complète.

## PR ouvertes — à absorber avant d'ouvrir une ligne

Aucune de ces branches n'est mergée : leur périmètre **n'est pas** compté comme
livré dans `AUDIT/ISSUES.md`.

| PR | Zone | Chantier | Conséquence pour la file |
| --- | --- | --- | --- |
| **#181** | B | UI-05 — réserver une colonne au panneau de salle | Occupe `src/ui/**` : la zone B attend son merge (ou son abandon) avant B2. |
| **#179** | C | SPELL-02 — sorts de soin | Occupe le moteur d'effets : ne pas ouvrir SPELL-02 en parallèle ; ne ferme que le soin. |
| **#178** | C | COMBAT-07 — portée de la Marmite | Occupe `data/` : à merger avant de fermer COMBAT-07. |

## Zone A — `src/renderer/**`

Ordre strict : chaque ligne attend la précédente (mêmes fichiers de scène).

| Ordre | ID | Effort | Fichiers touchés | Pourquoi maintenant |
| --- | --- | --- | --- | --- |
| A1 | RENDER-04 | M | `tileStyle.ts`, `tilePaint.ts`, `scene.ts`, `combatSceneModel.ts`, `battleSceneModel.ts` | Remplacer la nappe opaque de portée (`tileStyle.ts:65-79`) par un contour alpha 0,18 teinté par élément. RENDER-01 est livré : le décor est désormais intercalé, la portée le masque encore. |
| A2 | RENDER-05 | M | `battleSceneModel.ts:104`, `tokens.ts`, `sceneLayers.ts`, `combatSceneModel.ts` | `lastAction` vaut encore `null` en salle (`battleSceneModel.ts:37,104`) : aucune animation `attack`/`hit`. Le 1v1 a déjà `lastActionFrom` (`combatSceneModel.ts:165`). |
| A3 | GRID-03 (reste rendu) | S | `battleSceneModel.ts`, `pathPreview.ts` | Le modèle de salle renvoie `path: []` (`battleSceneModel.ts:104`) : brancher `buildPathPreview` sur le survol de salle. Le volet UI suit en B3, après libération de la zone. |

## Zone B — `src/ui/**`

Ordre strict : UI-05, 3b-3 et l'écran de fin partagent `App.tsx`,
`BattlePanel.tsx` et `battleTheme.ts`, donc jamais en parallèle.

| Ordre | ID | Effort | Fichiers touchés | Pourquoi maintenant |
| --- | --- | --- | --- | --- |
| B1 | UI-05 | M | `App.tsx`, `components/battle/battleTheme.ts:15`, `components/battle/BattlePanel.tsx` ; test `combatLayout.spec.ts` | **PR #181 ouverte** : le panneau est encore `absolute` sur l'arène et bloque des cases. Réserver une colonne dans le flux. Premier impact de jouabilité. |
| B2 | 3b-3 — dock de sorts partagé | M | `App.tsx:188`, `dockGate.ts:21-30`, `components/battle/BattleSpellDock.tsx`, `components/battle/BattlePanel.tsx` | Le dock unifié n'existe qu'en exploration (`dockGate.ts:21-25`) ; un donjon garde son dock historique. Partager un seul dock donjon + exploration avant de basculer le défaut. |
| B3 | GRID-03 (reste UI) | S | `components/battle/BattlePanel.tsx`, `components/battle/battleTheme.ts` | Afficher le coût PM du chemin fourni par A3. Seconde PR, après A3 mergée et zone A libérée. |
| B4 | DATA-02 (écran de vente) | M | `components/inventory/BackpackList.tsx`, `components/inventory/EquipmentSlots.tsx` ; **moteur déjà livré** | `sellItem` est branché au store (`useGameStore.ts:89,307`) mais aucun composant ne l'appelle : la monnaie reste inaccessible. L'écran est la dernière brique de DATA-02. |
| B5 | SPELL-04 (volet UI) | M | `components/battle/CombatantCard.tsx`, `components/SpellSlots.tsx` | Choisir le sort et la case cible en 1vN. Seconde PR, après C3 (moteur). |
| B6 | UI-16 | S | `spellSlotState.ts:32,111-114` | Retirer `hasMissingState` une fois SPELL-02 livré (C5) : l'UI cesse d'annoncer une dette qui n'existe plus. |

## Zone C — `src/engine/**`, `src/store/**`, `src/schemas/**`, `data/**`

Ordre par dépendance réelle, pas par effort : la convergence des archétypes
d'abord, puis les sorts, puis la suppression de l'ancien moteur.

| Ordre | ID | Effort | Fichiers touchés | Pourquoi maintenant |
| --- | --- | --- | --- | --- |
| C1 | ARCH-04 — convergence des archétypes | S | `engine/multiCombat/ai.ts:22-30`, `schemas/monsterSchema.ts`, `data/monsters.yaml` | Les distances 1/2/4 et les drapeaux `rushes`/`aggressive` vivent en dur alors que `preferredDistance` est déjà une donnée. Lire le comportement depuis `data/` avant de retoucher l'IA ; débloque la fermeture de COMBAT-07. |
| C2 | COMBAT-07 (reste données) | S | `data/spells.yaml:107-115`, `data/monsters.yaml:119-120` | **PR #178 ouverte** : `maxRange: 1` face à `preferredDistance: 4`. La merger, puis vérifier que la Marmite agit à sa distance. #180 a déjà supprimé le softlock. |
| C3 | SPELL-04 (moteur) | M | `store/useCombatStore.ts`, `store/battleSelectors.ts`, `multiCombat/attack.ts`, `multiCombat/spellUse.ts` | Choix du sort + `targetCell` en 1vN, téléportation incluse. Le volet UI est B5. |
| C4 | SPELL-01 | L | `multiCombat/range.ts`, nouveau `multiCombat/zone.ts`, `schemas/spellSchema.ts`, `data/spells.yaml` | `zone {shape,size}` + `expandZone` pur : croix, cercle, ligne. Indépendant de SPELL-02, mais précède COMBAT-06 (glyphes/pièges). |
| C5 | SPELL-02 | L | `multiCombat/` (moteur d'effets), `schemas/spellSchema.ts`, `data/spells.yaml`, `store/battleSelectors.ts`, `store/useCombatStore.ts` | 18 sorts utilitaires inertes (`combatLoop/spellSupport.ts:9`). **PR #179 ouverte** pour le soin seul : la compléter (buff, debuff, piège) sans dupliquer le heal. Débloque UI-16. |
| C6 | COMBAT-06 | L | `multiCombat/turn.ts`, `multiCombat/types.ts`, `schemas/spellSchema.ts`, `data/spells.yaml` | Hook `endTurn` pur (poison, régénération, durées) : après C4 et C5, sans quoi un tick n'a rien à décrémenter. |
| C7 | ARCH-03 — déduplication | M | `engine/battleBridge/fromExploration.ts:45-57`, `engine/dungeon/combatants.ts:49-62` | `copyResistances` et l'initiative existent en double. À faire **avant** la suppression de `combatLoop` : sinon la formule survit dans deux fichiers et le départage reste invisible. |
| C8 | DEC-12 étape 4a — défaut `unified` | S | `src/dev/combatEngineFlag.ts`, `store/useCombatStore.ts` | Basculer **le défaut** de `legacy` à `unified`, drapeau encore accepté pour revenir en arrière. À faire seulement après 3b-3 (B2) : donjon et exploration doivent partager le même dock. |
| C9 | DEC-12 étape 4b — suppression de `combatLoop` | L | `src/engine/combatLoop/` (15 fichiers, 27 fichiers de `src/` l'importent), `tests/` | Supprimer `combatLoop`, `CombatState`/`CombatRewards` et `VITE_COMBAT_ENGINE` **seulement après parité complète** : zéro occurrence de `engine/combatLoop` dans `src` et `tests`, goldens réécrits à valeurs conservées, donjon et exploration d'un même monstre donnant les mêmes CC/tacle/dégâts. |

## Dépendances à respecter

| Contrainte | Raison |
| --- | --- |
| **UI-05 avant 3b-3** | Les deux touchent `App.tsx` et `BattlePanel.tsx` ; poser un dock partagé dans un panneau qui recouvre encore l'arène aggrave le défaut. |
| **3b-3 avant l'étape 4a** | Basculer le défaut sur `unified` sans dock partagé laisserait le donjon sur un HUD et l'exploration sur un autre. |
| **ARCH-04 avant la fermeture de COMBAT-07** | Tant que les archétypes sont en dur, changer les données ne prouve pas que l'IA suit. |
| **#178 mergée avant la fermeture de COMBAT-07** | La portée de la Marmite est une donnée, pas une règle de code. |
| **SPELL-01 et SPELL-02 avant COMBAT-06** | Un tick de durée ou de zone n'a rien à décrémenter tant que les effets et les états n'existent pas. |
| **SPELL-02 avec UI-16** | Retirer `hasMissingState` n'a de sens qu'une fois les états réellement appliqués. |
| **ARCH-03 (dédup) avant l'étape 4b** | Supprimer `combatLoop` avec deux copies de la formule d'initiative laisse la divergence vivante. |
| **ARCH-02 clos (#174) avant l'étape 4b** | L'écran de fin unifié existe : un écran oublié ne perd plus ses récompenses. |
| **A3 avant B3** | Le coût PM n'a rien à afficher tant que le modèle de salle renvoie `path: []`. |
| **C3 avant B5** | Le choix du sort en 1vN est une règle de moteur ; l'UI ne fait que l'exposer. |
| **C2 (donnée) avant de retirer le repli #180** | Le repli existe pour une donnée incohérente ; le retirer avant #178 rejouerait le softlock. |
| **ARCH-01 / DEC-12 complet avant C9** | On ne supprime pas `combatLoop` avant parité complète et bascule du défaut. |

## Vagues déjà livrées

| Vague | Périmètre | État |
| --- | --- | --- |
| 0 — P0 | COMBAT-01, COMBAT-02, COMBAT-04 | ✅ 3 sur 3 |
| 1 — P1 courts | GRID-01, BALANCE-01, COMBAT-08, RENDER-02, UI-03, UI-02, GRID-02, RENDER-03, RENDER-06, DATA-03 | ✅ 10 sur 10 |
| 1 — re-cadré | COMBAT-03 → MONSTER-01 | ✅ re-cadré (#148) |
| 2 — P1 moyens | ITEM-01, UI-01, UI-04, DATA-01, COMBAT-09, SPELL-09, MONSTER-01 | ✅ clos par #149, #156, #157, #163, #165, #167 |
| 3 — nuit #168 à #180 | COMBAT-05 (#168), SPELL-03 (#171), ARCH-02 (#174), RENDER-01 (#170) | ✅ 4 clos ; **partiels** : INPUT-01 (#173), COMBAT-07 (#175), DATA-02 (#177) ; **GRID-03** reste 1v1 (#166) |

Total clos : **24** — dont **10** par les PR #154 à #180 (UI-01, UI-04, DATA-01,
COMBAT-09, MONSTER-01, SPELL-09, COMBAT-05, SPELL-03, ARCH-02, RENDER-01).
GRID-03 est livré en 1v1 (#166) mais reste **partiel** : il ne compte pas dans
les clos.

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
7. **Une seule PR active par zone** : les agents qui partagent une zone se
   succèdent, ils ne se chevauchent pas. Un agent ne travaille jamais dans
   l'arbre principal (voir `AUDIT/ISSUES.md` → notes de méthode).

## P2 — après les P1

Les **46 constats P2 ouverts** (42 sur les 77 initiaux + ARCH-03 + ARCH-04 +
CI-01 + UI-16) se traitent par lots de même domaine, sans jamais chevaucher une
zone P1 active : `GRID-05`, `GRID-04`, `GRID-06/07/08/09` → `UI-06…UI-15` →
`RENDER-07…RENDER-15` → `ITEM-02…ITEM-07` → `DATA-04…DATA-09` →
`SPELL-05…SPELL-08` → `CI-01` → `TEST-01`.

`UI-06` est le journal sans auto-scroll ; **UI-16** (sorts `requiresState`) se
ferme avec SPELL-02, pas dans un lot UI autonome. `CI-01` est une dette de CI :
`data/*.yaml` n'est pas filtré par `ui-layout`, le risque est atténué par
`quality-gate` complet — à traiter quand aucune PR d'interface n'occupe la CI.

## Points d'arrêt (arbitrage propriétaire)

- **ARCH-01 / DEC-12 — en cours** : étapes 1 (#158), 2 (#160), 3a (#162),
  3b-1 (#164) et **3b-2 (#174, ARCH-02 clos)** livrées. Restent **3b-3** (dock
  de sorts partagé, B2) puis **l'étape 4** : 4a basculer le défaut sur
  `unified`, 4b supprimer `combatLoop` **seulement après parité complète**
  (C8 → C9). Tant que l'étape 4 n'est pas livrée, chaque formule corrigée est
  appliquée **deux fois** et testée deux fois.
- **DEC-10** : la diagonale reste à 2 PM ; ne pas « corriger » vers 1 PM.
- **GRID-04** : le refus sec hors budget est une décision
  (`docs/design/PENDING.md:25-26`), pas une préférence d'implémentation.
- **#179** : le soin seul ne ferme pas SPELL-02 ; ne pas solder le constat sur
  un moteur d'effets partiel.
