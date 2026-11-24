# PLAN — ordre d'attaque

> Suite de `AUDIT/ISSUES.md` : 70 constats, 5 vagues. La règle est la même pour
> chaque ligne, sans exception.

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

## Vague 0 — P0 (débloquer le combat)

Ordre imposé, la zone `combat` est la même et COMBAT-02 dépend du chemin ouvert
par COMBAT-01.

| Ordre | ID | Effort | Pourquoi d'abord |
| --- | --- | --- | --- |
| 1 | COMBAT-01 | S | Le 1v1 ne calcule pas l'initiative : tout le reste du combat 1v1 se joue sur un ordre faux. |
| 2 | COMBAT-02 | S | Panneau figé quand un monstre ouvre la salle : bloque toute observation du 1vN. |
| 3 | COMBAT-04 | S | Les morts restent dans `order` : filtre nécessaire avant d'afficher quoi que ce soit. |

## Vague 1 — P1 courts, fort impact

Correctifs `S` qui changent immédiatement la lisibilité du jeu.

| ID | Effort | Note |
| --- | --- | --- |
| GRID-01 | S | Portée Chebyshev, les 8 voisins en test. Débloque le corps-à-corps diagonal. |
| GRID-02 | S | Règle des coins en LoS ; corriger `tests/unit/grid.spec.ts:214-217` **en même temps**. |
| COMBAT-08 | S | Filtrer l'IA 1v1 par la portée réelle. |
| DATA-03 | S | Table d'écart de niveau en données, `levelGapFactor` cesse d'être un `1`. |
| UI-02 | S | Désactiver « Attaquer » à 0 PA / en recharge. |
| UI-03 | S | Espace ne termine plus le tour si un bouton a le focus. |
| RENDER-02 | S | `resolution: devicePixelRatio` + `autoDensity`. |
| RENDER-03 | S | Deuxième face des murs + base remplie. |
| RENDER-06 | S | Nom des combattants sur les jetons. |

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

## Points d'arrêt (arbitrage propriétaire)

- **ARCH-01** (unification des deux moteurs) : aucun agent ne démarre sans
  décision écrite ; en attendant, chaque formule corrigée est appliquée **deux
  fois** (`combatLoop` et `multiCombat`) et testée deux fois.
- **DEC-10** : la diagonale reste à 2 PM ; ne pas « corriger » vers 1 PM.
- **GRID-04** : le refus sec hors budget est une décision (`docs/design/PENDING.md:27`),
  pas une préférence d'implémentation.
