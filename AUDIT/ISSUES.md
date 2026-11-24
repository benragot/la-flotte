# ISSUES — constats dédupliqués

> 70 constats, triés **P0** puis **P1** puis **P2**, puis par domaine à
> l'intérieur d'une sévérité. Tous les chemins sont relatifs à `src/` sauf
> mention contraire (`data/`, `tests/`, `docs/`, `scripts/`).
>
> Colonnes : `ID | Domaine | Problème | Preuves | Impact | Sévérité | Référence | Fix | Effort | Statut`.
> Effort : `S` ≈ une micro-PR d'une passe, `M` ≈ plusieurs fichiers, `L` ≈ nouveau
> sous-système. Aucun de ces constats n'a été corrigé par cet audit : tous sont
> `ouvert`.
>
> `Référence` = preuve 1.29 **par constat** : un `chemin:ligne` de la
> décompilation (`AUDIT/01_reference.md`, sections citées), ou `serveur (non
> lisible)` quand la règle est décidée côté serveur, ou `référence non trouvée`
> quand le client ne porte aucune preuve. Jamais vide, jamais inventé ; la seule
> exception `chemin` sans ligne est `Inventory.as`, cité en bloc par la référence.
>
> Chaque ligne est **déduite du code** (le `fichier:ligne` cité) ou d'une capture
> de `play-report/` ; aucune n'est une impression de jeu.

