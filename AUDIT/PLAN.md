# PLAN — ordre d'attaque

> Suite de `AUDIT/ISSUES.md` : **77 constats initiaux + 3 écarts découverts en
> cours de route**. La règle est la même pour chaque ligne, sans exception.
>
> **État au 2026-11-25, après les PR #154 à #167** : **21 constats clos**, **1
> re-cadré** (COMBAT-03 → MONSTER-01), **55 restants sur 77** ; les **3 écarts**
> (ARCH-02, ARCH-03, UI-16) sont ouverts. Total suivi : **80 constats, 58
> ouverts** (P0 : 0, P1 : 14, P2 : 44). Détail des hashes dans
> `AUDIT/ISSUES.md` → `## Suivi des merges`, méthode de comptage dans
> `AUDIT/ISSUES.md` → `## Comptage`.

## Reste en tête

Trois PR peuvent partir **en parallèle** parce qu'elles ne partagent aucun
fichier. C'est le seul mode autorisé : la nuit du 24/11 a produit des collisions
de worktree et de merge entre agents qui touchaient la même zone.

1. **UI-05 — le panneau de salle sort de l'arène** (voie B, `src/ui/**`). Un
   combattant caché et des cases non cliquables bloquent le jeu lui-même : c'est
   le premier correctif à impact immédiat.
2. **RENDER-01 — décor intercalé** (voie A, `src/renderer/**`). Le héros passe
   derrière les barils : la lecture de la scène est fausse avant même les sorts.
3. **SPELL-03 — critiques réels** (voie C, moteur). Le taux affiché ment
   aujourd'hui ; ITEM-01 est livré, donc `computeDamage` est prêt et la formule
   ne sera pas dupliquée.

Les trois chantiers suivants de chaque voie prennent le relais dès qu'une PR est
mergée, **dans l'ordre du tableau de sa voie**. Aucune voie n'attend les autres.

## Une seule voix par zone

| Voie | Zone exclusive | Interdiction |
| --- | --- | --- |
| **A — rendu** | `src/renderer/**` uniquement | Ne touche ni `src/ui/**`, ni `src/engine/**`. |
| **B — UI** | `src/ui/**` uniquement | Ne touche ni `src/renderer/**`, ni `src/engine/**`. |
| **C — moteur** | `src/engine/**`, `src/store/**`, `src/schemas/**`, `data/**` | Ne touche ni `src/renderer/**`, ni `src/ui/**`. |

**Règle de collision** : un chantier qui a besoin de deux zones est **coupé en
deux PR**. La seconde attend que la première soit mergée et que la zone soit
libre — c'est écrit dans la ligne du chantier (« puis UI » / « puis rendu »).
Deux agents ne prennent jamais la même voie en même temps, même pour deux
constats différents.

Rappel DEC-12 : **aucune nouvelle règle de combat dans
`src/engine/combatLoop/`**. Toute règle s'implémente dans
`src/engine/multiCombat/` ; l'ancien moteur ne reçoit que des correctifs de
parité déjà planifiés.

## Voie A — `src/renderer/**`

Ordre strict : chaque ligne attend la précédente (mêmes fichiers de scène).

| Ordre | ID | Effort | Fichiers touchés | Pourquoi maintenant |
| --- | --- | --- | --- | --- |
| A1 | RENDER-01 | M | `sceneLayerOrder.ts`, `sceneLayers.ts`, `scene.ts`, `decorPaint.ts`, `mapDecor.ts` ; tests `sceneStageOrder.spec.ts`, `rendererScene.spec.ts` | Tri `x+y` commun acteurs + décor. RENDER-03 (murs lisibles) est livré, le prérequis tient. |
| A2 | RENDER-04 | M | `tileStyle.ts`, `tilePaint.ts`, `scene.ts`, `combatSceneModel.ts`, `battleSceneModel.ts` | Remplacer la nappe opaque de portée par un contour alpha 0,18 teinté par élément. |
| A3 | INPUT-01 | M | `pointer.ts`, `useCombatPointer.ts`, `entityHover.ts`, `sprites/EntitySprite.ts` ; test `pointerPicking.spec.ts` | Hit-test des jetons **avant** `isoToGrid` : sans lui, l'ennemi n'est pas attaquable à la souris. |
| A4 | RENDER-05 | M | `battleSceneModel.ts`, `tokens.ts`, `sceneLayers.ts` ; test `battleScene.spec.ts` | `lastAction` typé + animations `attack`/`hit` en salle ; le modèle est déjà le même que le 1v1. |
| A5 | GRID-03 (reste) | S | `battleSceneModel.ts`, `pathPreview.ts` ; **puis** `src/ui/components/battle/BattlePanel.tsx` | Reste de GRID-03 : les salles renvoient encore `path: []`. Couper en deux PR, la seconde après libération de la voie B. |

