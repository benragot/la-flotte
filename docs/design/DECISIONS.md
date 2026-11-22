# Décisions du propriétaire

> Ces décisions sont **normatives** : elles priment sur les dettes, les specs et les PRs.
> Une PR qui les contredit est refusée, même si elle est techniquement correcte.
>
> Chaque décision dit **ce qu'elle interdit** : c'est cette colonne qui tranche un
> désaccord, pas l'intention générale.
>
> **Identifiants** : `DEC-01` à `DEC-10`, uniques dans tout le dépôt. Le préfixe
> `Dnn` est **réservé aux dettes** de `backlog.yaml` : aucun alias `Dnn` n'est
> admis pour une décision (deux noms pour une chose recréeraient la collision).

## DEC-01 — Petits chantiers d'abord (2026-11-22)

**Décision** : toujours privilégier les corrections et chantiers **rapides à impact immédiat** avant les gros chantiers.
**Conséquence** : l'ordre de la file est décidé par le rapport impact/effort, pas par la taille du sujet.
**Interdit** : ouvrir un chantier de plusieurs vagues quand une correction d'une PR débloque le jeu ; laisser une petite tâche rentable derrière un gros module.

## DEC-02 — Mouvement en combat avant le moteur d'effets (2026-11-22)

**Décision** : `D75` (déplacement du héros : PM, pathfinding, tacle) passe **avant** la vague 6. Concrètement, `5C-hero-move` est la priorité la plus haute de la file.
**Raison** : un héros cloué sur sa case pendant que les ennemis approchent n'est pas un combat 1.29 ; le moteur d'effets n'a rien à animer tant que la moitié du combat manque.
**Interdit** : démarrer une tâche `6A-*`, `6B-*`, `6C-*` ou `6D-*` avant la livraison de `5C-hero-move` ; traiter le déplacement du héros comme un confort d'interface.

## DEC-03 — Équilibrage des donjons (2026-11-22)

**Décision** : deux règles de calibration, applicables à chaque donjon.
(a) **Au niveau recommandé avec un bon équipement**, difficulté **standard** : le joueur est censé **gagner**.
(b) jusqu'à **~10 niveaux en dessous** du niveau des monstres : **très difficile mais faisable**.
**Interdit** : baisser arbitrairement les dégâts des monstres pour rendre un donjon jouable.
**Autorisé** : implémenter les panoplies du §6, **soigner entre les salles** (entorse assumée à Dofus).
**Conséquence** : un donjon injouable est un défaut d'équipement ou de soin, jamais une invitation à affaiblir les monstres.

## DEC-04 — On ouvre le monde (2026-11-22)

**Décision** : les sorties de map doivent être implémentées : on ne reste plus bloqué sur `maps[0]`.
**Cible d'architecture** : **10 à 20 maps par île**, pour préparer l'arrivée des autres îles.
**Interdit** : livrer une feature d'archipel, de navigation ou de contenu d'île tant que le joueur ne peut pas quitter sa carte de départ ; concevoir une île comme une carte unique.

## DEC-05 — Sprites procéduraux, pas de binaires (2026-11-22)

**Décision** : les sprites restent **procéduraux**, avec des feuilles **générées à 2×** pour corriger le flou.
**Interdit** : **Aseprite**, tout éditeur de pixels externe, **tout binaire** dans le dépôt (`.png`, `.ase`, `.psd`).
**Conséquence** : le flou se corrige par la génération à 2× et le rendu `nearest`, jamais par un asset importé.

## DEC-06 — Mort gratuite (2026-11-22)

**Décision** : la mort est **sans pénalité** : PV restaurés, pas de perte d'XP, d'objets ni d'énergie.
**Interdit** : implémenter le système d'énergie/fantôme de 1.29, ou infliger une perte d'XP, d'objets ou de kamas à la mort.
**Conséquence** : une PR qui ajoute une pénalité de mort, même « fidèle à 1.29 », est refusée.

## DEC-07 — Économie des clés de donjon (2026-11-22)

**Décision** : une clé doit être obtenable en **5 à 10 combats en moyenne**. Ce standard s'applique à **toutes** les futures clés.
**Autorisé** : ajuster les poids de spawn, les taux de drop de la fiche, **et/ou la recette** — voire rendre la clé directement droppable.
**Interdit** : poser une clé de donjon dont le farm moyen dépasse 10 combats ; refuser d'ajuster la donnée au motif que la fiche d'île est figée.

## DEC-08 — Ton validé (2026-11-22)

**Décision** : l'univers Kaamelott × maritime (La Flotte, la Coupure, l'archipel) est **validé** : garder ce cap pour tous les textes, noms, descriptions et messages.
**Interdit** : réécrire un texte vers un ton neutre, générique ou « fantasy standard » ; introduire un vocabulaire hors univers (références Ankama copiées, jargon technique dans les dialogues).
**Conséquence** : un texte neutre est un défaut de contenu, pas un détail de polish.

## DEC-09 — Autonomie (2026-11-22)

**Décision** : l'orchestrateur enchaîne les vagues (**PR + audit + merge**) **sans validation intermédiaire**. Le propriétaire intervient sur les décisions de design, pas sur les étapes.
**Interdit** : demander une validation humaine entre deux vagues, entre une PR et son audit, ou entre un verdict `APPROUVÉ` et le merge.
**Conséquence** : une question posée au propriétaire doit porter sur un arbitrage de design, jamais sur l'avancement.

## DEC-10 — Une diagonale coûte deux PM (2026-11-22)

**Décision** : un pas **orthogonal** coûte **1 PM par pas** ; un pas **diagonal** coûte **2 PM par pas**. La facture d'un déplacement est la **somme** du coût des pas du **chemin réellement trouvé** par le pathfinding — jamais une distance à vol d'oiseau, jamais une heuristique.
**Règle de coin** : un pas diagonal est interdit **si, et seulement si, les deux cases orthogonales adjacentes** sont bloquées ; une entité bloque comme un mur.
**Symétrie** : héros et monstres paient le même prix — **aucune asymétrie**, aucune facture « au joueur près ».
**Écart assumé à Dofus 1.29** : en 1.29, chaque case entrée coûte **1 PM**, diagonale comprise. Le `2` de cette décision est un **écart assumé à Dofus 1.29**, choisi pour réduire le rayon d'action ; ce n'est pas un bug de facturation, et le « corriger » vers 1 PM contredirait le propriétaire.
**Conséquence** : la mobilité baisse fortement (3 PM = 1 diagonale + 1 orthogonal, là où 1.29 en donnait 3), donc les portées de sorts et la balance du donjon devront être recalibrées. **Ce recalibrage reste ouvert, à l'arbitrage du propriétaire** : la tâche `5C-spell-range-rebalance` le porte, elle ne l'a pas tranché.
**Interdit** : facturer un déplacement à vol d'oiseau (Chebyshev, Manhattan) ou par une heuristique ; laisser un pas diagonal passer entre deux cases orthogonales **toutes deux** bloquées — un **seul** orthogonal bloqué **autorise** la diagonale ; appliquer une facture différente au héros et aux monstres.
**Dette liée** : `D102` — la règle de déplacement en PM n'est documentée dans **aucune** fiche du projet, pas même dans le skill `dofus-129-combat`, qui n'a aucune section déplacement ; l'écrire (avec l'écart) y est hors de portée d'un agent.
