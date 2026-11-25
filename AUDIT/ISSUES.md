# ISSUES — constats dédupliqués

> **État constaté sur `218f8e3` (`main`, 2026-11-25 à 23:40 CET).** Ce fichier
> est un **instantané**, pas une vérité instantanée : un merge postérieur à ce
> commit n'y est pas reflété. Toute ligne de `main` ajoutée après `218f8e3` est
> à revérifier ; `git rev-list --count 218f8e3..origin/main` dit combien de
> commits manquent au moment de la lecture. Les `fichier:ligne` ont été
> re-vérifiés un par un sur ce commit : chemins, bornes **et symbole cité**
> contrôlés par script, sémantique relue à la main ; un décalage de ligne dû à
> un merge ultérieur est un faux positif connu de ce genre de document.
>
> **77 constats initiaux**, triés **P0** puis **P1** puis **P2**, puis par
> domaine à l'intérieur d'une sévérité. **Cinq écarts découverts en cours de
> route** (ARCH-02, ARCH-03, ARCH-04, CI-01, UI-16) sont consignés dans leur
> propre section : le suivi porte donc sur **82 constats**. Les notes de méthode
> et d'outillage de cette section ne sont **pas** des constats et ne comptent pas.
> Tous les chemins sont relatifs à `src/` sauf mention contraire (`data/`,
> `tests/`, `docs/`, `scripts/`).
>
> Colonnes : `ID | Domaine | Problème | Preuves | Impact | Sévérité | Référence | Fix | Effort | Statut`.
> Effort : `S` ≈ une micro-PR d'une passe, `M` ≈ plusieurs fichiers, `L` ≈ nouveau
> sous-système.
>
> **Compteurs (instantané `218f8e3`)** : sur les **82 constats suivis**, **26
> clos** (`fixed`), **4 partiels**, **1 re-cadré** (COMBAT-03 → MONSTER-01),
> **51 ouverts**. Par sévérité : P0 **0 ouvert** (2 clos), P1 **5 ouverts**
> (21 clos, 4 partiels, 1 re-cadré), P2 **46 ouverts** (3 clos). Répartition des
> clos : P0 2, P1 21, P2 3. Les **partiels** sont `INPUT-01`, `DATA-02`,
> `SPELL-02` et `GRID-03` : leur volet livré est cité, leur reste ne se ferme pas.
>
> **Plage de PR couverte : `0472ead..218f8e3`.** `git rev-list --count` y compte
> **15 PR mergées**, dont **2 documentaires** (#169, #172) et donc **13 PR de
> code** (#164, #168, #170, #171, #173, #174, #175, #176, #177, #178, #179,
> #180, #181). `#182` (RENDER-05) est **en corrections** et `#184`
> (`castsPerTarget`) est **ouverte** au même instant : rien de leur périmètre
> n'est compté comme livré. La méthode de comptage vérifiable est en
> fin de fichier (`## Comptage`) ; les hashes sont dans `## Suivi des merges`.
>
> `Référence` = preuve 1.29 **par constat** : un `chemin:ligne` de la
> décompilation (`AUDIT/01_reference.md`, sections citées), ou `serveur (non
> lisible)` quand la règle est décidée côté serveur, ou `référence non trouvée`
> quand le client ne porte aucune preuve. Jamais vide, jamais inventé ; la seule
> exception `chemin` sans ligne est `Inventory.as`, cité en bloc par la référence.
>
> Chaque ligne est **déduite du code** (le `fichier:ligne` cité) ou d'une capture
> de `play-report/` ; aucune n'est une impression de jeu.

## Tableau des constats

| ID | Domaine | Problème | Preuves | Impact | Sévérité | Référence | Fix | Effort | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COMBAT-01 | combat | Le 1v1 ne calcule jamais l'initiative : le héros joue toujours en premier. | `combatLoop/init.ts:120-125`, `combatLoop/opening.ts:21-23` | Combat joué d'avance. | P0 | `serveur (non lisible)` | Calculer les deux initiatives et en déduire la phase d'ouverture. | S | fixed (#139, fff5d3d) |
| COMBAT-02 | combat | En 1vN, si un monstre est le plus rapide, la cadence ennemie ne démarre jamais : panneau figé. | `ui/components/battle/useCombatBeat.ts:100-106`, `BattlePanel.tsx:82` | Le joueur doit cliquer « Terminer le tour » pour un monstre. | P0 | `référence non trouvée` | Lancer `scheduleStep` au montage si `needsEnemyStep`. | S | fixed (#136, 8797ac5) |
| GRID-01 | grille | Portée mesurée en Manhattan : une cible diagonale adjacente est à distance 2. | `combatLoop/castable.ts:16-18`, `multiCombat/range.ts:33-43` | Corps-à-corps diagonal impossible. | P1 | `serveur (non lisible)` | `rangeDistance = max(\|dx\|,\|dy\|)`, test des 8 voisins. | S | fixed (#141, 62ecdda) |
| GRID-02 | grille | La LoS traverse un coin où les deux orthogonales sont des murs. | `grid/lineOfSight.ts:33-50`, `tests/unit/grid.spec.ts:214-217` | Sorts tirés à travers un angle. | P1 | `%16%04%09/battlefield/%1B%17%07/%16%1E%11.as:583` | Règle des coins sur les pas diagonaux + corriger le test. | S | fixed (#145, ab86aaf) |
| GRID-03 | grille | Aucun aperçu de chemin ni de coût PM au survol ; `buildPathPreview` n'a aucun appelant. | `renderer/combatSceneModel.ts:123`, `renderer/pathPreview.ts:80`, `renderer/battleSceneModel.ts:104`, `ui/useExplorationPointer.ts:22-33` | Clic-to-move à l'aveugle hors 1v1. | P1 | `%16%04%09/battlefield/%1B%17%07/%1A%04%0E.as:1196` | Alimenter `view.path` depuis `buildPathPreview(hoveredCell)` dans les trois surfaces. | M | partiel (#166, 0472ead) — 1v1 : chemin et coût PM au survol via `hoverPathPreview` (`renderer/combatSceneModel.ts:117-123`). Restent l'exploration libre (clic résolu par la case, aucun survol suivi, `ui/useExplorationPointer.ts:22-33`) et les salles (`renderer/battleSceneModel.ts:104` renvoie encore `path: []`). |
| INPUT-01 | input | Le clic d'exploration est résolu par la case sous le pointeur, jamais par le sprite ; le combat, lui, teste le jeton. | `renderer/pointer.ts:48-50`, `renderer/useCombatPointer.ts:77-79,116-117`, `renderer/sprites/tokenHit.ts:85,110`, `ui/useExplorationPointer.ts:22-33` | Mauvaise case visée en exploration, ennemi d'exploration non attaquable à la souris. | P1 | `%16%04%09/battlefield/%17%05%03/%16%17%1B.as:633` | Hit-test des jetons avant `isoToGrid`, puis brancher la même résolution sur le pointeur DOM d'exploration. | M | partiel (#173, 1de2369) — en salle, `pickToken` teste le sprite avant la case (`renderer/useCombatPointer.ts:77-79`, `renderer/sprites/tokenHit.ts:110`). En exploration libre, le clic DOM passe toujours par `cellAtPoint` (`ui/useExplorationPointer.ts:22-33`) : le chemin sprite n'est pas branché. |
| RENDER-01 | rendu | Décor non intercalé : il masque les acteurs. | `renderer/sceneLayerOrder.ts:13-27`, `renderer/depthOrder.ts:9-11,25-31`, `renderer/sprites/actorStage.ts:20-33` | Héros caché derrière les barils. | P1 | `référence non trouvée` | Tri `x+y` commun acteurs + décor. | M | fixed (#170, dfd56ab) — `depthOf`/`compareDepth` trient décor et acteurs sur le même axe `x+y`, `actorStage` reçoit le décor occlusif (`props`) et `sceneLayers` peint `decorAbove` après les acteurs (`renderer/sceneLayers.ts:271`). |
| RENDER-02 | rendu | Canvas en 1× : pas de `devicePixelRatio`. | `renderer/usePixiApp.ts:52,111` | Flou sur écran Retina. | P1 | `référence non trouvée` | `resolution: devicePixelRatio`, `autoDensity: true`. | S | fixed (#138, 10d516b) |
| RENDER-03 | rendu | Murs à une seule face, base non remplie. | `renderer/tilePaint.ts:51-73` | Murs en papier avec un trou. | P1 | `référence non trouvée` | Deuxième face + remplissage du losange de base. | S | fixed (#147, a665ea5) |
| RENDER-04 | rendu | Portée des sorts = nappe bleue opaque au-dessus du décor. | `renderer/tileStyle.ts:40,77` (`HIGHLIGHT_ALPHA = 0.5`), `renderer/sceneLayerOrder.ts:14-17` | Décor et cases masqués. | P1 | `référence non trouvée` | Contour alpha 0,18 teinté par élément. | M | ouvert — la zone PM est déjà à 0,18 (`tileStyle.ts:42,78`) ; la case de sort reste un aplat à 0,5 posé après le décor. |
| RENDER-05 | rendu | En salle, aucune animation `attack`/`hit`. | `renderer/battleSceneModel.ts:37,104` (`lastAction: null`), `renderer/combatSceneModel.ts:165` | Coups invisibles hors nombres flottants. | P1 | `référence non trouvée` | Exposer `lastAction` typé. | M | ouvert |
| RENDER-06 | rendu | Aucun nom au-dessus des combattants en salle. | `renderer/tokens.ts:151,160-161`, `renderer/battleSceneModel.ts:85-89` | Monstres indiscernables. | P1 | `référence non trouvée` | Passer `name` aux jetons. | S | fixed (#151, 54da359) |
| UI-01 | ui | Sorts `kind: other` = clic mort ; aucun état « recharge » affiché. | `ui/spellSlotState.ts:21-27,106-140`, `combatLoop/spellSupport.ts:13-45`, `combatLoop/cast.ts:196` | Le jeu paraît cassé. | P1 | `dofus/%18%18%12/SpellDatas.as:166-168` | Badge « à venir », désactivation, état recharge. | M | fixed (#156, 655de28) — liste blanche `damage`/`teleport` (`spellSupport.ts:13`) complétée par `heal` (#179), refus nommés `not-implemented`/`missing-state`, cases inertes avec badge et raison, états recharge/quota distincts. |
| UI-02 | ui | « Attaquer » reste actif à 0 PA ou en recharge. | `ui/components/battle/CombatantCard.tsx:74-80`, `multiCombat/attack.ts:29-31` | Clic sans effet. | P1 | `serveur (non lisible)` | Désactiver + libellé du coût. | S | fixed (#146, f62edf4) |
| UI-03 | ui | Espace termine le tour même quand un bouton a le focus. | `ui/useGlobalShortcuts.ts:57-62` | Perte des PA/PM restants. | P1 | `référence non trouvée` | Ignorer si la cible est interactive. | S | fixed (#144, 5ccacd6) |
| UI-04 | ui | Cartes de classe quasi identiques (6 PA/3 PM/50 PV). | `ui/components/hero/ClassCard.tsx:15-78`, `ui/components/hero/classIdentity.ts:9-68`, `data/classes.yaml` | Choix de classe à l'aveugle. | P1 | `serveur (non lisible)` | Afficher 3 sorts + soft caps. | M | fixed (#165, 55e783b) — trois sorts réels de `data/spells.yaml` et quatre paliers de soft cap de `data/classes.yaml` par carte, sans répéter le socle commun. |
| UI-05 | ui | Le panneau de salle recouvre l'arène et bloque des cases. | `ui/components/battle/battleTheme.ts:20-21`, `ui/App.tsx:36,223-230` | Combattant invisible, cases non cliquables. | P1 | `référence non trouvée` | Réserver une colonne dans le flux. | M | fixed (#181, 218f8e3) — `BATTLE_PANEL` est `relative ... w-[320px] shrink-0` (`battleTheme.ts:20-21`) et `ArenaRow` place le panneau en **frère** de l'arène, qui garde `flex-1` (`App.tsx:36,223-230`). |
| SPELL-01 | sorts | Aucune zone croix/cercle/ligne : le schéma n'a pas de champ `zone`. | `combatLoop/castable.ts:28-30`, `schemas/spellSchema.ts:103-122` | Sorts de zone absents. | P1 | `dofus/%18%18%12/SpellDatas.as:45` | `zone {shape,size}` + `expandZone` pur. | L | ouvert |
| SPELL-02 | sorts | 18 sorts utilitaires inertes (soin, buff, debuff, piège, glyphe). | `combatLoop/spellSupport.ts:13-16,22-30`, `combat/heal.ts:21-45`, `multiCombat/heal.ts:90`, `data/spells.yaml:453-461` | Sorts sans effet, sans message. | P1 | `dofus/%18%18%12/SpellDatas.as:45` | Moteur d'effets v1 (heal/buff) par table. | L | partiel (#179, a44a089) — le **soin** est consommé : `HANDLED_EFFECTS` ne contient que `heal` (`spellSupport.ts:16`) et `mot_curatif` (`data/spells.yaml:453`) passe la liste blanche via `isHealSpell` (`spellSupport.ts:22-30`), avec la formule dans `combat/heal.ts:21-45` et le 1vN dans `multiCombat/heal.ts:90`. Restent **buffs, debuffs, pièges et glyphes** : `HANDLED_EFFECTS` ne les connaît pas, donc toujours refusés `not-implemented`. |
| SPELL-03 | sorts | CC à 2 % fantôme, sans jet max ni dégâts critiques. | `multiCombat/crit.ts:16-19`, `multiCombat/attack.ts:59-73`, `schemas/spellSchema.ts:135-137` | Critique mensonger. | P1 | `serveur (non lisible)` | `critRate`/`critDamage` en data + jet max. | M | fixed (#171, 0455a19) — le CC est un **dénominateur** (`rng() * X < 1`, `crit.ts:16-19`), le jet critique prend `critMax` ou le haut de la fourchette (`attack.ts:59-70`), et **sans `critRate` déclaré aucun CC n'est tiré** : le 2 % fantôme a disparu. Le schéma porte les deux champs (`spellSchema.ts:135-137`) ; aucune valeur n'est encore posée dans `data/spells.yaml`, donc aucun CC en jeu aujourd'hui — comportement honnête, pas une régression. |
| SPELL-04 | sorts | En 1vN, un seul sort est jouable et la téléportation est absente. | `store/useCombatStore.ts:106,367,573` | Pas de choix de sort. | P1 | `dofus/%16%02%11/Spells.as:75` | Passer `spellId` + `targetCell`. | M | ouvert |
| ITEM-01 | objets | Résistances et `% Dégâts` d'équipement jamais appliqués en combat. | `engine/hero/combatant.ts:77`, `multiCombat/strike.ts:38-52`, `ui/inventoryHudHelpers.ts:201-213` | Pièces de stuff sans effet. | P1 | `.../gapi/%17%01%0E/BannerSpriteInfos.as:44,78,101,126` | Projeter res/%dmg dans `CombatantState`. | M | fixed (#149, 9c7dd8a) |
| DATA-01 | données | Une salle de donjon nettoyée ne crédite ni XP, ni butin, ni kamas. | `engine/dungeon/rewards.ts:65-70`, `store/useCombatStore.ts:976-1050`, `tests/unit/dungeonRewards.spec.ts` | Boucle de progression du donjon cassée. | P1 | `serveur (non lisible)` | Créditer `resolveCombatRewards` par salle. | M | fixed (#157, 5ed363f) — `resolveRoomRewards` crédite XP, butin et kamas à la clôture d'une salle, une seule fois (`wonBattle` faux après ouverture de la suivante). |
| DATA-02 | données | Kamas **crédités mais jamais dépensés** : le credit est livré (#157) et le moteur de vente aussi (#177), mais **aucun écran** n'appelle `sellItem`. | `engine/economy/sell.ts:65`, `store/useGameStore.ts:89,307`, `ui/components/inventory/BackpackList.tsx:30-34` | Monnaie gagnée, jamais utilisable par un joueur. | P1 | `serveur (non lisible)` | Tirage kamas (fait) + action vendre (moteur fait) + écran de vente. | M | partiel (#177, 0754f15) — `sellItem` est branché au store (`useGameStore.ts:89,307`) et testé (`tests/unit/sellItem.spec.ts`) ; aucun composant de `src/ui/` ne l'appelle, donc la dépense reste inaccessible en jeu. |
| DATA-03 | données | `levelGapFactor: 1` neutralise le malus d'écart de niveau. | `data/progression.yaml:59`, `economy/xp.ts:13-16` | Farm de bas niveau sans rendement décroissant. | P1 | `serveur (non lisible)` | Table d'écart niveau en données. | S | fixed (#152, b873cc2) |
| COMBAT-03 | combat | **Re-cadré** — il n'y a pas de stat de base manquante : Dofus 1.29 n'attribue **aucune** statistique de départ par classe, et un héros niveau 1 a donc bien 0 partout, soit une initiative de **0** (`Init = floor((For+Int+Cha+Agi+bonus) × PV/PVmax)`, PV plein). L'écart observé — le héros joue après les monstres — vient des **données de monstres du projet**, pas d'une table de stats de classe (voir MONSTER-01). | `engine/combat/initiative.ts:11-22`, `engine/createHero.ts:36-43`, `data/classes.yaml` | Constat mal cadré au départ : rien à ajouter côté classes. | P1 | `serveur (non lisible)` | Re-cadré vers MONSTER-01 ; le seul vrai écart du périmètre (`baseHp` 50 → 55) est corrigé par #148. | S | re-cadré (#148, 89d9886 → MONSTER-01) |
| COMBAT-04 | combat | Les morts restent dans `order` et dans le panneau. | `multiCombat/turn.ts:10-13,37-44`, `renderer/battleViewModel.ts:113-118` | Carte morte affichée. | P1 | `serveur (non lisible)` | Filtrer `hp > 0`, purger `order`. | S | fixed (#135, 1512b56) |
| COMBAT-05 | combat | L'ordre d'initiative du 1vN n'est jamais affiché. | `renderer/battleViewModel.ts:136-140`, `ui/components/battle/BattlePanel.tsx:107`, `ui/components/battle/InitiativeBand.tsx` | Impossible d'anticiper. | P1 | `serveur (non lisible)` | Afficher `order` filtré des vivants. | M | fixed (#168, 061a122) — `initiativeOrder` résout `order` en combattants vivants (`battleViewModel.ts:136-140`) et `BattlePanel` rend `InitiativeBand` (`BattlePanel.tsx:107`) ; le mort est déjà purgé par COMBAT-04. |
| COMBAT-06 | combat | Aucune phase de fin de tour : poison, régénération, durées inertes. | `combatLoop/turn.ts:26-32`, `multiCombat/turn.ts:37-45` | Sorts à durée sans effet. | P1 | `serveur (non lisible)` | Hook `endTurn` pur (états + poison). | L | ouvert |
| COMBAT-07 | combat | Les blocs `ai:` des monstres ne sont jamais lus. | `engine/multiCombat/ai.ts:50-55`, `engine/multiCombat/keepDistance.ts:15`, `store/battleSelectors.ts:322-338`, `schemas/monsterSchema.ts:44-50`, `data/monsters.yaml:114`, `data/spells.yaml:123-135` | Toutes les IA sont identiques. | P1 | `serveur (non lisible)` | Brancher `archetype`/`preferredDistance`. | M | fixed (#175, 6bd12c0 + #178, 30889b4) — les blocs `ai:` sont lus (`enemyStrategy` → `aimOf`, câblés par `battleSelectors.ts:332-338`) ; la portée de la Marmite est désormais une donnée cohérente (`fer_spell_projection_de_mazout`, 4-5, `cooldown: 2`, `data/spells.yaml:123-135`, attachée en premier dans `data/monsters.yaml:114`) et le test `tests/data/marmiteRange.spec.ts:16-33` la fige. La régression de softlock a été corrigée par #180. |
| COMBAT-08 | combat | L'IA 1v1 choisit un sort sans tester la portée. | `combatLoop/enemy.ts:22-37` | Monstre colle au lieu de tirer. | P1 | `serveur (non lisible)` | Filtrer par `canHitOpponent`. | S | fixed (#140, 4ed327c) |
| BALANCE-01 | équilibrage | Après GRID-01, le donjon niveau 16 perdait la salle 4 (violation DEC-03) ; soin entre salles 0,50→0,75, levier autorisé par DEC-03, sans nerf de dégâts ni `hpScale`. | `data/dungeons.yaml` (`healBetweenRooms`), `tests/walkthrough/gearedDungeon.spec.ts` | Donjon recommandé niveau 16 injouable. | P1 | `docs/design/DECISIONS.md:25-32` | Soin entre salles 0,75, rien d'autre. | S | fixed (#142, 5ae59cf) |
| MONSTER-01 | données | Les stats des monstres du projet sont inventées : `data/monsters.yaml:27` donne `strength: 15` au Piou, d'où une initiative de 15 face à 0 pour un héros niveau 1 — les monstres ouvrent donc tous les combats. Le calcul du moteur est pourtant conforme (`Init = floor((For+Int+Cha+Agi+bonus) × PV/PVmax)`). | `data/monsters.yaml:22-27`, `engine/combat/initiative.ts:11-22`, `engine/dungeon/combatants.ts:57-62`, `engine/battleBridge/fromExploration.ts:53-58` | Le héros joue systématiquement après les monstres, donjon comme extérieur. | P2 | `serveur (non lisible)` (provenance des stats de monstres non établie côté client) | Aligner les stats des monstres bas niveau, ou documenter l'écart de données. | M | fixed (#163, 551e8a8 + #167, f0519a4) — `initiative` stockée par grade au schéma et au Piou (0), lue par les deux moteurs via `computeInitiative` ; égalité d'initiative, le héros ouvre. |
| COMBAT-09 | combat | L'agrégation XP de groupe 1vN (Σ des `baseXp`, `max(M)` pour le facteur et `H`) n'est pas implémentée ; `rewards.ts` traite le 1v1 (`H = M`). | `engine/dungeon/rewards.ts:35-39,65-70`, `tests/unit/dungeonRewards.spec.ts` | XP de groupe faussée dès qu'une salle dépasse un monstre. | P2 | `serveur (non lisible)` | Agréger l'XP de groupe — à faire avec DATA-01. | M | fixed (#157, 5ed363f) — `aggregateMonster` somme les `baseXp`, fusionne le butin et garde `max(M)` pour l'écart de niveau et l'anti-farm. |
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
| RENDER-07 | rendu | Orientation figée à deux sens, non déduite du déplacement. | `renderer/tokens.ts:121-123`, `renderer/battleSceneModel.ts:63-69` | Héros marche à reculons. | P2 | `référence non trouvée` | Facing par delta. | M | ouvert |
| RENDER-08 | rendu | Marche à 150 ms/case pour un cycle de 500 ms. | `renderer/sprites/walkMotion.ts:10`, `data/sprites.yaml:13` | Pieds qui patinent. | P2 | `référence non trouvée` | Dériver `animationSpeed`. | M | ouvert |
| RENDER-09 | rendu | Feuilles `nearest` affichées à 0,5× et zooms non entiers. | `renderer/sprites/spriteLoader.ts:31`, `frameMath.ts:68-71` | Scintillement. | P2 | `référence non trouvée` | Régler DPR puis générer à l'échelle réelle. | S | ouvert |
| RENDER-10 | rendu | Ticker Pixi jamais arrêté + double `app.render()`. | `renderer/sceneLayers.ts:199-218` | Deux rendus par frame. | P2 | `référence non trouvée` | Stop + retirer `app.render()`. | S | ouvert |
| RENDER-11 | rendu | Toute la scène est reconstruite à chaque survol. | `renderer/useCombatScene.ts:41`, `sceneLayers.ts:321-327` | Micro-freeze. | P2 | `référence non trouvée` | Ne repeindre que les surbrillances. | M | ouvert |
| RENDER-12 | rendu | Montée des nombres flottants fixe (36 px) indépendante de l'échelle. | `renderer/floatingText.ts:9,15,50-52` | Nombres collés à la barre. | P2 | `référence non trouvée` | `FLOAT_RISE_PX * token.scale`. | S | ouvert |
| RENDER-13 | rendu | L'animation d'action est déduite du texte du journal. | `renderer/combatSceneModel.ts:151-170` | Actions non animées. | P2 | `référence non trouvée` | `lastAction` typé. | M | ouvert |
| RENDER-14 | rendu | Deux jetons adjacents peuvent avoir leurs noms qui se touchent : aucune déconfliction nom↔nom. | `renderer/labels.ts` (PR #151) | Noms superposés, combattants illisibles côte à côte. | P2 | `référence non trouvée` | Déconfliction nom↔nom (décalage vertical ou masquage). | S | ouvert |
| RENDER-15 | rendu | En salle 1, le nom du héros est masqué par le bandeau HTML : la borne est le canvas, pas la zone sûre du HUD. | `renderer/labels.ts` (PR #151) | Nom du héros invisible dans la première salle. | P2 | `référence non trouvée` | Clamper les labels dans la zone sûre du HUD. | S | ouvert |
| ITEM-02 | objets | Aucun poids/pods. | `schemas/itemSchema.ts:43-48`, `inventory/stack.ts:35-40` | Sac illimité. | P2 | `Inventory.as` | `weight` + capacité Force. | M | ouvert |
| ITEM-03 | objets | Panoplies bridées à 4 slots et 4 pièces. | `schemas/itemSchema.ts:5`, `setSchema.ts:6` | Bonus de set incomplets. | P2 | `dofus/%17%05%03/ItemSet.as:337` | Tous les slots + palier 5. | M | ouvert |
| ITEM-04 | objets | La Chance est comptée deux fois dans la Prospection. | `engine/hero/combatant.ts:58-60`, `combatLoop/rewards.ts:54-55` | Drop réel ≠ PP affiché. | P2 | `dofus/%17%05%03/ItemDrop.as:223-224` | Une seule source de PP. | S | ouvert |
| ITEM-05 | objets | Soin borné à `hero.maxHp` au lieu du max effectif. | `store/useGameStore.ts:282`, `inventory/consumable.ts:4-7` | Potion inefficace. | P2 | `référence non trouvée` | Calculer sur le pool effectif. | S | ouvert |
| ITEM-06 | objets | `ring1`/`ring2` ne sont pas de vrais slots. | `inventory/equipment.ts:52-55`, `equipRequirements.ts:38-41` | Double anneau impossible. | P2 | `référence non trouvée` | Modéliser par slot. | S | ouvert |
| ITEM-07 | objets | Les résistances élémentaires sont globales (`flatRes`/`percentRes`) projetées sur les 5 éléments ; aucune donnée par élément. | `engine/hero/combatant.ts` (PR #149) | Un stuff « résistant au feu » protège de tout. | P2 | `serveur (non lisible)` | Résistances par élément en données — feature data. | M | ouvert |
| DATA-04 | données | Groupes annoncés 1-1 : pas d'éventail. | `data/spawns.yaml:31`, `store/useCombatStore.ts:293-295` | Pas de combat de groupe. | P2 | `serveur (non lisible)` | Étendre le 1vN aux groupes. | L | ouvert |
| DATA-05 | données | Respawn immédiat à la victoire. | `exploration/groups.ts:162-166` | Farm infini. | P2 | `serveur (non lisible)` | Horodater + délai. | M | ouvert |
| DATA-06 | données | Sauvegarde sans carte/exploration/donjon. | `save/saveSchema.ts:69-75`, `store/useGameStore.ts:502` | Rechargement = départ. | P2 | `référence non trouvée` | Persister map/exploration/run. | M | ouvert |
| DATA-07 | données | `baseXp` hors échelle (Piou 120 XP vs palier 2 = 110). | `data/monsters.yaml:29`, `data/progression.yaml:6` | Niveau 2 en un combat. | P2 | `serveur (non lisible)` | Recalibrer la table. | S | ouvert |
| DATA-08 | données | PV de donjon réduits (`hpScale` 29-33 %). | `data/dungeons.yaml:40,53`, `dungeon/combatants.ts:72-74` | Salles plus faibles qu'en extérieur. | P2 | `référence non trouvée` | Retirer `hpScale`. | S | ouvert |
| DATA-09 | données | 4ᵉ palier Intelligence Enutrof : 140 (projet, Dofuzion/Gamosaurus/JOL) vs 150 (Solomonk/129dofus). Non tranché, valeur 140 conservée. | `data/classes.yaml:58` | Palier de soft cap incertain au-delà de 100 en Intelligence. | P2 | `serveur (non lisible)` | Vérifier côté serveur, puis trancher la valeur. | S | ouvert |
| SPELL-05 | sorts | `castsPerTarget` déclaré mais jamais appliqué. | `spellUsage.ts:11-13`, `schemas/spellSchema.ts:141` | Sort spam sur la même cible. | P2 | `serveur (non lisible)` | Compter par cible. | S | ouvert |
| SPELL-06 | sorts | Retrait PA/PM absent du schéma et jamais branché. | `combat/apMpLoss.ts:34`, `data/spells.yaml:58` | Sorts de retrait inexistants. | P2 | `dofus/%18%18%12/SpellDatas.as:45` | `effect: ap_remove/mp_remove`. | M | ouvert |
| SPELL-07 | sorts | Échec critique absent. | `multiCombat/attack.ts:58-62` | Pas de tension au lancer. | P2 | `serveur (non lisible)` | `critResult: hit/miss/none`. | M | ouvert |
| SPELL-08 | sorts | Dégâts de poussée soustraits sans résistances. | `combatLoop/cast.ts:143-149` | Tank puni comme un mage. | P2 | `serveur (non lisible)` | Passer par `computeDamage`. | S | ouvert |
| SPELL-09 | sorts | `requiresState` jamais vérifié. | `schemas/spellSchema.ts:142`, `combatLoop/spellSupport.ts:33-45`, `combatLoop/cast.ts:196` | Sort lançable sans l'état requis. | P2 | `dofus/%18%18%12/SpellDatas.as:45` | États + refus `missing-state`. | S | fixed (#156, 655de28) — refus `missing-state` posé au moteur et à l'UI (`etat-non-gere`) ; le **système** d'états reste à livrer avec SPELL-02, suivi par UI-16. |
| TEST-01 | qualité | Le harness ne clique jamais un monstre ni une sortie : le cœur de boucle n'est pas couvert. | `scripts/play/steps.mjs:32-103` | Régression silencieuse. | P2 | `référence non trouvée` | Ajouter 2 étapes smoke (clic monstre, sortie). | M | ouvert |

## Écarts découverts en cours de route

Ces constats ne figuraient pas dans l'inventaire initial : les PR #156 à #180 les
ont rendus visibles. **Cinq** écarts comptent dans le total de **82** :
ARCH-02 est **clos** par #174, les quatre autres restent ouverts. ARCH-01
(migration DEC-12) reste le chantier parapluie ; ARCH-03, ARCH-04 et CI-01 en
sont les morceaux non livrés.

| ID | Domaine | Problème | Preuves | Impact | Sévérité | Référence | Fix | Effort | Statut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-02 | architecture | En mode unifié, l'écran de fin n'existe pas : `Dock` remplace tout le HUD 1v1 par `BattleSpellDock`, donc ni `EndOverlay`, ni récompenses, ni level-up. Le retour existe, mais sous la forme du bouton « Clore la salle ». | `ui/App.tsx:185-189`, `ui/dockGate.ts:15-29`, `ui/components/battle/BattlePanel.tsx:126-131`, `ui/components/battle/UnifiedEndOverlay.tsx:24-29` | Une victoire d'exploration unifiée crédite sans rien montrer : le joueur ne lit ni XP, ni butin, ni montée de niveau avant de clore. | P1 | `docs/design/specs/combat-unification.md:148-160` (étape 3, livrables `EndOverlay`/`RewardsSummary`) | Porter `EndOverlay`, `RewardsSummary` et `LevelUpLine` dans `BattlePanel` (sous-étape 3b-2). | M | fixed (#174, 83c3373) — `BattleEnd` monte `UnifiedEndOverlay` dans `BattlePanel` (`BattlePanel.tsx:126-131`), qui rend `EndOverlay` avec les récompenses du store et exclut le donjon (sa notice suffit) ; la défaite affiche son propre texte. |
| ARCH-03 | architecture | `combatLoop` subsiste (étape 4 de DEC-12) et `battleBridge` duplique deux helpers de `dungeon/combatants.ts` : `copyResistances` et l'initiative (`initiativeOf` vs `initiativeFor`). | `src/engine/combatLoop/` (15 fichiers ; 29 fichiers de `src/` l'importent), `engine/battleBridge/fromExploration.ts:45-57`, `engine/dungeon/combatants.ts:49-62`, `engine/combatLoop/opening.ts:13-20` | Deux copies d'une même formule peuvent diverger silencieusement ; la suppression de l'ancien moteur reste à faire. | P2 | `docs/design/specs/combat-unification.md:169-186` (étape 4) | Basculer le défaut sur `unified`, puis supprimer `combatLoop` après parité complète et dédupliquer `copyResistances` et l'initiative. | L | ouvert |
| UI-16 | ui | Les sorts `requiresState` (Pandawa, `drunk`) sont **déclarés non gérés** au lieu d'être jouables : aucun système d'états n'existe. | `data/spells.yaml:613,626`, `engine/combatLoop/spellSupport.ts:33-35`, `ui/spellSlotState.ts:111-114` | Dette produit assumée : deux sorts restent inertes tant que SPELL-02 n'est pas livré ; l'UI l'annonce, elle ne le cache pas. | P2 | `dofus/%18%18%12/SpellDatas.as:45` | Livrer le moteur d'états avec SPELL-02, puis retirer `hasMissingState`. | S | ouvert |
| ARCH-04 | architecture | `ARCHETYPES` **duplique dans le code** les valeurs que les données portent : les distances `1`/`2`/`4` et les drapeaux `rushes`/`aggressive` sont écrits en dur, alors que `preferredDistance` est déjà une donnée par monstre. | `engine/multiCombat/ai.ts:22-28` (`ARCHETYPES`), `engine/multiCombat/ai.ts:52` (`?? DEFAULT_ENEMY_PLAN`), `data/monsters.yaml:57-58,87-88,119-120,144-145,171-172` | Si les données changent, les défauts et les drapeaux de comportement ne suivent pas ; un archétype ajouté en YAML retombe silencieusement sur le contact. | P2 | `data/monsters.yaml:119-120` (`support_healer`, `preferredDistance: 4`) | Lire comportement et distances par défaut depuis `data/` (ou un `data/archetypes.yaml` validé par Zod), le code restant simple lecteur. | S | ouvert |
| CI-01 | ci | `ui-layout` est filtré par chemins : sans fichier d'interface, le job conclut en succès **sans lancer la suite Playwright**. | `.github/workflows/ci.yml:42-62` (filtre), `.github/workflows/ci.yml:64-101` (job), `.github/workflows/ci.yml:11-30` (`quality-gate` complet) | Un changement de `data/*.yaml` — **non filtré** — ne déclenche pas `ui-layout` : une régression de mise en page causée par les données passe. | P2 | `chore(ci)` #176, `acf8a54` | Ajouter `data/*.yaml` au filtre si les données peuvent changer une mise en page ; à défaut, garder `quality-gate` complet comme filet et le documenter. | S | ouvert — risque résiduel assumé, atténué par `quality-gate`. |

> `UI-06` est déjà pris par le constat « journaux sans auto-scroll » : le constat
> `requiresState` est donc numéroté **UI-16**, sans renommer l'existant.

### Motif appris — une amélioration d'IA peut softlocker une salle

#175 a branché les blocs `ai:` (#180 corrige la régression, `a0e182a`) :
`support_healer` + `preferredDistance: 4` avec un sort de portée 1 figeait le
monstre — il reculait vers une distance inatteignable, ne pouvait rien lancer, et
rendait la main sans fin (300 actions sans victoire dans le test). Le correctif
est structurel : un pas de placement n'est retenu que s'il **atteint** la
distance préférée (`store/battleSelectors.ts:290-295`, `settleMove`), et un
monstre à distance préférée sans sort lançable avance s'il lui reste des PA
(`holdAction`, `store/battleSelectors.ts:311-315`) au lieu de perdre son tour.

**Règle de méthode** : toute PR d'IA doit prouver qu'une salle se termine. Le
filet est `tests/unit/battleRange.spec.ts` (portée réelle) et
`tests/unit/dungeonEntry.spec.ts` (catalogue de donjon jouable), doublés du
walkthrough `tests/walkthrough/gearedDungeon.spec.ts`. Depuis #178 (`30889b4`),
la donnée de la Marmite est cohérente (`fer_spell_projection_de_mazout`, portée
4-5, `cooldown: 2`, `data/spells.yaml:123-135`) et `tests/data/marmiteRange.spec.ts`
la fige : le repli de #180 reste la ceinture, la donnée est la bretelle.

### Notes de méthode et d'outillage (hors décompte)

Ces deux points ne sont **pas** des constats de jeu : ils ne comptent pas dans
les 82 et ne se corrigent pas dans ce dépôt.

- **`main` local peut dériver.** La matrice de permissions pousse certains
  agents à travailler dans l'arbre principal sur une branche de feature :
  `git rev-parse --abbrev-ref HEAD` dans `/Users/benjaminragot/la-flotte`
  renvoie `feat/render-anim-work` (c'est aussi la branche de la PR #182). État
  mesuré le 2026-11-25 à 23:40 CET :
  `git rev-list --left-right --count main...origin/main` → `0	4` (colonnes
  gauche/droite de `--left-right` ; `main` local = `0754f15`, `origin/main` =
  `218f8e3`). Aucun travail de feature ne doit partir de cet arbre : worktree
  dédié, toujours.
- **Le hook du plugin bloque `git merge-base`.** Le motif
  `/\bgit\s+(merge|rebase)\b/` (`.opencode/plugins/la-flotte-guard.ts:114`)
  matche `git merge-base main HEAD` (le `-` est une frontière de mot) et le
  refuse comme un merge manuel. C'est une **friction d'outillage**, pas un bug
  de jeu ; à traiter hors dépôt. Contournement immédiat : lire
  `git rev-list --count main..HEAD` ou `git log --oneline main..HEAD`.

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
| ARCH-01 | **deux moteurs de combat** (`combatLoop` 1v1 + `multiCombat` 1vN) | **En cours** — **DEC-12** : étapes 1 (#158), 2 (#160), 3a (#162), 3b-1 (#164) et 3b-2 (#174, écran de fin unifié) livrées. Restent l'étape **3b-3** (dock de sorts partagé donjon/exploration) et l'étape **4** (défaut `unified` puis suppression de `combatLoop`, **ARCH-03**). Tant que l'étape 4 n'est pas livrée, tout correctif de formule reste appliqué **deux fois** (voir GRID-04/05, SPELL-04). |

## Backlog

Constats **non retenus** comme issues (soit hors périmètre, soit trop diffus, soit
relevant d'une spec à écrire), un par ligne :

- Chat : canaux couleur/eau/feu absents — traité par la spec `ui-dofus-retro.md`, pas un bug isolé.
- Timeline : l'animation de l'initiative (rail) reste hors audit — `InitiativeBand` (#168) affiche l'ordre, pas le rail animé.
- Médaillon central (anneau de tour, XP circulaire) — refonte UI globale, hors audit.
- Carte du monde et coordonnées de zone — dépend de DATA-06 (sauvegarde) avant tout intérêt.
- Métiers de récolte, outils et ressources — hors périmètre du jeu actuel (décision produit).
- Conditions d'équipement (niveau, caractéristiques) — vérifiées par `equipRequirements.ts`, seuls les anneaux posent problème (ITEM-06).
- Chaîne build : chunk principal > 500 kB — avertissement Vite, pas un défaut fonctionnel.
- `data/recipes.yaml` et `src/engine/craft/` : code présent, aucune UI — fonctionnalité future, pas un écart 1.29.
- Durée de tour (timer) : absent côté client 1.29 aussi, donc non comparable.
- Invocations : aucun système d'invocation, donc « ordre des invocations » sans objet.

## Suivi des merges

État des PR qui ont clos un constat, **dans l'ordre réel de merge** (vérifié
par `git log --reverse`, pas par numéro de PR). La colonne `Constats clos`
renvoie aux `ID` du tableau principal ; `—` signale une PR documentaire ou de
préparation qui ne corrige rien.

| PR | Titre | Hash | Constats clos |
| --- | --- | --- | --- |
| #135 | `fix(combat): 🐛 retirer les combattants morts du panneau` | `1512b56` | COMBAT-04 |
| #137 | `docs(audit): 📝 inventaire des écarts Dofus 1.29` | `d40db77` | — |
| #139 | `fix(combat): 🐛 respecter l'initiative à l'ouverture du 1v1` | `fff5d3d` | COMBAT-01 |
| #140 | `fix(combat): 🐛 faire tirer l'IA à portée au lieu de coller` | `4ed327c` | COMBAT-08 |
| #138 | `fix(render): 🐛 rendre le canvas net sur écran HiDPI` | `10d516b` | RENDER-02 |
| #136 | `fix(combat): 🐛 démarrer la cadence ennemie à l'ouverture` | `8797ac5` | COMBAT-02 |
| #141 | `fix(combat): 🐛 mesurer la portée des sorts en Chebyshev` | `62ecdda` | GRID-01 |
| #142 | `fix(data): 🐛 rétablir la victoire niveau 16 (DEC-03)` | `5ae59cf` | BALANCE-01 |
| #143 | `docs(audit): 📝 statuts des correctifs mergés` | `935d111` | — |
| #144 | `fix(ui): 🐛 ne plus couper le tour quand un bouton a le focus` | `5ccacd6` | UI-03 |
| #146 | `fix(ui): 🐛 désactiver Attaquer sans PA ou en recharge` | `f62edf4` | UI-02 |
| #145 | `fix(grid): 🐛 bloquer la LoS dans les coins de murs` | `ab86aaf` | GRID-02 |
| #147 | `fix(render): 🐛 peindre la seconde face et la base des murs` | `a665ea5` | RENDER-03 |
| #149 | `fix(combat): 🐛 appliquer les résistances et le %Dégâts d'équipement` | `9c7dd8a` | ITEM-01 |
| #150 | `chore(vitest): 🔧 ignorer les worktrees imbriqués et play-report dans le scan` | `38ceb87` | — |
| #151 | `fix(render): 🐛 afficher le nom des combattants sur les jetons` | `54da359` | RENDER-06 |
| #148 | `fix(data): 🐛 passer les PV de départ 1.29 à 55` | `89d9886` | COMBAT-03 (re-cadré) |
| #152 | `fix(economy): 🐛 appliquer le facteur d'écart de niveau XP 1.29` | `b873cc2` | DATA-03 |
| #153 | `docs(audit): 📝 solder la nuit de correctifs et re-cadrer COMBAT-03` | `db9bcf6` | — |
| #154 | `feat(dev): ✨ multiplicateur ×10 XP et drop en développement` | `2d14f78` | — |
| #155 | `feat(dev): ✨ héros de test niveau 20 force 500` | `95b540a` | — |
| #157 | `fix(dungeon): 🐛 créditer XP, butin et kamas par salle` | `5ed363f` | DATA-01, COMBAT-09 |
| #156 | `fix(ui): 🐛 ne plus laisser de clic mort sur les sorts` | `655de28` | UI-01, SPELL-09 |
| #158 | `docs(combat): 📝 planifier DEC-12 et la suppression de combatLoop` | `e9cff4e` | — |
| #159 | `test(dungeon): ✅ restaurer l'invariant « le donjon coûte des PV »` | `b17886f` | — |
| #160 | `feat(combat): ✨ adaptateur exploration vers le moteur unique` | `b851826` | — |
| #161 | `chore(git): 🔧 ignorer les rapports HD et les worktrees imbriqués` | `14251c3` | — |
| #162 | `feat(combat): ✨ jouer l'exploration sur le moteur unique` | `9ce82b1` | — |
| #163 | `feat(data): 👾 initiative stockée des monstres (Piou Mazouté à 0)` | `551e8a8` | MONSTER-01 (données) |
| #165 | `feat(ui): 🎨 distinguer les classes par leurs sorts et leurs caps` | `55e783b` | UI-04 |
| #167 | `feat(combat): ✨ lire l'initiative stockée par grade` | `f0519a4` | MONSTER-01 (moteur) |
| #166 | `feat(render): 🎨 afficher le chemin et son coût PM au survol` | `0472ead` | GRID-03 (1v1) |
| #164 | `feat(combat): ✨ lancer des sorts en exploration unifiée` | `c947bc8` | — |
| #168 | `feat(ui): 🎨 afficher l'ordre d'initiative des vivants` | `061a122` | COMBAT-05 |
| #169 | `docs(audit): 📝 refléter les 14 PR livrées et rouvrir le plan par zone` | `6f6f0f0` | — |
| #171 | `fix(combat): 🐛 corriger la sémantique des coups critiques 1.29` | `0455a19` | SPELL-03 |
| #172 | `docs(design): 📝 réaligner DEC-13 et la table de parité des combats` | `8c933a5` | — |
| #173 | `fix(render): 🐛 viser le sprite du monstre avant la case` | `1de2369` | INPUT-01 (partiel) |
| #175 | `feat(combat): ✨ lire les blocs ai des monstres` | `6bd12c0` | COMBAT-07 (moteur) |
| #176 | `chore(ci): 🔧 ne lancer ui-layout que sur les changements d'interface` | `acf8a54` | — (écart CI-01) |
| #174 | `feat(combat): ✨ afficher le bilan de fin de combat unifié` | `83c3373` | ARCH-02 |
| #170 | `feat(render): 🎨 intercaler le décor et les acteurs par profondeur` | `dfd56ab` | RENDER-01 |
| #177 | `feat(economy): ✨ vendre un objet contre des kamas` | `0754f15` | DATA-02 (partiel) |
| #180 | `fix(combat): 🐛 replier l'action d'un monstre qui ne peut plus frapper` | `a0e182a` | — (régression #175 corrigée) |
| #178 | `feat(data): 👾 donner une portée réelle à la Marmite Fuyarde` | `30889b4` | COMBAT-07 (données) |
| #179 | `feat(spell): ✨ lancer des sorts de soin` | `a44a089` | SPELL-02 (soin) |
| #181 | `feat(ui): 🎨 réserver une colonne au panneau de salle` | `218f8e3` | UI-05 |

## PR ouvertes au 2026-11-25 (instantané `218f8e3`)

Elles ne comptent **pas** dans les clos : aucune n'est mergée sur `main`.

| PR | Titre | Zone | Ce qu'elle débloque |
| --- | --- | --- | --- |
| #182 | `feat(render): 🎨 animer attaque et touche en salle` | `src/renderer/**` | RENDER-05 : `lastAction` typé + animations `attack`/`hit` — **en corrections**. |
| #184 | `fix(spell): 🐛 respecter castsPerTarget` | `src/engine/combat/spellUsage.ts`, `src/store/battleSelectors.ts` | SPELL-05 : quota par cible. |

Hors PR mais en cours : la branche locale `design/sell-ui` (worktree
`docs/design/specs/.wt/sell-ui`, base `30889b4`) prépare l'**écran de vente**
(reste de DATA-02). À l'instantané, elle modifie `src/ui/components/OverlayPanels.tsx`,
`src/ui/components/inventory/BackpackList.tsx`, `inventoryTheme.ts`,
`src/ui/inventoryHudHelpers.ts` et ajoute `saleView.ts`, `useSell.ts` et
`tests/ui/sellPanel.spec.ts`. Elle réserve ces **fichiers** sans PR ouverte : à
traiter comme un verrou de fichiers, pas de dossier.

Total : sur les **77 constats initiaux**, **25 clos** (`fixed`), **4 partiels**,
**1 re-cadré** (COMBAT-03 → MONSTER-01), **47 restants** (P0 : 0, P1 : 5, P2 :
42). Les **5 écarts découverts** comptent dans le suivi : ARCH-02 est clos,
ARCH-03, ARCH-04, CI-01 et UI-16 restent ouverts. Le suivi porte donc sur
**82 constats** : **26 clos** (P0 : 2, P1 : 21, P2 : 3), **4 partiels**, **1
re-cadré**, **51 ouverts** (P0 : 0, P1 : 5, P2 : 46) — cohérent avec le chapeau
et la colonne `Statut`. La commande de vérification est dans `## Comptage`.

## Comptage

Méthode réellement exécutée après les éditions : chaque ligne de constat est
reconnue à son premier champ `| ID |` (deux majuscules, un tiret, deux chiffres),
puis classée par la colonne `Sévérité` (7ᵉ) et par le premier mot de la colonne
`Statut` (10ᵉ). Les deux sections comptées sont `## Tableau des constats` et
`## Écarts découverts en cours de route` ; les tableaux de décisions, de merges et
de PR ouvertes sont hors décompte, ainsi que `### Notes de méthode et
d'outillage`.

```sh
node -e '
const fs = require("node:fs");
const text = fs.readFileSync("AUDIT/ISSUES.md", "utf8");
const sectionOf = (name) => text.split(/^## /m).find((part) => part.startsWith(name)) ?? "";
const rowsOf = (section) => section.split("\n").filter((line) => /^\| [A-Z]{2,}-\d{2} \|/.test(line));
const tally = (rows) => {
  const out = { total: rows.length };
  for (const line of rows) {
    const sev = (line.match(/\| (P[0-2]) \|/) ?? [])[1];
    const status = (line.match(/\| (fixed|re-cadré|partiel|ouvert)(?= |\|)/) ?? [])[1];
    out[status] = (out[status] ?? 0) + 1;
    out[`${sev}/${status}`] = (out[`${sev}/${status}`] ?? 0) + 1;
  }
  return out;
};
console.log("initiaux", tally(rowsOf(sectionOf("Tableau des constats"))));
console.log("écarts", tally(rowsOf(sectionOf("Écarts découverts"))));
'
```

Attendu, parmi les clés émises : `initiaux` → `total: 77`, `fixed: 25`,
`partiel: 4`, `re-cadré: 1`, `ouvert: 47` (dont `P0/fixed: 2`, `P1/fixed: 20`,
`P1/partiel: 4`, `P1/re-cadré: 1`, `P1/ouvert: 5`, `P2/fixed: 3`,
`P2/ouvert: 42`) et `écarts` → `total: 5`, `fixed: 1`, `ouvert: 4`, soit 82
constats, **26 clos**, **4 partiels**, **51 ouverts**. La ligne `GRID-01` contient
un `|` échappé (`\|dx\|`) : la regex de statut s'ancre sur le mot exact de la
colonne, elle n'est pas décalée par l'échappement. **Quatre** lignes de constat
portent le statut `partiel` dans leur premier mot (`INPUT-01`, `DATA-02`,
`SPELL-02`, `GRID-03`).