## Voie B — `src/ui/**`

Ordre strict : UI-05 et ARCH-02 partagent `App.tsx` et `BattlePanel.tsx`, donc
jamais en parallèle.

| Ordre | ID | Effort | Fichiers touchés | Pourquoi maintenant |
| --- | --- | --- | --- | --- |
| B1 | UI-05 | M | `App.tsx`, `components/battle/battleTheme.ts`, `components/battle/BattlePanel.tsx` ; test `combatLayout.spec.ts` | Réserver une colonne dans le flux : le panneau ne recouvre plus l'arène ni ses cases. |
| B2 | ARCH-02 | M | `App.tsx`, `dockGate.ts`, `components/battle/BattlePanel.tsx`, `EndOverlay.tsx`, `RewardsSummary.tsx`, `LevelUpLine.tsx`, `VitalMeter.tsx` ; tests `battlePanel.spec.ts`, `dockContent.spec.ts` | Étape 3b-2 de DEC-12 : porter l'écran de fin dans le shell unifié ; débloque l'étape 4. |
| B3 | COMBAT-05 | M | `components/battle/BattlePanel.tsx`, `components/Timeline.tsx`, `components/TimelineCard.tsx` ; **puis** `src/renderer/battleViewModel.ts` | Afficher l'ordre d'initiative purgé des morts (COMBAT-04 livré). Seconde PR sur la voie A une fois celle-ci libre. |

## Voie C — moteur (`src/engine/**`, `src/store/**`, `data/**`)

Ordre par impact/effort (DEC-01) : les `M` d'abord, les `L` ensuite.

