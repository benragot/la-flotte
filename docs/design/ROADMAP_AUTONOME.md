# Roadmap autonome — La Flotte
Légende : [ ] à faire · [x] fait

> **Document normatif** : [`docs/design/DECISIONS.md`](DECISIONS.md). Les décisions
> DEC-01 à DEC-09 du propriétaire priment sur cette roadmap, sur les specs et sur les PRs.
> Une PR qui les contredit est refusée, même techniquement correcte.

## Vague 4 — Persistance héros, inventaire, panoplies, sauvegarde
- [x] 4A hero-prog — courbe XP 1.29, Hero persistant, 33 sorts
- [x] 4A items-sets — items, consommables, panoplie
- [x] 4A inventory-engine — sac, 8 slots, bonus de panoplie
- [x] 4A save-system — sauvegarde versionnée
- [x] 4B intégration — useGameStore + walkthrough niv. 5
- [ ] 4C ui-hero — création de personnage
- [ ] 4C ui-inventory — inventaire et équipement
- [ ] 4D wiring — App
## Vague 5 — 1vN, tacle/CC/retrait, Navire-Base, craft, donjon
- [x] 5A multi-combat · craft-engine · dungeon-data · renderer-preview
- [x] 5B-a catégorie `key`, clé réelle, allowlist supprimée
- [x] 5B-b moteur de donjon — clé consommée, 4 salles, comptes par groupe
- [x] 5B-c coffre de banque et craft câblés dans `useGameStore`
- [x] 5B-d combat 1vN additif (`battle` à côté de `combat`)
- [x] 5B-e walkthrough donjon — 4 salles, carry-over, rechargement sans soin
- [x] 5B-f recette de la clé de la Ferraille, 3 ingrédients et butin
- [ ] 5B-g table de spawn d'exploration — sortir `DEMO_MONSTER_ID`, farmer les 3 ingrédients hors donjon (PR #43 en revue)
- [ ] 5B intégration — reste 5B-g
- [ ] 5B-key-budget — ramener la clé de donjon à 5-10 combats (décision DEC-07)
- [x] 5C-a panneau de combat 1vN — rendu des N ennemis, ciblage et journal (PR #44)
- [x] 5C-b sorts des monstres de la Ferraille (données) — PR #46
- [x] 5C-c câbler `battleEnemyTurn` — les ennemis ripostent — PR #48
- [x] 5C-d portée et ligne de vue — `map` dans `BattleState` (PR #50)
- [x] 5C-e walkthrough de la chaîne de la clé (PR #45)
- [x] 5C-explore-hp — plus de barres de vie en exploration, le type l'interdit (PR #109)
- [x] 5C-hover-highlight — surbrillance de l'entité survolée en exploration (PR #110)
- [x] 5C-cast-cadence — cadence de lecture de 0,75 s entre deux résolutions (PR #111)
Spec de référence : `docs/design/specs/ui-dofus-retro.md`
- [ ] 5C-actor-ring — anneau d'équipe bleu/rouge + sprite procédural + ombre (suppression du disque plein)
- [ ] 5C-hover-hp — barres de PV au survol uniquement
- [ ] 5C-pm-zone — rendu conditionnel de la zone PM (héros et ennemis au survol, écart assumé)
- [x] 5C-path-8dirs — déplacement et pathfinding 8 directions (moteur : PR #108 ; spec TC3 et §1 alignées sur DEC-10 : PR #113)
- [ ] 5C-hero-move — déplacement du héros en combat : PM, pathfinding et tacle (dépend de 5C-path-8dirs)
- [ ] 5C-cast-preview — portée en contour + aperçu de zone d'effet au survol
- [ ] 5C-turn-rail — frise de portraits en bas (remplace la timeline verticale)
- [ ] 5C-info-panel — panneau d'infos bas-droite (nom, niveau, PV, 5 résistances)
- [ ] 5C-group-stars — étoiles de bonus + infobulle nom/niveau sur les groupes
- [ ] 5C-log-channel — journal unique teinté par élément, sans message de déplacement
- [ ] 5C-set-panoplies — panoplies de la fiche §6 : PV, résistances, Force (levier de survie D71)
- [ ] 5C-equip-requirements — conditions d'équipement : niveau vérifié avant de porter un objet (écart 8)
- [ ] 5C-heal-between-rooms — soin entre les salles de donjon, entorse assumée (décision DEC-03)
- [x] 5D-a premier donjon jouable — déclencher une salle depuis le jeu (PR #56)
- [x] 5D-b walkthrough « je joue » — du héros créé au donjon (PR #57)
- [ ] 5D-hud-bar — barre d'interface basse : portrait, niveau, XP, kamas
- [ ] 5D-death-end — mort et fin de combat sobres
- [x] 5D-new-game — revenir à l'écran de création : nouveau personnage (écart 12, PR #69)
- [ ] 5D-exits — sorties de map : quitter une carte par un bord ou un marqueur (écart 3)
- [ ] 5D wiring
## Analyse d'écart Dofus 1.29 contre le code réel
Spec de référence : `docs/design/specs/dofus-1.29-gaps.md`
- Les quinze systèmes sont tranchés avec un `fichier:ligne` : six `partiel`, huit `absent`, un `présent`, aucun `contredit` ; les mécaniques déjà fidèles (dégâts, CC, LoS, initiative) ne figurent pas dans cette liste de candidats.
- `7A-arena-background` trace les coins du viewport comme un choix géométrique (fond d'arène), pas comme un bug.
- Ce qui est écarté pour de bon (multi-joueurs, guildes, hôtels de vente, mode marchand, zaaps, montures, alignement, quêtes de PNJ, forgemagie, enclos, encyclopédie) est justifié ligne par ligne dans la spec : ne plus le rouvrir comme un oubli.
## Vague 6 — Fruits d'Écho, sorts avancés (AoE/buffs), Archipel
Spec de référence : `docs/design/specs/effects-engine.md`
- [ ] 6A-effects-schema — schéma des effets, gardes inertes, migration `duration` → `durationTurns` (11 occurrences)
- [ ] 6A-timed-effects — durées, max PA/PM dérivés, armure dérivée
- [ ] 6A-apmp-retrait — retrait PA/PM séquentiel (Sagesse, bornes 10–90 %)
- [ ] 6A-heal-armor — soin (Intelligence, cap PV) et absorption d'armure
- [ ] 6B intégration Fruits d'Écho et AoE
- [ ] 6B-zone-geometry — croix/cercle, murs non tronquants, LoS du centre
- [ ] 6B-cast-riders — riders + les 7 sorts, dont 2 zones
- [ ] 6C ui-archipelago · ui-echo
- [ ] 6C-push-fidelity — diagonale, distance non parcourue, RéPou
- [ ] 6C-combatants-list — `CombatState` → `combatants[]` (adaptateur 1v1)
- [ ] 6D wiring
- [ ] 6D-summon — `soupe_a_lhuile` (soin allié) + `appel_a_la_casse` (invocation max 2)
- [ ] 6D-boss-carapace — bouclier cassé sur `#` puis −2 PA
## Vague 7 — Polish, contenu, packaging Mac
- [ ] 7A renderer-polish · ux-audio
- [ ] 7A-arena-background — fond d'arène derrière le losange (coins du viewport hors carte, §12.2)
- [ ] 7B content-archipelago
- [ ] 7C polish-wiring-and-tauri
