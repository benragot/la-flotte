---
title: Unification du combat — un seul moteur (DEC-12)
status: plan
source: analyse de code sur `main` @ 2d14f78
tags: [combat, architecture, dec-12, migration]
---

# Unification du combat — un seul moteur (DEC-12)

> **Décision normative** : `docs/design/DECISIONS.md` **DEC-12**. Un seul moteur
> de combat ; donjon et extérieur partagent exactement les mêmes règles.
> Toute nouvelle règle s'implémente dans `multiCombat`, **jamais** dans
> `combatLoop`.
>
> Cette fiche est un **plan**. La PR qui la livre ne change aucun comportement :
> elle ajoute le filet de tests golden (`tests/unit/combatParity.spec.ts`,
> `tests/unit/multiCombatParity.spec.ts`) et grave la décision.

## 1. État des lieux — deux moteurs, deux jeux de règles

Il existe aujourd'hui deux moteurs complets et indépendants :

- **1v1 exploration** — `src/engine/combatLoop/` (`CombatState`, `player` +
  `enemy`, phases `player_turn`/`enemy_turn`/`victory`/`defeat`), branché par
  `src/store/useCombatStore.ts:281-301` (`buildCombat`/`buildGroupCombat`).
- **1vN donjon** — `src/engine/multiCombat/` (`BattleState`, timeline,
  `combatants[]`), branché par `src/store/useCombatStore.ts:514-523`
  (`battleFromRoom`) et `src/ui/App.tsx:186` (`BattlePanel`).

Les deux partagent déjà les briques **pures** de `src/engine/grid/`
(pathfinding, DEC-10, LoS, portée) et `src/engine/combat/` (dégâts, critique,
tacle, initiative, poussée). Ce qui diffère, c'est **ce que chaque moteur
appelle** — vérifié dans le code, pas supposé :

| Règle | 1v1 `combatLoop` | 1vN `multiCombat` | Preuve |
| --- | --- | --- | --- |
| Initiative | calculée à l'ouverture seulement (`initiativeOf`), égalité ⇒ héros | timeline triée, égalité ⇒ id le plus petit | `combatLoop/opening.ts:9-18` ; `multiCombat/timeline.ts:9-27` |
| Ordre des tours | alternance stricte joueur → ennemi ; pas de timeline | `advanceTurn` saute les morts, restaure PA/PM, tour +1 au bouclage | `combatLoop/turn.ts:36-42` ; `multiCombat/turn.ts:37-45` |
| Tacle | **absent** : `moveActiveEntity(state, target)` n'a pas de `rng` | **présent** : jugé à chaque pas, 4 orthogonales, 1 PM | `combatLoop/move.ts:24-31` ; `multiCombat/tackle.ts:9,30-84` |
| Coup critique | **absent** : `rollDamage` puis `computeDamage`, aucun `computeCritRate` | **présent** : ≥ 100 % garanti sans jet, sinon `rng()×100 < taux`, `critDamagePct` | `combatLoop/cast.ts:98-103,132-150` ; `multiCombat/crit.ts:27-31` |
| Attaque de base | **absente** : tout passe par un `SpellDef` | possible (`resolveAttack` sans `spellId`), mais l'UI n'expose que le premier sort de dégâts | `combatLoop/cast.ts:177-184` ; `multiCombat/attack.ts:75-81` ; `store/battleSelectors.ts:79-83` |
| Sorts et quotas | `castsPerTurn`/`cooldown` dans `spellUsage` | idem via `isAttackAvailable`/`recordAttack` | `combatLoop/cast.ts:65-96` ; `multiCombat/spellUse.ts:21-44` |
| Portée / LoS | Chebyshev `rangeDistance`, LoS `hasLineOfSight`, murs seuls | idem, avec refus typé `too-close`/`out-of-range`/`no-los` | `combatLoop/castable.ts:16-41` ; `multiCombat/range.ts:33-66` |
| Déplacement / PM | chemin réel, DEC-10 (1 PM orthogonal, 2 PM diagonal), refus en bloc | même facture, mais pas par pas avec tacle | `combatLoop/move.ts:12-31` ; `multiCombat/move.ts:96-153` |
| Poussée | `applyPush` sans tiers, dégâts de collision si bloqué | `applyPush` avec cases des tiers vivants | `combatLoop/push.ts:65-72` ; `multiCombat/move.ts` (via `strike.ts`) |
| Occupation | impossible par construction (2 combattants) | invariant « aucune case partagée » + `separateOccupants` | `multiCombat/overlap.ts:120-129` |
| Récompenses | XP (H=M, un monstre), butin, prospection, niveau ; **aucun kamas** | **aucune** récompense moteur ; une salle = soin DEC-03 + avancement du run | `combatLoop/rewards.ts:81-87` ; `dungeon/heal.ts:29-32` ; `dungeon/run.ts:71-77` |
| IA ennemie | boucle codée en dur, 12 actions max, premier sort payable et à portée, sinon approche | stratégie **injectée**, 10 actions max, `spellStrategy` distance-aware | `combatLoop/enemy.ts:12,78-86` ; `multiCombat/enemies.ts:9-10,141-143` ; `store/battleSelectors.ts:255-258` |
| Victoire / défaite | phase posée par `applyHit` ; le store crédite puis restaure les PV | `isVictory`/`isDefeat` ; le store clôt la salle ou le run | `combatLoop/cast.ts:140-150` ; `store/useCombatStore.ts:333-339,479-498` ; `multiCombat/outcome.ts:10-17` |
| Nombres flottants | `appendFloat` | `appendFloat` | `combat/floating.ts:38-43` (partagé) |