| Ordre | ID | Effort | Fichiers touchés | Pourquoi maintenant |
| --- | --- | --- | --- | --- |
| C1 | SPELL-03 | M | `multiCombat/crit.ts`, `multiCombat/strike.ts`, `schemas/spellSchema.ts`, `data/spells.yaml`, `store/battleSelectors.ts` | ITEM-01 livré : `critRate`/`critDamage` en data et jet max, sans dupliquer `computeDamage`. |
| C2 | SPELL-04 | M | `store/useCombatStore.ts`, `store/battleSelectors.ts`, `multiCombat/attack.ts`, `multiCombat/spellUse.ts` ; puis UI `components/battle/CombatantCard.tsx` | Choix du sort + `targetCell` en 1vN, téléportation incluse. Le volet UI est une seconde PR (voie B). |
| C3 | COMBAT-07 | M | `multiCombat/enemies.ts`, `store/battleSelectors.ts`, `schemas/monsterSchema.ts`, `data/monsters.yaml` | Brancher `archetype`/`preferredDistance` : les `ai:` des monstres ne sont toujours pas lus. |
| C4 | DATA-02 | M | `store/useGameStore.ts`, `engine/economy/*`, `engine/inventory/*`, `data/items.yaml` ; puis UI `components/inventory/*` | Le crédit est livré (#157) ; il reste l'action de vente. Le volet UI est une seconde PR (voie B). |
| C5 | SPELL-02 | L | `multiCombat/` (nouveau moteur d'effets), `schemas/spellSchema.ts`, `data/spells.yaml`, `store/battleSelectors.ts`, `store/useCombatStore.ts` | 18 sorts utilitaires inertes (soin, buff, debuff, piège, glyphe). Débloque COMBAT-06 et ferme UI-16. |
| C6 | SPELL-01 | L | `multiCombat/range.ts`, nouveau `multiCombat/zone.ts`, `schemas/spellSchema.ts`, `data/spells.yaml` | `zone {shape,size}` + `expandZone` pur : croix, cercle, ligne. Indépendant de SPELL-02. |
| C7 | COMBAT-06 | L | `multiCombat/turn.ts`, `multiCombat/types.ts`, `schemas/spellSchema.ts`, `data/spells.yaml` | Hook `endTurn` pur (poison, régénération, durées) : après SPELL-01/02, sans quoi un tick n'a rien à décrémenter. |

## Vagues déjà livrées

| Vague | Périmètre | État |
| --- | --- | --- |
| 0 — P0 | COMBAT-01, COMBAT-02, COMBAT-04 | ✅ 3 sur 3 |
| 1 — P1 courts | GRID-01, BALANCE-01, COMBAT-08, RENDER-02, UI-03, UI-02, GRID-02, RENDER-03, RENDER-06, DATA-03 | ✅ 10 sur 11 |
| 1 — re-cadré | COMBAT-03 → MONSTER-01 | ✅ re-cadré (#148, `89d9886`) |
| 2 — P1 moyens | ITEM-01 | ✅ fait (#149, `9c7dd8a`) |
| 2 — P1 moyens | UI-01, UI-04, GRID-03, DATA-01 | ✅ clos par #156, #165, #166, #157 |
| 2 — P2 | MONSTER-01, COMBAT-09, SPELL-09 | ✅ clos par #163 + #167, #157, #156 |

Total clos : **21** — dont **7** par les PR #154 à #167 (UI-01, UI-04,
GRID-03, DATA-01, COMBAT-09, MONSTER-01, SPELL-09).

## Règle d'exécution

1. **Un fix = une micro-PR = une branche = un worktree** (`fix/<slug>` ou
   `feat/<slug>`), jamais deux constats dans la même PR sauf dépendance
   explicite ci-dessous.
2. **Test RED d'abord** : le test décrit le comportement 1.29 attendu, il échoue
   pour la bonne raison.
3. Implémentation minimale, fonctions ≤ 10 lignes, aucune dérogation de lint.
4. `tests/walkthrough/` mis à jour si le comportement de jeu change.
5. `npm run check` vert avant commit, commit `fix(<scope>): 🐛 …`.
6. PR ouverte, auditée par `qa-reviewer`, mergée par `pr-merger` — jamais en
   direct sur `main`.
7. **Une seule PR active par voie** : les agents qui partagent une zone se
   succèdent, ils ne se chevauchent pas.

## P2 — après les P1

Les **44 constats P2 ouverts** (42 sur les 77 initiaux + ARCH-03 + UI-16) se
traitent par lots de même domaine, dans l'ordre : `GRID-05`, `GRID-04`,
`GRID-06/07/08/09` → `UI-06…UI-15` → `RENDER-07…RENDER-15` → `ITEM-02…ITEM-07`
→ `DATA-04…DATA-09` → `SPELL-05…SPELL-08` → `ARCH-03` → `TEST-01`.

`UI-06` est le journal sans auto-scroll ; **UI-16** (sorts `requiresState` non
gérés) se ferme avec SPELL-02, pas dans un lot UI autonome. Aucun P2 n'est un
prérequis d'une vague P1, sauf ARCH-03 qui clôt DEC-12 après l'étape 3b-2.

## Dépendances à respecter

| Contrainte | Raison |
| --- | --- |
| **COMBAT-04 avant COMBAT-05** | Afficher un `order` qui contient encore les morts produirait une timeline fausse. (COMBAT-04 livré.) |
| **RENDER-02 avant RENDER-09** | Sans DPR réglé, aucun réglage d'échelle de sprite n'est mesurable. (RENDER-02 livré.) |
| **ITEM-01 avant SPELL-03** | Critiques et résistances partagent `computeDamage` ; corriger l'un sans l'autre duplique la formule. (ITEM-01 livré.) |
| **ITEM-01 avant SPELL-08** | La poussée doit passer par la même formule de dégâts. (ITEM-01 livré.) |
| **SPELL-02 avant COMBAT-06** | Un tick de durée n'a rien à décrémenter tant que les effets et les états n'existent pas. |
| **SPELL-01 avant COMBAT-06** | Les glyphes/pièges sont des zones : sans `zone`, pas de tick de zone. |
| **UI-05 avant ARCH-02** | Les deux touchent `App.tsx` et `BattlePanel.tsx` ; poser l'écran de fin dans un panneau qui recouvre encore l'arène aggraverait le défaut. |
| **SPELL-02 avec UI-16** | Retirer `hasMissingState` n'a de sens qu'une fois les états réellement appliqués. |
| **ARCH-02 avant ARCH-03** | On ne supprime pas `combatLoop` avant que l'écran de fin unifié existe : un écran oublié perdrait ses récompenses. |
| **RENDER-03 avant RENDER-01** | Un décor intercalé avec des murs à une face reste illisible. (RENDER-03 livré.) |
| **GRID-01 avant BALANCE-01** | La portée Chebyshev change l'atteignabilité en salle : le soin entre salles se recalibre **après** elle. (Les deux sont livrés.) |
| **DATA-01 avec COMBAT-09** | Même point de crédit en fin de salle. (Les deux sont livrés par #157.) |

## Points d'arrêt (arbitrage propriétaire)

- **ARCH-01 / DEC-12 — en cours** : étapes 1 (#158), 2 (#160), 3a (#162) et
  3b-1 (#164) livrées. Restent **3b-2** (ARCH-02 : écran de fin unifié) et
  **4** (ARCH-03 : suppression de `combatLoop`). Tant que l'étape 4 n'est pas
  livrée, chaque formule corrigée est appliquée **deux fois** et testée deux
  fois.
- **DEC-10** : la diagonale reste à 2 PM ; ne pas « corriger » vers 1 PM.
- **GRID-04** : le refus sec hors budget est une décision
  (`docs/design/PENDING.md:25-26`), pas une préférence d'implémentation.
