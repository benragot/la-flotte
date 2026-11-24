# PLAN — ordre d'attaque

> Suite de `AUDIT/ISSUES.md` : 71 constats, 5 vagues. La règle est la même pour
> chaque ligne, sans exception.
>
> **État au 2026-11-24** : 7 constats faits (vague 0 entièrement, plus
> COMBAT-04, COMBAT-08, GRID-01, RENDER-02 et BALANCE-01 en vague 1),
> 64 restants. Détail des hashes dans `AUDIT/ISSUES.md` → `## Suivi des merges`.

## Reste en tête

Ce qui décide de la prochaine PR, dans cet ordre :

1. **Aperçu du chemin** — GRID-03 (et INPUT-01 derrière) : `buildPathPreview` n'a
   toujours aucun appelant, le clic-to-move reste à l'aveugle.
2. **Sorts honnêtes** — UI-01 (plus de clic mort), puis SPELL-03 (CC réel) et
   SPELL-02 (moteur d'effets) : un sort jouable doit annoncer sa règle.
3. **Stuff** — ITEM-01 (résistances et `% Dégâts` dans `CombatantState`) :
   prérequis de SPELL-03 et SPELL-08, donc avant eux.
4. **Donjon et kamas** — DATA-01 + DATA-02 ensemble : une salle nettoyée doit
   créditer XP, butin et kamas, sinon la boucle de progression reste morte.

Le reste (vagues 2 à 4, puis les 39 `P2`) suit l'ordre des sections ci-dessous.

## Règle d'exécution

1. **Un fix = une micro-PR = une branche = un worktree** (`fix/<slug>`), jamais
   deux constats dans la même PR sauf dépendance explicite ci-dessous.
2. **Test RED d'abord** : le test décrit le comportement 1.29 attendu, il échoue
   pour la bonne raison.
3. Implémentation minimale, fonctions ≤ 10 lignes, aucune dérogation de lint.
4. `tests/walkthrough/` mis à jour si le comportement de jeu change.
5. `npm run check` vert avant commit, commit `fix(<scope>): 🐛 …`.
6. PR ouverte, auditée par `qa-reviewer`, mergée par `pr-merger` — jamais en
   direct sur `main`.

## Vague 0 — P0 (débloquer le combat) — ✅ faite

Ordre imposé, la zone `combat` est la même et COMBAT-02 dépend du chemin ouvert
par COMBAT-01. Les trois constats sont mergés.

| Ordre | ID | Effort | Pourquoi d'abord | Statut |
| --- | --- | --- | --- | --- |
| 1 | COMBAT-01 | S | Le 1v1 ne calcule pas l'initiative : tout le reste du combat 1v1 se joue sur un ordre faux. | ✅ fait (#139, `fff5d3d`) |
| 2 | COMBAT-02 | S | Panneau figé quand un monstre ouvre la salle : bloque toute observation du 1vN. | ✅ fait (#136, `8797ac5`) |
| 3 | COMBAT-04 | S | Les morts restent dans `order` : filtre nécessaire avant d'afficher quoi que ce soit. | ✅ fait (#135, `1512b56`) |

## Vague 1 — P1 courts, fort impact — 4 faits sur 11

Correctifs qui changent immédiatement la lisibilité du jeu. Tous `S` sauf
COMBAT-03 (`M`), placé en tête parce qu'il débloque UI-04 et toute valeur
d'initiative — **après COMBAT-01** (fait).

| ID | Effort | Note | Statut |
| --- | --- | --- | --- |
| COMBAT-03 | M | Stats de base par classe dans `classes.yaml` : initiative du héros non nulle. **Après COMBAT-01** (dépendance ci-dessous) et avant UI-04. | ouvert |
| GRID-01 | S | Portée Chebyshev, les 8 voisins en test. Débloque le corps-à-corps diagonal. | ✅ fait (#141, `62ecdda`) |
| BALANCE-01 | S | **Suite de GRID-01** : le donjon niveau 16 perdait la salle 4 ; soin entre salles 0,50→0,75 (levier autorisé par DEC-03), sans nerf de dégâts ni `hpScale`. | ✅ fait (#142, `5ae59cf`) |
| GRID-02 | S | Règle des coins en LoS ; corriger `tests/unit/grid.spec.ts:214-217` **en même temps**. | ouvert |
| COMBAT-08 | S | Filtrer l'IA 1v1 par la portée réelle. | ✅ fait (#140, `4ed327c`) |
| DATA-03 | S | Table d'écart de niveau en données, `levelGapFactor` cesse d'être un `1`. | ouvert |
| UI-02 | S | Désactiver « Attaquer » à 0 PA / en recharge. | ouvert |
| UI-03 | S | Espace ne termine plus le tour si un bouton a le focus. | ouvert |
| RENDER-02 | S | `resolution: devicePixelRatio` + `autoDensity`. | ✅ fait (#138, `10d516b`) |
| RENDER-03 | S | Deuxième face des murs + base remplie. | ouvert |
| RENDER-06 | S | Nom des combattants sur les jetons. | ouvert |


## Vague 2 — P1 moyens, « sente Dofus »

Ce qui fait qu'un joueur de Retro reconnaît l'interface.

| ID | Effort | Note |
| --- | --- | --- |
| GRID-03 | M | Aperçu de chemin + coût PM au survol (`buildPathPreview` branché sur `view.path`). |
| INPUT-01 | M | Hit-test des jetons **avant** `isoToGrid`. |
| RENDER-01 | M | Tri `x+y` commun acteurs + décor (dépend de RENDER-03 pour un mur lisible). |
| UI-01 | M | Sorts `kind: other` : badge « à venir », état recharge, plus de clic mort. |
| SPELL-03 | M | CC réel : `critRate`/`critDamage` en data, jet max. **Après ITEM-01** (même formule). |
| ITEM-01 | M | Projeter res/%dmg dans `CombatantState` — prérequis de SPELL-03 et SPELL-08. |

## Vague 3 — P1 moyens, contenu et structure

| ID | Effort | Note |
| --- | --- | --- |
| DATA-01 | M | Récompenses par salle — **avec DATA-02** (même point de crédit). |
| DATA-02 | M | Kamas crédités et dépensés — **avec DATA-01**. |
| SPELL-04 | M | Choix du sort + `targetCell` en 1vN (téléportation incluse). |
| COMBAT-05 | M | Afficher l'ordre d'initiative — **après COMBAT-04** (ordre purgé des morts). |
| COMBAT-07 | M | Brancher `ai:` des monstres (`archetype`, `preferredDistance`). |
| RENDER-04 | M | Contour de portée teinté alpha 0,18 au lieu de la nappe opaque. |
| RENDER-05 | M | `lastAction` typé + animations `attack`/`hit` en salle. |
| UI-04 | M | Cartes de classe : 3 sorts + soft caps (dépend de COMBAT-03 pour des stats réelles). |
| UI-05 | M | Panneau de salle dans le flux, plus par-dessus l'arène. |

## Vague 4 — P1 longs, nouveaux sous-systèmes

À découper en plusieurs PR internes, mais une seule branche par morceau livrable.

| ID | Effort | Note |
| --- | --- | --- |
| SPELL-01 | L | `zone {shape,size}` au schéma + `expandZone` pur ; débloque croix/cercle/ligne. |
| SPELL-02 | L | Moteur d'effets v1 (heal/buff) par table, 18 sorts inertes rebranchés. |
| COMBAT-06 | L | Hook `endTurn` pur : poison, régénération, durées — **après SPELL-01/02** (sans zone ni effet, un tick n'a rien à décrémenter). |

## P2 — après les vagues P1

Les 39 constats `P2` restent ouverts et se traitent par lots de même domaine,
dans l'ordre : `GRID-05`, `GRID-04`, `GRID-06/07/08/09` → `UI-06…UI-15` →
`RENDER-07…RENDER-13` → `ITEM-02…ITEM-06` → `DATA-04…DATA-08` →
`SPELL-05…SPELL-09` → `TEST-01`. Aucun n'est un prérequis d'une vague P1.

## Dépendances à respecter

| Contrainte | Raison |
| --- | --- |
| **COMBAT-04 avant COMBAT-05** | Afficher un `order` qui contient encore les morts produirait une timeline fausse. |
| **RENDER-02 avant RENDER-09** | Sans DPR réglé, aucun réglage d'échelle de sprite n'est mesurable. |
| **ITEM-01 avant SPELL-03** | Critiques et résistances partagent `computeDamage` ; corriger l'un sans l'autre duplique la formule. |
| **ITEM-01 avant SPELL-08** | La poussée doit passer par la même formule de dégâts. |
| **DATA-01 et DATA-02 ensemble** | Même point de crédit en fin de salle : deux PR successives casseraient la comptabilité. |
| **COMBAT-01 avant COMBAT-03** | Le calcul d'initiative doit exister avant qu'une valeur non nulle ait un effet. |
| **RENDER-03 avant RENDER-01** | Un décor intercalé avec des murs à une face reste illisible. |
| **GRID-01 avant BALANCE-01** | La portée Chebyshev change l'atteignabilité en salle : le soin entre salles (BALANCE-01) se recalibre **après** elle, jamais avant. |

## Points d'arrêt (arbitrage propriétaire)

- **ARCH-01** (unification des deux moteurs) : aucun agent ne démarre sans
  décision écrite ; en attendant, chaque formule corrigée est appliquée **deux
  fois** (`combatLoop` et `multiCombat`) et testée deux fois.
- **DEC-10** : la diagonale reste à 2 PM ; ne pas « corriger » vers 1 PM.
- **GRID-04** : le refus sec hors budget est une décision (`docs/design/PENDING.md:25-26`),
  pas une préférence d'implémentation.