**Conséquence directe** : un correctif de formule appliqué dans un seul moteur
laisse l'autre diverger. Les écarts GRID-04/05 et SPELL-04 déjà constatés
viennent de là (`AUDIT/ISSUES.md`).

## 2. Ce que la migration doit préserver (filet de tests, étape 1)

Chaque test golden porte un commentaire `// PARITÉ:` qui dit ce qui ne doit pas
disparaître. Valeurs figées aujourd'hui :

### `tests/unit/combatParity.spec.ts` — 1v1 actuel (15 tests)

| Sujet | Valeur figée |
| --- | --- |
| Ouverture | héros plus rapide ⇒ `player_turn` (identité) ; égalité ⇒ héros ; monstre 15 vs héros 0 ⇒ `enemy_turn`, journal `« initiative 15 vs 0 »`, tour 1 |
| Dégâts | Pression, rng 0 ⇒ 8 dégâts (35 → 27 PV), 3 PA ; résistances fixes 2 + 25 % ⇒ 4 dégâts (31 PV) ; rng 0,99 ⇒ 12 dégâts (23 PV) |
| Critique | **absent** : 1 seul `rng()` consommé, même à 100 000 d'Agilité, dégâts inchangés |
| Tacle | **absent** : au contact, le héros s'éloigne, paie 1 PM de chemin, aucun PM de tacle |
| Déplacement | orthogonal 1 PM ; diagonal 2 PM ; deux diagonales (4 PM) refusées avec 3 PM |
| Victoire | 120 XP, niveau 2, `levelUp {hp:5, capitalPoints:5, spellPoints:1}`, prospection 100, butin `[plume_mazoutee, fer_goutte_mazout]` ; **aucun champ kamas** |
| Défaite | phase `defeat`, PV du héros restaurés au max, sauvegarde d'un vivant (aucun 0 persisté) |

### `tests/unit/multiCombatParity.spec.ts` — 1vN actuel (14 tests)

| Sujet | Valeur figée |
| --- | --- |
| Timeline | `[zz_fast 300, aaa_tie 120, bbb_tie 120]` ; saut des morts, PA/PM restaurés, tour +1 au bouclage |
| Tacle | 0 % ⇒ tacle certain (1 PM) ; 100 % ⇒ échappée (0 PM) ; diagonale non taclée ; tacle raté ⇒ arrêt sur place + 1 PM ; réussi ⇒ pas payé au prix du chemin |
| Critique | 20 base + 100 Agilité = 12 % ; seuil garanti 157 → non, 158 → oui ; garanti 200 ⇒ 0 jet, +50 % (200 → 185 PV) ; probabiliste 5 % → 185 PV, 50 % → 190 PV |
| Attaque nue | `AttackSpec` sans `spellId` : 200 → 190 PV, aucun `spellUsage` |
| Récompenses de salle | `ceil(max × 0,75)` borné au max (10/100 → 85 ; 90/100 → 100) ; salle nettoyée ⇒ `roomIndex` +1, aucun XP/kamas/butin ; salle incomplète ⇒ run par identité |

## 3. Cible

**`multiCombat` devient l'unique moteur.**

- L'exploration est un **`multiCombat` à un seul monstre** (`N = 1`) : même
  timeline (l'initiative décide qui ouvre **et** l'ordre), même tacle, même
  critique, même attaque de base, mêmes sorts, même portée/LoS, même poussée.
- Les récompenses d'exploration (XP, butin, prospection, niveau, respawn du
  groupe) remontent dans `multiCombat` (ou dans un module frère appelé par lui),
  pas dans l'UI.
- Il n'existe plus qu'un `BattleState`. `CombatState` disparaît.
- Le donjon garde son soin entre salles (DEC-03) et son avancement de run : ce
  sont des **récompenses de scénario**, pas une exception aux règles de combat.