| ID | Domaine | Problème | Preuves | Impact | Sévérité | Référence | Fix | Effort | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COMBAT-01 | combat | Le 1v1 ne calcule jamais l'initiative : le héros joue toujours en premier. | `combatLoop/init.ts:118-120`, `store/useCombatStore.ts:280-283` | Combat joué d'avance. | P0 | `serveur (non lisible)` | Calculer les deux initiatives et en déduire la phase d'ouverture. | S | ouvert |
| COMBAT-02 | combat | En 1vN, si un monstre est le plus rapide, la cadence ennemie ne démarre jamais : panneau figé. | `ui/components/battle/useCombatBeat.ts:100-106`, `BattlePanel.tsx:82` | Le joueur doit cliquer « Terminer le tour » pour un monstre. | P0 | `référence non trouvée` | Lancer `scheduleStep` au montage si `needsEnemyStep`. | S | ouvert |
| GRID-01 | grille | Portée mesurée en Manhattan : une cible diagonale adjacente est à distance 2. | `combatLoop/castable.ts:16-18`, `multiCombat/range.ts:33-43` | Corps-à-corps diagonal impossible. | P1 | `serveur (non lisible)` | `rangeDistance = max(\|dx\|,\|dy\|)`, test des 8 voisins. | S | ouvert |
| GRID-02 | grille | La LoS traverse un coin où les deux orthogonales sont des murs. | `grid/lineOfSight.ts:33-50`, `tests/unit/grid.spec.ts:214-217` | Sorts tirés à travers un angle. | P1 | `%16%04%09/battlefield/%1B%17%07/%16%1E%11.as:583` | Règle des coins sur les pas diagonaux + corriger le test. | S | ouvert |
| GRID-03 | grille | Aucun aperçu de chemin ni de coût PM au survol ; `buildPathPreview` n'a aucun appelant. | `renderer/explorationScene.ts:38,101`, `combatSceneModel.ts:185`, `pathPreview.ts:80` | Clic-to-move à l'aveugle. | P1 | `%16%04%09/battlefield/%1B%17%07/%1A%04%0E.as:1196` | Alimenter `view.path` depuis `buildPathPreview(hoveredCell)`. | M | ouvert |
| INPUT-01 | input | Le clic est résolu par la case sous le pointeur, jamais par le sprite. | `renderer/pointer.ts:52-71`, `useCombatPointer.ts:56-58`, `sprites/EntitySprite.ts:8-9` | Mauvaise case visée, ennemi non attaquable à la souris. | P1 | `%16%04%09/battlefield/%17%05%03/%16%17%1B.as:633` | Hit-test des jetons avant `isoToGrid`. | M | ouvert |
| RENDER-01 | rendu | Décor non intercalé : il masque les acteurs. | `renderer/sceneLayerOrder.ts:13-27`, capture `play-report/05b-salle-donjon.png` | Héros caché derrière les barils. | P1 | `référence non trouvée` | Tri `x+y` commun acteurs + décor. | M | ouvert |
| RENDER-02 | rendu | Canvas en 1× : pas de `devicePixelRatio`. | `renderer/usePixiApp.ts:52,111` | Flou sur écran Retina. | P1 | `référence non trouvée` | `resolution: devicePixelRatio`, `autoDensity: true`. | S | ouvert |
| RENDER-03 | rendu | Murs à une seule face, base non remplie. | `renderer/tilePaint.ts:51-73` | Murs en papier avec un trou. | P1 | `référence non trouvée` | Deuxième face + remplissage du losange de base. | S | ouvert |
| RENDER-04 | rendu | Portée des sorts = nappe bleue opaque au-dessus du décor. | `renderer/tileStyle.ts:31,65`, `sceneLayerOrder.ts:15-16` | Décor et cases masqués. | P1 | `référence non trouvée` | Contour alpha 0,18 teinté par élément. | M | ouvert |
| RENDER-05 | rendu | En salle, aucune animation `attack`/`hit`. | `renderer/battleSceneModel.ts:47,63,68` | Coups invisibles hors nombres flottants. | P1 | `référence non trouvée` | Exposer `lastAction` typé. | M | ouvert |
| RENDER-06 | rendu | Aucun nom au-dessus des combattants en salle. | `renderer/tokens.ts:155,215`, `battleSceneModel.ts:62-69` | Monstres indiscernables. | P1 | `référence non trouvée` | Passer `name` aux jetons. | S | ouvert |
| UI-01 | ui | Sorts `kind: other` = clic mort ; aucun état « recharge » affiché. | `ui/spellSlotState.ts:21-27`, `combatLoop/cast.ts:171-181` | Le jeu paraît cassé. | P1 | `dofus/%18%18%12/SpellDatas.as:166-168` | Badge « à venir », désactivation, état recharge. | M | ouvert |
| UI-02 | ui | « Attaquer » reste actif à 0 PA ou en recharge. | `ui/components/battle/CombatantCard.tsx:63-69`, `multiCombat/attack.ts:29-31` | Clic sans effet. | P1 | `serveur (non lisible)` | Désactiver + libellé du coût. | S | ouvert |
| UI-03 | ui | Espace termine le tour même quand un bouton a le focus. | `ui/useGlobalShortcuts.ts:57-62` | Perte des PA/PM restants. | P1 | `référence non trouvée` | Ignorer si la cible est interactive. | S | ouvert |
| UI-04 | ui | Cartes de classe quasi identiques (6 PA/3 PM/50 PV). | `ui/components/hero/ClassCard.tsx:15-23`, `data/classes.yaml` | Choix de classe à l'aveugle. | P1 | `serveur (non lisible)` | Afficher 3 sorts + soft caps. | M | ouvert |
| UI-05 | ui | Le panneau de salle recouvre l'arène et bloque des cases. | `ui/components/battle/battleTheme.ts:14-15`, `ui/App.tsx:138-141` | Combattant invisible, cases non cliquables. | P1 | `référence non trouvée` | Réserver une colonne dans le flux. | M | ouvert |
| SPELL-01 | sorts | Aucune zone croix/cercle/ligne : le schéma n'a pas de champ `zone`. | `combatLoop/castable.ts:28-30`, `schemas/spellSchema.ts:103-122` | Sorts de zone absents. | P1 | `dofus/%18%18%12/SpellDatas.as:45` | `zone {shape,size}` + `expandZone` pur. | L | ouvert |
| SPELL-02 | sorts | 18 sorts utilitaires inertes (soin, buff, debuff, piège, glyphe). | `combatLoop/cast.ts:171-178` | Sorts sans effet, sans message. | P1 | `dofus/%18%18%12/SpellDatas.as:45` | Moteur d'effets v1 (heal/buff) par table. | L | ouvert |
| SPELL-03 | sorts | CC à 2 % fantôme, sans jet max ni dégâts critiques. | `multiCombat/crit.ts:30`, `multiCombat/strike.ts:52`, `store/battleSelectors.ts:104` | Critique mensonger. | P1 | `serveur (non lisible)` | `critRate`/`critDamage` en data + jet max. | M | ouvert |
| SPELL-04 | sorts | En 1vN, un seul sort est jouable et la téléportation est absente. | `store/useCombatStore.ts:169,528-531` | Pas de choix de sort. | P1 | `dofus/%16%02%11/Spells.as:75` | Passer `spellId` + `targetCell`. | M | ouvert |
| ITEM-01 | objets | Résistances et `% Dégâts` d'équipement jamais appliqués en combat. | `engine/hero/combatant.ts:77`, `multiCombat/strike.ts:38-52`, `ui/inventoryHudHelpers.ts:201-213` | Pièces de stuff sans effet. | P1 | `.../gapi/%17%01%0E/BannerSpriteInfos.as:44,78,101,126` | Projeter res/%dmg dans `CombatantState`. | M | ouvert |
| DATA-01 | données | Une salle de donjon nettoyée ne crédite ni XP, ni butin, ni kamas. | `store/useCombatStore.ts:738-745` (`progressedUpdate` ne pose que `battle`/`run`/`notice`), `:753-760` (`settleUpdate` soigne, sauvegarde et avance, sans `creditCombatRewards`), `tests/walkthrough/dungeon.spec.ts:271-273` (« `rewards` CONSTRUIT À LA MAIN ») | Boucle de progression du donjon cassée. | P1 | `serveur (non lisible)` | Créditer `resolveCombatRewards` par salle. | M | ouvert |
| DATA-02 | données | Kamas déclarés mais jamais crédités ni dépensés. | `data/monsters.yaml:52-53`, `store/useGameStore.ts:287-295` | Monnaie morte. | P1 | `serveur (non lisible)` | Tirage kamas + action vendre. | M | ouvert |
| DATA-03 | données | `levelGapFactor: 1` neutralise le malus d'écart de niveau. | `data/progression.yaml:59`, `economy/xp.ts:13-16` | Farm de bas niveau sans rendement décroissant. | P1 | `serveur (non lisible)` | Table d'écart niveau en données. | S | ouvert |
| COMBAT-03 | combat | Initiative du héros à 0 : il joue après tous les monstres en donjon. | `engine/createHero.ts:41-43`, `engine/dungeon/combatants.ts:54-58` | Monstres frappent d'abord à chaque salle. | P1 | `serveur (non lisible)` | Stats de base par classe dans `classes.yaml`. | M | ouvert |
| COMBAT-04 | combat | Les morts restent dans `order` et dans le panneau. | `multiCombat/turn.ts:10-13,37-44`, `renderer/battleViewModel.ts:113-118` | Carte morte affichée. | P1 | `serveur (non lisible)` | Filtrer `hp > 0`, purger `order`. | S | ouvert |
| COMBAT-05 | combat | L'ordre d'initiative du 1vN n'est jamais affiché. | `renderer/battleViewModel.ts:112-118`, `BattlePanel.tsx:57-58` | Impossible d'anticiper. | P1 | `serveur (non lisible)` | Afficher `order` filtré des vivants. | M | ouvert |
| COMBAT-06 | combat | Aucune phase de fin de tour : poison, régénération, durées inertes. | `combatLoop/turn.ts:26-32`, `multiCombat/turn.ts:37-45` | Sorts à durée sans effet. | P1 | `serveur (non lisible)` | Hook `endTurn` pur (états + poison). | L | ouvert |
| COMBAT-07 | combat | Les blocs `ai:` des monstres ne sont jamais lus. | `schemas/monsterSchema.ts:44-50`, `store/battleSelectors.ts:226-237` | Toutes les IA sont identiques. | P1 | `serveur (non lisible)` | Brancher `archetype`/`preferredDistance`. | M | ouvert |
| COMBAT-08 | combat | L'IA 1v1 choisit un sort sans tester la portée. | `combatLoop/enemy.ts:22-37` | Monstre colle au lieu de tirer. | P1 | `serveur (non lisible)` | Filtrer par `canHitOpponent`. | S | ouvert |
| GRID-04 | grille | En 1vN, un clic hors budget s'arrête en marche partielle ; le propriétaire veut un refus sec. | `multiCombat/move.ts:143-150`, `docs/design/PENDING.md:25-26` | Règle différente entre modes. | P2 | `serveur (non lisible)` | Aligner le 1vN sur le refus sec. | S | ouvert |
| GRID-05 | grille | Le 1v1 traite l'adversaire comme bloqueur de LoS, le 1vN non. | `combatLoop/castable.ts:21-25`, `multiCombat/range.ts:46-49` | Comportement imprévisible. | P2 | `%16%04%09/battlefield/%1B%17%07/%16%1E%11.as:583` | Retirer `[opponent.position]`. | S | ouvert |
| GRID-06 | grille | Le tacle n'est jamais appliqué en 1v1. | `combatLoop/move.ts:24-30`, `multiCombat/move.ts:96-103` | Fuite gratuite. | P2 | `serveur (non lisible)` | `tackleCheck` à chaque pas. | M | ouvert |
| GRID-07 | grille | Un clic sur un groupe engage le combat instantanément, sans marcher jusqu'à lui. | `store/useCombatStore.ts:423-430` | Combat surprise. | P2 | `référence non trouvée` | Pather vers une case adjacente. | M | ouvert |
| GRID-08 | grille | L'arrivée d'une sortie tombe sur la sortie de retour. | `engine/exploration/exits.ts:46-51,107-108` | Aller-retour involontaire. | P2 | `référence non trouvée` | `at` explicite / exclure les sorties. | S | ouvert |
| GRID-09 | grille | La traversée de map jette le trajet et le journal d'arrivée. | `store/useCombatStore.ts:401-415` | Saut visuel. | P2 | `référence non trouvée` | Conserver trail + concaténer le journal. | S | ouvert |
| UI-06 | ui | Journaux sans auto-scroll, combat tronqué à 5 lignes. | `ui/components/ExplorationOverlay.tsx:31-39`, `CombatLogPanel.tsx:10-12` | Message utile hors écran. | P2 | `référence non trouvée` | Auto-scroll + plafond + journal dépliable. | S | ouvert |
| UI-07 | ui | Aucune barre permanente niveau/XP/kamas. | `ui/components/RewardsSummary.tsx:12-20`, `CombatHud.tsx:123-131` | Progression invisible. | P2 | `référence non trouvée` | Barre basse 44 px. | M | ouvert |
| UI-08 | ui | Les points de sort annoncés ne sont jamais dépensables. | `ui/components/LevelUpLine.tsx:10`, `OverlayPanels.tsx:61` | Récompense morte. | P2 | `référence non trouvée` | Panneau de dépense ou retirer l'annonce. | M | ouvert |
| UI-09 | ui | Encre verrouillée à 3,07:1 de contraste. | `ui/uiTokens.ts:155-157` | Sorts illisibles au tour adverse. | P2 | `référence non trouvée` | `ink-3` (4,51:1). | S | ouvert |
| UI-10 | ui | Texte de lecture figé à 9-10 px. | `ui/uiTokens.ts:46-53` | Illisible en 1440p. | P2 | `référence non trouvée` | Plancher 11 px + `--ui-scale`. | M | ouvert |
| UI-11 | ui | Cases de sort sans pictogramme ni code d'élément. | `ui/components/SpellSlots.tsx:22,57-69` | Sorts indiscernables. | P2 | `référence non trouvée` | Icône CSS par élément. | M | ouvert |
| UI-12 | ui | Dock d'exploration de 150 px pour un panneau de 24 % de largeur. | `ui/uiTokens.ts:25-29`, `CombatHud.tsx:123-131` | 21 % de hauteur morte. | P2 | `référence non trouvée` | Hauteur au contenu (≈ 64 px). | S | ouvert |
| UI-13 | ui | Raison d'indisponibilité d'un sort seulement en `title`. | `ui/components/SpellSlots.tsx:39-44,83` | Raison invisible. | P2 | `référence non trouvée` | Badge + `aria-describedby`. | S | ouvert |
| UI-14 | ui | Clic droit ouvre le menu du navigateur. | `renderer/pointer.ts:47-60` | Annulation impossible. | P2 | `référence non trouvée` | Intercepter `contextmenu`. | S | ouvert |
| UI-15 | ui | Inventaire en liste de texte, sans icône ni double-clic. | `ui/components/inventory/BackpackList.tsx:30-34`, `EquipmentSlots.tsx:45-53` | Équiper casse le rythme. | P2 | `Inventory.as` | Icône procédurale + double-clic. | M | ouvert |
| RENDER-07 | rendu | Orientation figée à deux sens, non déduite du déplacement. | `renderer/tokens.ts:121-123`, `battleSceneModel.ts:63,68` | Héros marche à reculons. | P2 | `référence non trouvée` | Facing par delta. | M | ouvert |
| RENDER-08 | rendu | Marche à 150 ms/case pour un cycle de 500 ms. | `renderer/sprites/walkMotion.ts:10`, `data/sprites.yaml:13` | Pieds qui patinent. | P2 | `référence non trouvée` | Dériver `animationSpeed`. | M | ouvert |
| RENDER-09 | rendu | Feuilles `nearest` affichées à 0,5× et zooms non entiers. | `renderer/sprites/spriteLoader.ts:31`, `frameMath.ts:68-71` | Scintillement. | P2 | `référence non trouvée` | Régler DPR puis générer à l'échelle réelle. | S | ouvert |
| RENDER-10 | rendu | Ticker Pixi jamais arrêté + double `app.render()`. | `renderer/sceneLayers.ts:199-218` | Deux rendus par frame. | P2 | `référence non trouvée` | Stop + retirer `app.render()`. | S | ouvert |
| RENDER-11 | rendu | Toute la scène est reconstruite à chaque survol. | `renderer/useCombatScene.ts:41`, `sceneLayers.ts:321-327` | Micro-freeze. | P2 | `référence non trouvée` | Ne repeindre que les surbrillances. | M | ouvert |
| RENDER-12 | rendu | Montée des nombres flottants fixe (36 px) indépendante de l'échelle. | `renderer/floatingText.ts:9,15,50-52` | Nombres collés à la barre. | P2 | `référence non trouvée` | `FLOAT_RISE_PX * token.scale`. | S | ouvert |
| RENDER-13 | rendu | L'animation d'action est déduite du texte du journal. | `renderer/combatSceneModel.ts:53-59`, `combatLoop/cast.ts:154` | Actions non animées. | P2 | `référence non trouvée` | `lastAction` typé. | M | ouvert |
| ITEM-02 | objets | Aucun poids/pods. | `schemas/itemSchema.ts:43-48`, `inventory/stack.ts:35-40` | Sac illimité. | P2 | `Inventory.as` | `weight` + capacité Force. | M | ouvert |
| ITEM-03 | objets | Panoplies bridées à 4 slots et 4 pièces. | `schemas/itemSchema.ts:5`, `setSchema.ts:6` | Bonus de set incomplets. | P2 | `dofus/%17%05%03/ItemSet.as:337` | Tous les slots + palier 5. | M | ouvert |
| ITEM-04 | objets | La Chance est comptée deux fois dans la Prospection. | `engine/hero/combatant.ts:58-60`, `combatLoop/rewards.ts:54-55` | Drop réel ≠ PP affiché. | P2 | `dofus/%17%05%03/ItemDrop.as:223-224` | Une seule source de PP. | S | ouvert |
| ITEM-05 | objets | Soin borné à `hero.maxHp` au lieu du max effectif. | `store/useGameStore.ts:282`, `inventory/consumable.ts:4-7` | Potion inefficace. | P2 | `référence non trouvée` | Calculer sur le pool effectif. | S | ouvert |
| ITEM-06 | objets | `ring1`/`ring2` ne sont pas de vrais slots. | `inventory/equipment.ts:52-55`, `equipRequirements.ts:38-41` | Double anneau impossible. | P2 | `référence non trouvée` | Modéliser par slot. | S | ouvert |
| DATA-04 | données | Groupes annoncés 1-1 : pas d'éventail. | `data/spawns.yaml:31`, `store/useCombatStore.ts:293-295` | Pas de combat de groupe. | P2 | `serveur (non lisible)` | Étendre le 1vN aux groupes. | L | ouvert |
| DATA-05 | données | Respawn immédiat à la victoire. | `exploration/groups.ts:162-166` | Farm infini. | P2 | `serveur (non lisible)` | Horodater + délai. | M | ouvert |
| DATA-06 | données | Sauvegarde sans carte/exploration/donjon. | `save/saveSchema.ts:69-75`, `store/useGameStore.ts:502` | Rechargement = départ. | P2 | `référence non trouvée` | Persister map/exploration/run. | M | ouvert |
| DATA-07 | données | `baseXp` hors échelle (Piou 120 XP vs palier 2 = 110). | `data/monsters.yaml:29`, `data/progression.yaml:6` | Niveau 2 en un combat. | P2 | `serveur (non lisible)` | Recalibrer la table. | S | ouvert |
| DATA-08 | données | PV de donjon réduits (`hpScale` 29-33 %). | `data/dungeons.yaml:40,53`, `dungeon/combatants.ts:72-74` | Salles plus faibles qu'en extérieur. | P2 | `référence non trouvée` | Retirer `hpScale`. | S | ouvert |
| SPELL-05 | sorts | `castsPerTarget` déclaré mais jamais appliqué. | `spellUsage.ts:11-14`, `spellSchema.ts:119` | Sort spam sur la même cible. | P2 | `serveur (non lisible)` | Compter par cible. | S | ouvert |
| SPELL-06 | sorts | Retrait PA/PM absent du schéma et jamais branché. | `combat/apMpLoss.ts:34`, `data/spells.yaml:58` | Sorts de retrait inexistants. | P2 | `dofus/%18%18%12/SpellDatas.as:45` | `effect: ap_remove/mp_remove`. | M | ouvert |
| SPELL-07 | sorts | Échec critique absent. | `multiCombat/attack.ts:58-62` | Pas de tension au lancer. | P2 | `serveur (non lisible)` | `critResult: hit/miss/none`. | M | ouvert |
| SPELL-08 | sorts | Dégâts de poussée soustraits sans résistances. | `combatLoop/cast.ts:143-149` | Tank puni comme un mage. | P2 | `serveur (non lisible)` | Passer par `computeDamage`. | S | ouvert |
| SPELL-09 | sorts | `requiresState` jamais vérifié. | `schemas/spellSchema.ts:120` | Sort lançable sans l'état requis. | P2 | `dofus/%18%18%12/SpellDatas.as:45` | États + refus `missing-state`. | S | ouvert |
| TEST-01 | qualité | Le harness ne clique jamais un monstre ni une sortie : le cœur de boucle n'est pas couvert. | `scripts/play/steps.mjs:32-103` | Régression silencieuse. | P2 | `référence non trouvée` | Ajouter 2 étapes smoke (clic monstre, sortie). | M | ouvert |

