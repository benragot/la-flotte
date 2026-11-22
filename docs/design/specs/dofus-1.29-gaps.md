---
title: Écarts Dofus 1.29 — ce que le code fait vraiment
status: spec
source: analyse de code (aucune source primaire Dofus consultée)
tags: [gap-analysis, fidelity, backlog]
---

# Écarts Dofus 1.29 — ce que le code fait vraiment

> Cette analyse confronte une **synthèse documentaire** de Dofus 1.29 (produite
> par un modèle, sans sources primaires systématiques) à **notre code réel**.
> Chaque verdict est appuyé sur un `fichier:ligne`.
> Aucune ligne n'est déduite de la lecture du document seul.

## 1. Méthode

Une description fonctionnelle de Dofus 1.29 a été confrontée au dépôt, système
par système. Pour chaque ligne :

1. recherche des termes du système dans `src/`, `data/` et `docs/` ;
2. lecture du code trouvé, puis citation de la **ligne exacte** qui tranche ;
3. à défaut de code, aveu explicite d'une recherche vide (`recherche : …`) —
   « je pense que ce n'est pas fait » n'est jamais un verdict ici.

Les quatre verdicts sont : `présent` · `partiel` (le mécanisme existe mais une
partie déclarée manque) · `absent` · `contredit` (le document dit X, le code fait
Y, et la ligne dit lequel est le bon). Aucun `contredit` n'est prononcé : les
écarts trouvés sont des **manques**, pas des affirmations contraires, et la
synthèse documentaire elle-même n'a pas de source primaire vérifiable sur les
points litigieux (chrono de tour, ordre des invocations).

## 2. Tableau des quinze systèmes