## 4. Quatre étapes

### Étape 1 — filet de tests (cette PR)

- **Livrables** : `tests/unit/combatParity.spec.ts` (15 tests),
  `tests/unit/multiCombatParity.spec.ts` (14 tests), la présente fiche, DEC-12.
- **Critère de sortie** : les 29 tests sont verts **sur le code actuel**, sans
  aucune modification de `src/` ; `npm run check` vert ; chaque test porte
  `// PARITÉ:`.
- **Risque de régression** : nul sur le jeu. Risque de **faux confort** : un
  golden mal placé fige un bug. Mitigation : chaque valeur est vérifiée dans le
  code cité, et la fiche nomme les cas qui changeront sciemment (tacle 1v1).

### Étape 2 — adaptateur + drapeau `VITE_COMBAT_ENGINE=unified`

- **Livrables** :
  - un adaptateur `Hero`→`CombatantLike` réutilisant `dungeon/combatants.ts`
    (`heroBattleCombatant`, `monsterCombatant`) et un `enemiesAct` dédié à
    l'exploration (même IA « Piou Mazouté », mais exprimée en `EnemyStrategy`) ;
  - `useCombatStore` : quand le drapeau vaut `unified`, `combatUpdate` construit
    un `BattleState` à **un** monstre au lieu d'un `CombatState` ; sinon
    `combatLoop` reste le repli ;
  - récompenses d'exploration appelées sur la victoire du `BattleState`.
- **Critère de sortie** : les 29 goldens restent verts en mode `legacy` ; un
  test de parité **différentiel** prouve qu'un même scénario donne les mêmes
  PV, PA/PM, positions et butin dans les deux modes (hors tacle/CC, qui sont
  ajoutés sciemment) ; `VITE_COMBAT_ENGINE` non défini = comportement actuel.
- **Risque de régression** : divergence silencieuse entre les deux chemins.
  Mitigation : le drapeau est lu **à un seul endroit**, et le différentiel est
  un test, pas une revue manuelle. Risque secondaire : l'IA d'exploration
  change de forme et approche différemment (chemin réel vs pas-à-pas) —
  comparer les positions finales, pas les lignes de journal.

### Étape 3 — bascule de l'UI d'exploration sur le shell unique

- **Référence : `BattlePanel`** (`src/ui/components/battle/BattlePanel.tsx`).
  Pourquoi : c'est le seul shell qui consomme déjà un `BattleState` et qui sait
  afficher **N** combattants via la timeline (`CombatantList`), les cibles
  multiples et le refus géométrique. `CombatHud` est câblé sur `CombatState`
  (`player`/`enemy`, phases, `rewards`) : le garder obligerait à réinventer une
  timeline dans une mise en page à deux emplacements.
- **Livrables** : `BattlePanel` récupère les briques d'exploration à préserver —
  `EndOverlay`, `RewardsSummary`, `LevelUpLine`, `SpellSlots`, bouton « Retour
  sur la carte » et `VitalMeter` — puis `App.tsx` n'affiche plus `CombatHud`
  hors exploration libre. L'exploration libre garde son HUD allégé.
- **Critère de sortie** : en mode `unified`, un combat d'exploration se joue
  entièrement dans `BattlePanel` (déplacement, sort, fin de tour, victoire,
  défaite, retour), sans `combat.phase` ; captures UI et tests de panneau
  (`battlePanel.spec.ts`, `combatLayout.spec.ts`, `dockContent.spec.ts`) à jour.
- **Risque de régression** : perte de lisibilité ou de fonctions du HUD 1v1
  (bouton « Retour », récompenses, sorts). Mitigation : portage **fonction par
  fonction** avant retrait, et `ui-designer` valide l'apparence (règle 7 de
  `AGENTS.md`). Aucune valeur de gameplay ne bouge ici.

### Étape 4 — suppression du drapeau et de `combatLoop`

- **Livrables** : suppression de `src/engine/combatLoop/` (14 fichiers),
  de `VITE_COMBAT_ENGINE`, de `CombatState`/`CombatRewards` ; migration des
  récompenses d'exploration dans `multiCombat` ; `useCombatStore` ne manipule
  plus qu'un `BattleState` ; suppression des tests de l'ancien moteur.
- **Critère de sortie** : `grep -r "engine/combatLoop" src tests` retourne
  **zéro** occurrence ; les 29 goldens ont été soit supprimés (redondants), soit
  réécrits sur le moteur unifié **en conservant leurs valeurs** ; `npm run
  check` vert ; un donjon et une exploration du même monstre donnent les mêmes
  chances de CC/tacle et les mêmes dégâts.
