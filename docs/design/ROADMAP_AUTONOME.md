# Roadmap autonome — La Flotte
Légende : [ ] à faire · [x] fait
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
- [x] 5C-a panneau de combat 1vN — rendu des N ennemis, ciblage et journal (PR #44)
- [x] 5C-b sorts des monstres de la Ferraille (données) — PR #46
- [x] 5C-c câbler `battleEnemyTurn` — les ennemis ripostent — PR #48
- [ ] 5C-d portée et ligne de vue — `map` dans `BattleState`
- [x] 5C-e walkthrough de la chaîne de la clé (PR #45)
- [ ] 5D-a premier donjon jouable — déclencher une salle depuis le jeu
- [ ] 5D wiring
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
- [ ] 7B content-archipelago
- [ ] 7C polish-wiring-and-tauri
