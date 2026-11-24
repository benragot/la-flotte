# 01 — Référence Dofus 1.29

> Checklist des comportements attendus de Dofus Retro 1.29, avec la preuve quand
> elle existe. Convention de preuve : chemins relatifs à la décompilation
> `/Users/benjaminragot/dofus-1-29-decompose` (lecture seule), tels que transmis
> par l'agent expert `dofus-source` — les segments obfusqués (`%16%04%09`, …)
> correspondent aux packages `ank.battlefield`, `dofus.aks`,
> `dofus.graphics.gapi.ui`.
>
> Chaque point porte sa **force de preuve** : `[client]` = ligne de code
> décompilée, `[données]` = table du jeu, `[mémoire]` = connaissance non
> vérifiable dans le client (logique serveur), avec le niveau de confiance.

## 1. Grille et déplacement

| Point | Règle 1.29 | Preuve |
| --- | --- | --- |
| Directions | **8 directions** (4 orthogonales + 4 diagonales) | `%16%04%09/battlefield/%1B%17%07/%1A%04%0E.as:1196` (options de déplacement), `:1257` (8 poids) |
| Pathfinding | calculé **côté client** dans `ank.battlefield`, pas de validation de chemin serveur au-delà du budget | même fichier |
| LoS vs pas | la ligne de vue est un calcul **séparé** du chemin : `validCells`, `lineOfSightCells`, `isTargetable` | `%16%04%09/battlefield/%1B%17%07/%16%1E%11.as:534` (`validCells`), `:583` (`lineOfSightCells`), `%16%04%09/battlefield/%17%05%03/%16%17%1B.as:633` (`isTargetable`) |
| Coût d'un pas | **1 PM par case entrée, diagonale comprise** — le serveur valide le budget, le client ne facture pas | `[mémoire, validation serveur]` |

**Dans La Flotte** : `findPath` est bien 8-voisins, mais la diagonale coûte
**2 PM** (décision **DEC-10**, écart assumé et documenté). La règle de coin
interdit déjà un pas diagonal si les deux orthogonales sont des murs côté
pathfinding ; ce n'est pas le cas côté ligne de vue (GRID-02). Le tacle n'est pas
appliqué en 1v1 (GRID-06).

## 2. Portée des sorts

| Point | Règle 1.29 | Preuve |
| --- | --- | --- |
| Métrique | **Chebyshev** : `max(abs(dx), abs(dy))` | `[mémoire, confiance haute]` |
| Diagonale | une case diagonale adjacente est à **portée 1**, les **8 voisins** sont à portée 1 | idem |
| Bonus `+PO` | n'augmente que le **maximum** de portée (`maxRange`), jamais le minimum | idem |
| Contrôle client | le client **n'applique pas** de contrôle de portée : il demande les cases ciblables au serveur | `dofus/%16%02%11/Spells.as:75` (aucune vérification de portée côté client) |

**Dans La Flotte** : portée mesurée en **Manhattan** (GRID-01), donc une cible
diagonale adjacente est à distance 2 ; le `+PO` n'est pas modélisé séparément.
Le 1v1 traite l'adversaire comme bloqueur de LoS (GRID-05).

## 3. Tours

| Point | Règle 1.29 | Preuve |
| --- | --- | --- |
| Ordre | **initiative strictement décroissante** | `[mémoire, validation serveur]` |
| Égalité d'initiative | **non tranchée** par le client (le serveur décide) | `[mémoire]` |
| Début de tour | **PA et PM restaurés** au début du tour de chaque combattant | `[mémoire, confiance haute]` |
| Effets à durée | **décrémentés au début du tour de la cible** (pas à la fin du tour du lanceur) | `[mémoire, confiance haute]` |
| Fin de tour | les effets de fin de tour (poison, régénération, états) s'appliquent alors | idem |

**Dans La Flotte** : le 1v1 ne calcule **jamais** l'initiative, le héros ouvre
toujours (COMBAT-01) ; le 1vN trie par initiative décroissante et **départage par
id** (assumé, déterminisme des tests) ; aucune phase de fin de tour n'existe
(COMBAT-06) ; les morts restent dans l'ordre (COMBAT-04).

## 4. Sorts

| Point | Règle 1.29 | Preuve |
| --- | --- | --- |
| Répétition | **plusieurs lancers du même sort par tour autorisés** — pas de règle « 1/sort/tour » | `[mémoire, confiance haute]` |
| Attaque d'arme | **1 attaque d'arme par tour** (compteur séparé des sorts) | `[mémoire, confiance haute]` |
| Zones | **case, croix, cercle, ligne** (et variantes `X`, `T`, …) portées par le sort | `[données]` (`SpellDatas`, `SpellLevel`) |
| Niveaux | chaque sort a des **données par niveau 1-6** (portée, dégâts, CC, PA) | `dofus/%18%18%12/SpellDatas.as:45` (structure), `:166-168` (niveau/spell level) |
| CC | taux de CC par sort et par niveau, jet de dégâts **maximal** en critique, CC raté = échec critique possible | `[mémoire, confiance haute]` — voir skill `dofus-129-combat` §2 |

**Dans La Flotte** : le schéma n'a **aucun champ `zone`** (SPELL-01) ; 18 sorts
utilitaires sont inertes (SPELL-02) ; le CC est un 2 % figé sans jet max ni échec
critique (SPELL-03, SPELL-07) ; `castsPerTarget` est déclaré mais non appliqué
(SPELL-05) ; retrait PA/PM absent (SPELL-06) ; `requiresState` non vérifié
(SPELL-09).