- **Risque de régression** : le plus élevé — suppression d'un chemin encore
  utilisé par un écran oublié. Mitigation : l'étape 2 a un drapeau, l'étape 3 a
  basculé l'UI, et la suppression est **mécanique** : le compilateur et le
  `grep` listent les derniers appelants. Aucun test n'est supprimé avant que son
  équivalent unifié soit vert.

## 5. Inventaire des fichiers et écrans à toucher

| Zone | Fichiers | Estimation |
| --- | --- | --- |
| Moteur | `src/engine/multiCombat/*` (récompenses, IA d'exploration, `N=1`), suppression `src/engine/combatLoop/*` | 1,0–1,5 j |
| Adaptateur / store | `src/store/useCombatStore.ts`, `src/store/battleSelectors.ts`, nouveau module de récompenses | 1,0–1,5 j |
| UI / rendu | `src/ui/App.tsx`, `src/ui/components/CombatHud.tsx`, `battle/BattlePanel.tsx`, `EndOverlay.tsx`, `RewardsSummary.tsx`, `SpellSlots.tsx`, `Timeline.tsx`, `TimelineCard.tsx`, `src/renderer/battleViewModel.ts` | 1,0–2,0 j (avec `ui-designer`) |
| Tests / walkthrough | `tests/unit/combatLoop.spec.ts`, `combatOpening.spec.ts`, fixtures 1v1, walkthroughs économie/donjon/jeu | 0,5–1,0 j |
| **Total** | | **3,5–6,0 j** |

Estimation volontairement large : l'étape 3 dépend de la validation visuelle de
`ui-designer`, pas seulement du code.

## 6. Hors périmètre

- **1vN multi-joueurs** : alliés, invocation, ciblage d'allié. `multiCombat`
  connaît deux camps, pas d'équipe de joueurs.
- **Sorts de zone** : ligne, croix, cercle. Le schéma actuel ne les représente
  pas ; ce n'est pas l'unification qui les ajoute.
- **Attaque d'arme** (D82) : l'« attaque de base » de cette fiche désigne le
  chemin `AttackSpec` sans `spellId` ; les dégâts d'arme restent une feature
  distincte.
- **Moteur d'effets** (18 sorts `kind: other` inertes), **kamas de monstre**,
  **départage aléatoire d'initiative** (1.29) : décisions/features séparées.
- **Équilibrage** : aucune valeur de dégât, PV, PM, XP ou butin n'est modifiée
  par la migration. Un déséquilibre constaté après bascule est un ticket
  `BALANCE-*`, pas un ajustement caché.

## 7. Tests à supprimer au fur et à mesure

`grep -rl "engine/combatLoop" tests` recense **27 fichiers** aujourd'hui.

| Vague | Tests | Sort |
| --- | --- | --- |
| Étape 2 | `combatParity.spec.ts`, `multiCombatParity.spec.ts` | conservés : ils sont le différentiel |
| Étape 3 | `battlePanel.spec.ts`, `combatLayout.spec.ts`, `dockContent.spec.ts`, `battleScene.spec.ts`, `battleViewModel.spec.ts`, `rendererScene.spec.ts`, `hudHelpers.spec.ts`, `shortcuts.spec.ts`, `globalShortcuts.spec.ts`, `trails.spec.ts`, `monsterVisibility.spec.ts`, `explorationHpBars.spec.ts` | réécrits sur `BattleState` |
| Étape 3 | `tests/walkthrough/app.spec.ts`, `economy.spec.ts`, `enemyRange.spec.ts`, `gearedDungeon.spec.ts`, `keyChain.spec.ts`, `play.spec.ts`, `progression.spec.ts` | réécrits sur le shell unique |
| Étape 4 | `combatLoop.spec.ts`, `combatOpening.spec.ts` | **supprimés** (le moteur n'existe plus) |
| Étape 4 | `movementCost.spec.ts`, `pmZone.spec.ts`, `spellRange.spec.ts`, `floatingDamage.spec.ts`, `enemySpellRange.spec.ts`, `heroProgression.spec.ts`, `heroMove.spec.ts`, `combatEngageQuai.spec.ts` | fixtures reconstruites sur `multiCombat`, assertions conservées |
| Étape 4 | `multiCombat.spec.ts` | ne garde que ce qui n'est pas déjà couvert par les goldens |
| Étape 4 | `combatParity.spec.ts`, `multiCombatParity.spec.ts` | supprimés ou fusionnés : leurs valeurs doivent vivre dans les tests du moteur unifié |

## 8. Vérification de cette PR

```bash
npm run check
```

Doit être vert **sans aucun diff dans `src/`**. Preuve inverse : casser
volontairement une règle partagée (par exemple `DIAGONAL_STEP_PM`) fait rougir
le golden de déplacement — puis la modification est restaurée.