| # | Système | Verdict | Preuve (fichier:ligne) | Ce qui manque |
|---|---|---|---|---|
| 1 | Pods (poids transporté, capacité liée à Force) | absent | `src/schemas/itemSchema.ts:43-48` (champs communs : id, nom, description, prix — aucun poids) et `src/engine/inventory/stack.ts:35-40` (`addItem` sans plafond) ; recherche : pods, poids, capacity dans `src/` et `data/` — `weight` n'existe que comme poids de tirage (`src/schemas/spawnSchema.ts:18`) | champ de poids sur l'objet, capacité dérivée de la Force, refus de ramasser et affichage sac (dette D78) |
| 2 | Métiers de récolte (outil équipé, ressource ramassable) | absent | `src/engine/exploration/move.ts:26-28` (le seul clic d'exploration déplace) et aucun métier dans `src/schemas/` ; recherche : harvest, métier, récolte, tool, outil, job dans `src/` et `data/` — seules occurrences décoratives (`data/items.yaml:212`, `data/recipes.yaml:49`) | notion de métier, outil équipé, ressource récoltable et action de récolte (dette D79) |
| 3 | Sorties de map (bords, marqueurs, transition) | absent | `src/schemas/mapSchema.ts:9-15` (`mapSchema` = id, name, width, height, grid — aucune sortie) et `src/store/useCombatStore.ts:152-156` (`startMapId` renvoie `maps[0].id`, aucune action de changement de carte) | marqueurs de sortie en données, transition et graphe d'îles ; aujourd'hui une seule carte 12×12 (tâche 5D-exits) |
| 4 | Attaque au corps-à-corps (dégâts de l'arme) | absent | `data/items.yaml:139-142` (aveu des données : `weaponType`, `damageLines`, `apCost`, `critRate` « n'existent ni dans `itemSchema` ni dans le moteur ») ; `src/store/useCombatStore.ts:342-345` et `361-366` (l'attaque du joueur = **premier sort de dégâts** de sa classe) ; `src/engine/inventory/types.ts:38-47` (`ItemLike` sans `level` ni dégâts) | ligne de dégâts, CC, PA d'arme et attaque de base : une arme n'est qu'un bloc de stats (dette D82) |
| 5 | Médaillon central (cœur, anneau de temps, XP circulaire) | absent | recherche : médaillon, medallion, orb, anneau, circulaire dans `src/` — aucun composant ; `src/ui/components/CombatHud.tsx:59-68` (HUD = bandeau, initiative, dock, overlay) et `src/ui/components/TimelineCard.tsx:23-33` (mini barre de PV, pas d'anneau) | médaillon, anneau de tour et cercle d'XP ; aucun XP n'est même affiché (dette D80) |
| 6 | Canaux de chat (vert/combat, noir/commun, bleu/privé, violet/guilde) | partiel | `src/engine/combatLoop/log.ts:3-5` (un seul tableau `log`) et `src/ui/components/CombatLogPanel.tsx:9-14` + `src/ui/hudHelpers.ts:137` (trois teintes par locuteur, aucun canal) | modèle de canal, filtres et teinte par élément ; privé et guilde sont sans objet mono-joueur, la teinte d'élément est la tâche 5C-log-channel (dette D81) |
| 7 | Carte du monde et coordonnées | absent | `src/ui/shortcuts.ts:63-67` (aucun `KeyM` : seuls `Escape`, `Espace` et `Digit1..9`) et `src/ui/components/TopBanner.tsx:22` (affiche `Carte {mapId}`, un identifiant, pas des coordonnées) | carte du monde, coordonnées de case et nom de zone ; l'écran de combat n'affiche que l'id de la carte |
| 8 | Conditions d'équipement (niveau, caractéristiques requises) | absent | `src/engine/inventory/equipment.ts:20-23` et `84-91` (`equipItem` ne vérifie que la catégorie et le slot) ; `src/engine/inventory/types.ts:38-47` (`ItemLike` n'a pas `level` alors que `src/schemas/itemSchema.ts:67` le déclare) | vérification du niveau et des prérequis, refus explicite : équiper un objet niveau 18 au niveau 1 passe (tâche 5C-equip-requirements) |
| 9 | Tacle (Agilité, empêche de quitter un contact) | partiel | `src/engine/multiCombat/tackle.ts:110-116` (`resolveTackle`) et `src/engine/combat/tackle.ts:19-21` (formule) existent, mais **aucun appelant de production** : `src/engine/combatLoop/move.ts:19-26` déplace sans tacle, seul `tests/unit/multiCombat.spec.ts:496` l'exerce | l'appel dans le chemin de déplacement (dette D70, tâche 5C-hero-move) ; simplifications assumées : tacleur unique, perte de PA au lieu de PM |
| 10 | Poussée et dégâts de collision | partiel | `src/engine/combatLoop/push.ts:65-70` et `src/engine/combat/pushback.ts:17-21`, branchés par `src/engine/combatLoop/cast.ts:103-126` ; écarts déjà documentés (distance `travelled` au lieu de `cells - travelled`, diagonale, jet jamais tiré, `RéPou` absente) dans `docs/design/specs/effects-engine.md:302` | fidélité : distance non parcourue, diagonale, jet 1..8 et résistance de poussée (tâche 6C-push-fidelity) |
| 11 | Timeline par initiative | partiel | `src/engine/multiCombat/timeline.ts:24-27` (tri **décroissant**, départage par id) utilisé par `src/store/useCombatStore.ts:331` ; `src/engine/combat/initiative.ts:20-22` (somme des 4 stats × ratio de PV) | départage aléatoire 1.29 (remplacé par l'id, assumé pour le déterminisme) ; invocations après l'invocateur : **sans objet**, aucune invocation n'existe |
| 12 | Écran de création accessible | absent | `src/ui/appRouting.ts:5-7` (`hasHero` ⇒ arène, sans retour) ; `src/store/useGameStore.ts:302` expose `resetGame` mais aucun fichier de `src/ui/` ne l'appelle | bouton « nouveau personnage », purge du slot et retour à `HeroCreation` (tâche 5D-new-game) |
| 13 | Envoûtements / buffs / debuffs | partiel | modélisés par `src/schemas/spellSchema.ts:13-31` (types, `value`, `duration`) et 18 sorts de héros `kind: other` dans `data/spells.yaml` ; **non appliqués** : `src/engine/combatLoop/cast.ts:153-161` refuse par identité tout `kind: other` | moteur d'effets (vague 6, `docs/design/specs/effects-engine.md`) : durée, PA/PM, armure, soin, zone, invocation |
| 14 | Compte à rebours de tour | absent | recherche : timer, countdown, chrono, deadline, setInterval, Date.now dans `src/` — **zéro occurrence** ; `src/engine/combatLoop/turn.ts:26` ne compte que des tours | limite de temps par tour, anneau de temps et auto-pass ; aucun état d'horloge dans `BattleState` (dette D80) |
| 15 | Sorts de classe et attaques d'arme | partiel | `data/spells.yaml` (44 sorts : 36 héros, 8 monstres) et `src/store/useCombatStore.ts:342-345` (seul le **premier** sort de dégâts de la classe est exposé en 1vN) contre `src/engine/combatLoop/cast.ts:153-161` (18 sorts de héros `kind: other` inertes) | 20 sorts castables sur 44 (16 dégâts + 2 téléportations + 8 monstres) : 18 sorts de héros inutilisables, et un seul accessible dans l'UI 1vN |

> Les écarts de fidélité de la poussée (ligne 10) sont détaillés dans la fiche
> `docs/design/specs/effects-engine.md` §1.7, tableau « notre modèle est-il
> fidèle ? » : six points y sont déjà tranchés comme non fidèles (distance,
> diagonale, mur immédiat, bloqueurs, cible secondaire, résistance).

## 3. Les trois écarts les plus graves

1. **La moitié des sorts de héros est inerte et un seul est jouable en 1vN**
   (lignes 13 et 15). `castSpell` renvoie l'état inchangé pour tout `kind: other`
   (`src/engine/combatLoop/cast.ts:158-160`) : 18 des 36 sorts de classe ne font
   rien, sans message. En 1vN, l'UI ne propose même pas de choisir un sort :
   `heroDamageSpell()` renvoie le premier sort `damage` de la classe
   (`src/store/useCombatStore.ts:342-345`).
2. **Une arme n'inflige aucun dégât** (ligne 4). Il n'existe pas d'attaque de
   base : le joueur frappe uniquement avec un sort. Une arme de niveau 17 est un
   bloc de statistiques, alors que `data/items.yaml:139-142` documente
   explicitement l'absence de lignes de dégâts.
3. **Le niveau d'un objet n'est jamais vérifié à l'équipement** (ligne 8).
   `equipItem` ne regarde que `category` et `slot`
   (`src/engine/inventory/equipment.ts:20-23`) et `ItemLike` ne porte même pas
   `level`, alors que le schéma le déclare (`src/schemas/itemSchema.ts:67`) : le
   schéma promet une règle que le moteur n'applique pas.

Deux blocages de jouabilité, moins « graves » mais bloquants, sont traités en
tâches : l'absence de sortie de map (ligne 3, une seule carte 12×12) et
l'impossibilité de revenir à la création (ligne 12, `resetGame` sans appelant).

## Ce qui a été délibérément écarté

Ces éléments de Dofus 1.29 ne seront pas implémentés. Ils sont listés ici pour ne
jamais réapparaître comme des « oublis » dans une prochaine analyse.

- **Multi-joueurs (PvP, kolizeum, percepteurs)** — le jeu est mono-joueur : pas de serveur, pas d'état partagé, la sauvegarde est un JSON local (`src/engine/save/serializeSave.ts`).
- **Guildes et banque de guilde** — sans second joueur il n'y a pas de guilde ; le coffre personnel (5B-c) couvre le besoin de stockage.
- **Hôtels de vente et mode marchand** — l'économie est de subsistance (drop + craft) : un marché entre joueurs n'a aucune contrepartie hors ligne.
- **Zaaps et réseau de transport** — hors périmètre tant qu'il n'y a qu'une carte (écart 3) ; les sorties de map passent d'abord.
- **Montures, élevage et dragodindes** — contenu massif de méta-progression, sans effet sur la boucle exploration → combat → butin actuelle.
- **Alignement (Bonta/Brâkmar) et combats de guilde** — dépend entièrement des guildes et du multi-joueurs, donc écarté avec eux.
- **Quêtes de PNJ et dialogues à choix** — l'univers et le ton existent, mais le moteur de dialogue n'est pas prioritaire face au chemin jouable actuel (donjon) ; le lore vit dans les descriptions d'objets.
- **Forgemagie, sculptemagie, brisage et runes** — méta-artisanat hors de la boucle « je joue une session » ; le craft simple (`src/engine/craft/`) suffit.
- **Enclos de monstres et élevage d'archimonstres** — même raison que les montures : contenu de collection, pas de combat.
- **Encyclopédie, succès et classements** — aucune valeur en solo hors ligne tant que le contenu tient en une île.

## 4. Ce que cette analyse ouvre dans le backlog (v20)

Trois tâches seulement, celles qui débloquent le joueur ou corrigent une promesse
fausse — plus une tâche de rendu issue des limites géométriques :

| Tâche | Phase | Pourquoi maintenant |
|---|---|---|
| `5C-equip-requirements` | 5C | corrige une promesse du schéma : `level` existe et n'est jamais lu |
| `5D-new-game` | 5D | le joueur est enfermé dans son personnage, `resetGame` n'a aucun appelant |
| `5D-exits` | 5D | une seule carte, aucun moyen d'aller ailleurs : l'archipel est injouable |
| `7A-arena-background` | 7A | les coins du viewport restent hors du losange (voir `ui-dofus-retro.md` §12.2) : fond d'arène, jamais de cases factices |

Six dettes, avec leur sévérité et leur cible :

| Dette | Sévérité | Cible | Motif |
|---|---|---|---|
| D77 | high | external (`owner: user`) | harnais Playwright : port 4173 codé en dur + `reuseExistingServer` en local ⇒ les tests UI peuvent valider le code d'un autre worktree (fichier hors périmètre agent) |
| D78 | medium | 5B | pods : mécanique 1.29 structurante, mais l'inventaire actuel tient en quelques piles |
| D79 | low | 7B | métiers de récolte : contenu de map, donc vague « archipel » |
| D80 | medium | 5C-turn-rail | médaillon et compte à rebours : le médaillon est le support du tour, la frise le remplace aujourd'hui |
| D81 | low | 5C-log-channel | canaux : écart assumé (journal unique), seule la teinte d'élément reste à faire |
| D82 | high | 6B-cast-riders | dégâts d'arme : sans attaque de base, une arme n'est qu'un bloc de stats |