## Hors périmètre (décisions propriétaire)

Ces points **ne sont pas des bugs** : ils sont arbitrés par le propriétaire et
documentés. Un agent ne les « corrige » pas sans nouvelle décision.

| Réf | Sujet | Décision |
| --- | --- | --- |
| DEC-10 | diagonale à **2 PM** | Écart **assumé** à Dofus 1.29 (où chaque case entrée coûte 1 PM) ; voir `docs/design/specs/ui-dofus-retro.md:207-237`. Ne pas « corriger » sans arbitrage. |
| PENDING:25-26 | **refus sec** hors budget de PM | Décision du propriétaire : aucun déplacement partiel ; le 1vN doit s'aligner (GRID-04), ce n'est pas une liberté d'implémentation. |
| DEC-03 | **soin entre les salles** | Entorse assumée à Dofus : `data/dungeons.yaml` porte `healBetweenRooms`, livré par #80. |
| DEC-06 | **mort sans pénalité** | Assumé : pas de perte d'XP ni de retour au temple ; hors périmètre de l'audit. |
| Éventail 1-1 | groupes de monstres **1-1** | Les `data/spawns.yaml` annoncent des groupes d'un monstre : état de données assumé, pas une régression (DATA-04 reste un manque de fonctionnalité, pas une anomalie). |
| Mono-joueur | **PvP, guildes, HDV** | Hors périmètre produit : aucun de ces systèmes n'est attendu, leur absence n'est pas un constat. |
| ARCH-01 | **deux moteurs de combat** (`combatLoop` 1v1 + `multiCombat` 1vN) | Unification = **changement d'architecture**, pas un fix ; arbitrage propriétaire requis. En attendant, tout correctif de formule doit être appliqué **deux fois** (voir les écarts GRID-04/05, SPELL-04). |

## Backlog

Constats **non retenus** comme issues (soit hors périmètre, soit trop diffus, soit
relevant d'une spec à écrire), un par ligne :

- Chat : canaux couleur/eau/feu absents — traité par la spec `ui-dofus-retro.md`, pas un bug isolé.
- Timeline : animation de l'initiative (rail) non priorisée tant que COMBAT-05 n'est pas livré.
- Médaillon central (anneau de tour, XP circulaire) — refonte UI globale, hors audit.
- Carte du monde et coordonnées de zone — dépend de DATA-06 (sauvegarde) avant tout intérêt.
- Métiers de récolte, outils et ressources — hors périmètre du jeu actuel (décision produit).
- Conditions d'équipement (niveau, caractéristiques) — vérifiées par `equipRequirements.ts`, seuls les anneaux posent problème (ITEM-06).
- Chaîne build : chunk principal > 500 kB — avertissement Vite, pas un défaut fonctionnel.
- `data/recipes.yaml` et `src/engine/craft/` : code présent, aucune UI — fonctionnalité future, pas un écart 1.29.
- Durée de tour (timer) : absent côté client 1.29 aussi, donc non comparable.
- Invocations : aucun système d'invocation, donc « ordre des invocations » sans objet.