## 5. Dégâts

Formule de référence (skill `dofus-129-combat` §1) :

```ts
raw       = floor(base * (100 + max(0, stat) + percentDmg) / 100) + flatDmg;
afterFlat = max(0, raw - flatRes - armor);
pctRes    = isPlayer ? min(pctRes, 50) : pctRes;
damage    = max(0, floor(afterFlat * (100 - pctRes) / 100));
```

- Résistances **fixes d'abord**, pourcentage ensuite, plancher à 0 à chaque étape.
- Cap de 50 % de résistance **pour les joueurs seulement**.

**Preuve partielle** : le **client ne calcule pas** les dégâts, il **reçoit** les
valeurs et les résistances déjà résolues par le serveur — la formule n'est donc
pas dans le code client. Ce que le client prouve, c'est la **forme des données
reçues** (résistances par élément, `% Dégâts`, armure) :
`.../gapi/%17%01%0E/BannerSpriteInfos.as:44,78,101,126`.

**Dans La Flotte** : la formule est implémentée, mais les résistances et
`% Dégâts` **d'équipement** ne sont jamais projetés dans le combattant
(ITEM-01) ; les dégâts de poussée court-circuitent la formule (SPELL-08).

## 6. Drop et Prospection

| Point | Règle 1.29 | Preuve |
| --- | --- | --- |
| Seuil | si `PP < minimumProspection` du monstre, **taux = 0** (aucun drop possible) | `dofus/%17%05%03/ItemDrop.as:216` (comparaison au minimum), `:249` (refus) |
| Taux | sinon `taux = min(1, tauxBase × PP / 100)` | `dofus/%17%05%03/ItemDrop.as:223-224` (produit et plafond) |
| Affichage | le bestiaire montre le taux conditionné à la PP et le minimum requis | `.../EncyclopediaBestiaryMonsterDetails.as:272-273` (minimum), `:309` (taux) |

**Dans La Flotte** : le drop suit cette courbe, mais la **Chance est comptée deux
fois** dans la Prospection (ITEM-04) : le drop réel diffère de la PP affichée.

## 7. Expérience

```
xp = floor(XP_monstre × (1 + sagesse / 100) × coef_niveau × coef_groupe)
```

| Point | Statut | Preuve |
| --- | --- | --- |
| Facteur Sagesse `(1 + sagesse/100)` | `[mémoire, confiance haute]` | — |
| Coefficient d'écart de niveau | **non chiffrable côté client** : le serveur applique une table de rendement décroissant | `[mémoire]` |
| Coefficient de groupe | **non chiffrable côté client** (croît avec le nombre de membres et leur niveau) | `[mémoire]` |
| Affichage | le client affiche l'XP reçue, pas son calcul | `[client]` (aucune formule d'XP dans le client) |

**Dans La Flotte** : `levelGapFactor: 1` neutralise tout malus d'écart de niveau
(DATA-03) et certaines valeurs de `baseXp` sortent de l'échelle des paliers
(DATA-07).

## 8. PA, PM, PO

| Point | Règle 1.29 | Preuve |
| --- | --- | --- |
| PA niveau 1 | **6 PA** | `[mémoire, confiance haute]` |
| PM niveau 1 | **3 PM** | idem |
| Caps | **12 PA** et **6 PM** au maximum, quel que soit le stuff | idem |
| PO de base | **aucun** : la portée est une donnée du sort, pas une caractéristique du personnage | idem |

**Dans La Flotte** : conforme pour 6/3 et les caps ; l'initiative du héros vaut
**0** faute de stats de base par classe (COMBAT-03).

## 9. Écrans et interface

| Point | Règle 1.29 | Preuve |
| --- | --- | --- |
| Interface | **207 classes** d'UI, **100 % nommées**, dans `dofus.graphics.gapi.ui` | `dofus/%18%03%17/gapi/ui/*` |
| Inventaire | grille d'objets, pods (`PlayerWeight` : poids porté vs capacité), kamas, aperçu du personnage | `Inventory.as` (poids/pods via `PlayerWeight`) |
| Panoplies | bonus par palier de pièces équipées, appliqués dès que le palier est atteint | `dofus/%17%05%03/ItemSet.as:337` (résolution des bonus de set) |

**Dans La Flotte** : inventaire en **liste de texte** sans icône ni double-clic
(UI-15), aucun poids/pods (ITEM-02), panoplies bridées à 4 slots et 4 pièces
(ITEM-03), résistances de stuff affichées « non appliqué » (ITEM-01).

## Ce que le client ne prouve pas

Ces points sont **serveur** : la décompilation les montre seulement comme des
valeurs reçues ou des décisions déjà prises. Ils sont donc cités en `[mémoire]`
dans ce document et **ne peuvent pas servir de preuve d'écart** à eux seuls.

1. **Dégâts** — formule, ordre des résistances, cap joueur : le client reçoit le
   résultat (`BannerSpriteInfos.as`).
2. **Ordre de tour** — l'initiative et son départage à égalité sont décidés côté
   serveur ; le client affiche la timeline reçue.
3. **XP** — coefficients d'écart de niveau et de groupe absents du client.
4. **Conditions d'équipement** — niveau et caractéristiques requis sont validés
   par le serveur ; le client grise l'objet.
5. **IA des monstres** — entièrement serveur : aucune heuristique de
   déplacement ou de choix de sort n'est lisible dans le client.
6. **Validation du chemin** — le client calcule le pathfinding et envoie la
   demande ; le budget est confirmé (ou refusé) par le serveur.
