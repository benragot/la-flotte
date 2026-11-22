---
title: Interface Dofus 1.29 / Retro — exploration et combat
status: spec
source: dofus-129-expert (recherche web, sources citées)
tags: [ui, retrospective, fidelity]
---

**Périmètre** : rendu procédural (aucun asset Ankama), 16:9 paysage, HTML/CSS/PixiJS.

**Étiquettes de certitude** : **[D]** documenté (source citée) · **[I]** inféré · **[?]** non trouvé (proposition de design, pas une reconstitution).

## 1. Écran d'exploration — écarts constatés

| Question | Dofus 1.29 → Retro | Preuve | Notre état |
|---|---|---|---|
| Rendu des personnages | sprite iso (~1 case de large, 1,3 de haut), **ombre elliptique**, **nom au-dessus de la tête**. **Aucune barre de PV hors combat** avant 1.41 ; depuis 1.41, barre **au survol** seulement | [D] notes Retro 1.41 ; [D] captures 2005 | jeton = **disque plein** bleu/rouge, **barre de PV permanente**, **aucun nom** |
| Survol d'une case | case **surlignée** (contour, pas d'aplat) + **chemin prévisualisé** en pastilles | [?] tracé non documenté ; [D] la *zone* de portée est une option | chemin affiché ✅, contour or ✅ |
| Groupes de monstres | **un sprite** (chef de groupe) + **étoiles** = **bonus** XP/butin accumulé (pas le niveau, pas le nombre) ; nom et niveau en **infobulle** (touche `Z`) | [D] forums officiels, notes Retro | badge = **niveau total** + label ⇒ **contresens** |
| Déplacement | clic simple, pathfinding, **8 directions** (diagonales à 1 pas) ; **aucun message** « vous vous déplacez de N cases » | [D] chat Retro (aucun canal pour ça) ; [I] diagonales | `findPath` **4 directions** ⇒ chemins 30-40 % trop longs ; moteur écrit « se déplace de N case(s) » |
| Panneaux | **chat/journal en bas à gauche**, extensible, canaux colorés ; fenêtres en overlays (`Échap`) | [D] guide Retro | journal = panneau de 34 % du dock en bas ; **bandeau haut** de consigne |
| Barre d'état permanente | **il n'y en a pas** : niveau/XP dans la barre du bas, coordonnées en **bascule** (`Maj+'`) | [D] guide Retro ; absence = [I] | bandeau permanent (`EXPLORATION_BANNER`) ⇒ **anachronique** |
| Messages techniques | n'existent pas pour le joueur ; le feedback est le **déplacement** lui-même | [D] | « X se déplace de N case(s) » affiché ⇒ **invention** |

## 2. Écran de combat — écarts constatés

| Question | Dofus 1.29 → Retro | Preuve | Notre état |
|---|---|---|---|
| Grille | matérialisée au sol, **bastable** (`Maj+&`) ; cases de placement **bleues** (soi) / **rouges** (adverses) | [D] | aucun overlay de grille |
| **Zone PM du joueur** | **pas d'aplat permanent** : repère = **chemin au survol** ; la zone pleine est une **option** (2.x) | [D] devblog portée = option ; [?] comportement exact Retro | **aplat permanent** dès `player_turn` ⇒ **premier suspect** |
| **Zone PM des ennemis** | **jamais affichée en 1.29** par aucun client | [I] (aucune source) | **nous l'affichons sur demande du joueur** (écart assumé : info que le joueur ne peut pas deviner autrement) — règle **R8** |
| Portée des sorts | sort sélectionné ⇒ **contour** de portée ; **aperçu de la zone d'effet au survol** de la case cible | [D] notion de portée affichée ; [?] forme 1.29 | `castCells` en **aplat permanent**, **aucun aperçu de zone** |
| Ordre des combattants | **frise de portraits en bas** (pas une colonne) | [D] captures 2005 | `Timeline` **verticale en haut à droite** ⇒ non-1.29 |
| Compteurs PA/PM/PV | (a) barre du bas : PA/PM + fin de tour ; (b) **panneau d'infos au survol en bas à droite** : nom, niv., PV, **résistances** | [D] guide combat + notes | `Vitals` en dock ✅ ; **pas de panneau au survol** ; barres de PV permanentes ⇒ non-1.29 |
| Barre de sorts | cases 1–9 (sorts **et** objets), coût PA **dans l'infobulle** | [D] guide Retro | grille 2×6 avec coût PA écrit ✅ |
| Journal de combat | **c'est le chat**, canal **vert**, lignes **colorées par élément** | [D] forums | panneau dédié, teinté par **locuteur**, pas par élément |
| Fin de tour | **bouton** + **`Ctrl+Fin`** | [D] guide Retro | bouton ✅ |
| Mort | combattant **retiré du terrain** (portrait grisé) ; énergie, fantôme, statue de phénix ; **écran de fin sobre** | [D] | `EndOverlay` + `RewardsSummary` ✅ |

## 3. Couleurs et codes visuels

### 3.1 Éléments (convention des pictogrammes de sorts **[D]**)
Feu = **rouge** · Air = **vert** · Eau = **bleu** · Terre = **brun** · Neutre = **[?]**

| Élément | Hex proposé | Usage |
|---|---|---|
| Feu | `#D2452F` | liseré de zone, ligne de dégâts, pastille |
| Eau | `#2F7FD2` | idem |
| Air | `#3FAE6A` | idem |
| Terre | `#A9722B` | idem |
| Neutre | `#E8DCC8` | idem (le jaune `#E2C044` est réservé aux **étoiles**) |
| Soin | `#6AD06A` | chiffres de soin |
| Échec critique | `#8C8C8C` | ligne dédiée |

> Le **brun Terre** et le **vert Air** sont proches en deutéranopie : **doubler la couleur d'un glyphe** (losange/cercle/croix) dans le chat et sur les pastilles.

### 3.2 États d'interface

| Élément | Couleur | Forme |
|---|---|---|
| Case survolée | `#F2D64B` | **contour** 1,5 px, **aucun aplat** |
| Chemin prévisualisé | `#F0B429` α 0.32 | **pastille ronde** 3 px, sans contour |
| Cible valide | `#F2D64B` | contour + chevron |
| Cible invalide | `#B83B3B` α 0.85 | contour + **croix** |
| Zone d'effet | couleur élément α **0.22** + liseré α 0.60 | aplat autorisé (aperçu) |
| Zone PM (si activée) | `#3FAE6A` α **0.18**, contour α 0.35 | aplat **très** discret |
| Cerclage des combattants | **bleu `#3F7FD6`** alliés / **rouge `#D64545`** ennemis **[D]** | **anneau** au sol, 2 px, sous les pieds |
| Combattant actif | `#F2D64B` | anneau **double** + portrait agrandi |
| Mort / fantôme | `#6B6B6B` | sprite gris α 0.5, portrait barré |
| Étoiles de groupe | `#E2C044` | étoile dessinée 9 px, arc au-dessus du sprite |

## 4. Ce qui **n'existe pas** en 1.29 (anti-anachronisme)

| Élément moderne tentant | Réalité |
|---|---|
| Barres de vie flottantes permanentes | **non** ; barre au survol depuis 1.41 seulement |
| Mini-map en haut à droite | absente en 1.29 (ajout Retro récent, médaillon) |
| Infobulles riches au survol des sorts | postérieur |
| Timeline verticale latérale avec avatars | la frise est **horizontale, en bas** |
| Bandeau permanent mode/niveau/zone | aucun |
| Bandeau de consigne (« Clique un monstre ») | n'existe pas |
| Surbrillance permanente de la zone de déplacement | c'est une **option**, pas le défaut |
| Curseur contextuel / réticule animé | le survol suffit |
| Dégâts flottants colorés au-dessus des têtes | **non documenté** ; le coloré est dans le **chat** |
| Combo/cooldown circulaire sur les sorts | non |
| Notifications toast | non (tout passe par le canal vert) |
| Écran de résultat plein écran avec note | récapitulatif **sobre** |

## 5. Géométrie et unités (implémentable)

Unités relatives à la tuile iso `TILE_W × TILE_H` (`gridProjection.ts`).

**Toutes les valeurs ci-dessous sont [I]** : propositions calibrées sur les captures 2005, aucune n'est documentée par Ankama. Seule exception, une constante qui **existe déjà** dans le code : `HP_BAR_WIDTH` vaut **`0.5`** dans `src/renderer/tokens.ts:17` et passe à **`0.55`** (§6 et TC4c en dépendent).

| Constante | Valeur |
|---|---|
| Ombre au sol [I] | ellipse `0.80 × 0.30` tuile, α 0.25, `#101820` |
| Sprite acteur [I] | hauteur `2.0 × TILE_H`, ancre = centre bas du losange |
| Nom au-dessus [I] | 11 px, `#E8DCC8`, α 0.9, à `-2.2 × TILE_H` |
| Anneau d'équipe [I] | ellipse `0.92 × 0.46` tuile, 2 px, sous le sprite |
| Étoiles de groupe [I] | rayon 4,5 px, écart 11 px, arc −30°→+30° |
| Barre de PV de survol [I] | largeur `0.55 × TILE_W` (`HP_BAR_WIDTH` : **0.5 → 0.55**), hauteur 4 px, à `-2.6 × TILE_H` |
| Case survolée [I] | contour 1,5 px |
| Pastille de chemin [I] | cercle r 3 px, α 0.32 |
| Frise de portraits [I] | 44 × 44 px, écart 6 px, **bas-gauche à droite du chat** ; actif 52 × 52 + cadre or 2 px |
| Chat [I] | largeur `min(34vw, 520px)`, hauteur `32vh`, **bas-gauche**, marge 8 px |
| Barre d'interface basse [I] | hauteur 44 px, pleine largeur, `#2B241D`, filet `#8C6D46` 2 px |
| Panneau d'infos survol [I] | 220 px, **bas-droite**, marge 12 px |

### 5.1 Pile du bas de l'écran — offsets et z-order [I]

Sans ces offsets, chat / frise / barre basse se recouvrent à coup sûr.

| Couche | Offset | z |
|---|---|---|
| Barre d'interface basse | `bottom: 0`, `left: 0`, hauteur 44 px, pleine largeur | **20** |
| Chat fermé | `bottom: 52px` (44 + marge 8), `left: 8px`, `width: min(34vw, 520px)`, hauteur `32vh` | **10** |
| Chat ouvert | idem, hauteur `hauteurChatOuvert` (§6, 50 % du viewport) | **12** (au-dessus de la frise) |
| Frise de portraits | `bottom: 52px`, `left: calc(8px + chatWidth + 8px)`, hauteur 52 px ; **jamais sous** le chat ouvert, elle se décale à sa droite | **10** |
| Panneau d'infos survol | `bottom: 52px`, `right: 12px`, largeur 220 px | **15** |
| Overlays (`Échap`) | plein cadre | **30** |

Ordre de grandeur : `44 + 52 + 8 = 104 px` réservés en bas ; toute la scène iso est translatée d'autant vers le haut.

## 6. Règles d'état — le cœur du sujet

```
R1. moveZoneVisible  = (phase === "player_turn") AND (hoveredCell === playerPos OR modifierHeld)
R2. castZoneVisible  = (selectedSpellId !== null)            → contour seul, α 0.18
R3. aoePreview       = (selectedSpellId !== null) AND hoveredCell !== null
R4. fieldHpBar       = (hoveredCell === tokenPos)            → une seule barre à l'écran
R5. hoverOutline     = (hoveredCell !== null)                → une seule case cerclée
R6. pathPreview      = exploration ET hoveredCell !== null ET chemin existe
R7. logTint(line)    = élément de la ligne, sinon locuteur
R8. enemyPmZoneVisible = (hoveredCell === enemyTokenPos)     → écart assumé vs 1.29 (§2)
```

**Formules** (`Math.floor` partout) :
```
largeurBarrePv  = floor(HP_BAR_WIDTH * hp / maxHp)     // maxHp <= 0 ⇒ 0
etoilesAffichees = min(10, max(0, bonusStars))
hauteurChatOuvert = floor(viewportHeight * 0.50)
```

**Style de case** (ordre strict, remplace `resolveTileStyle`) :
```
contour = survol ? OR : (cible valide ? OR : (cible invalide ? ROUGE : null))
aplat   = (aperçu de zone) ? couleurÉlément α .22
        : (portée de sort) ? couleurÉlément α .18
        : (zone PM visible) ? VERT α .18
        : couleur de base α 1
```

## 7. Interactions

| Geste | Exploration | Combat |
|---|---|---|
| Survol case | contour + chemin | contour + aperçu de zone si sort sélectionné |
| Survol personnage allié | nom, **rien d'autre** | **zone PM du héros (R1)** + panneau d'infos bas-droite |
| Survol personnage ennemi | nom, **rien d'autre** | **zone PM de l'ennemi (R8)** + panneau d'infos bas-droite |
| **`Maj` maintenu** | — | affiche la zone PM du héros **en permanence** (branche `modifierHeld` de **R1**) |
| Clic case libre | marche (chemin auto) | déplacement si PM suffisants |
| Clic case hors portée | marche | **rien** (aucun message) |
| Clic ennemi | **engage le combat** | sélectionne la cible |
| `1`–`9` | — | sélectionne le sort |
| `Ctrl+Fin` | — | passer le tour |
| `Z` (maintenu) | infobulles de tous les groupes | — |
| `G` | affiche/cache la grille | idem |
| `Échap` | ferme le panneau ouvert | idem |

## 8. Ce qu'on supprime (dette explicite)

1. `drawHpBars` sur **tous** les jetons → uniquement le jeton survolé.
2. `moveCells()` permanent → **R1** (héros) et **R8** (ennemis), au survol seulement.
3. `castCells` en aplat permanent → contour α 0.18 + aperçu de zone.
4. `EXPLORATION_BANNER` → **réduit au minimum** (demande joueur : overlay haut-gauche ; Dofus n'en a aucun).
5. Badge `totalLevel` sur les groupes → **étoiles** + infobulle.
6. Jeton **disque plein** → **anneau d'équipe + sprite + ombre**.
7. Ligne de log « se déplace de N case(s) » → retirée de l'UI joueur (conservée dans le log moteur).

## 9. Cas de tests chiffrés

### TC1 — style de case survolée
```
{ cell: ".", isMoveCell: false, isCastCell: false, isHovered: true }
→ { fill: 0x4A5C41, alpha: 1, stroke: 0xF2D64B, strokeAlpha: 1 }
{ ..., isHovered: false } → { stroke: null, strokeAlpha: 0 }
```

### TC2 — visibilité de la zone PM (`moveZoneVisible`)
```
grille 5×5 ouverte, joueur (2,2), adversaire (4,4), phase "player_turn"
a : PM 1, hovered (2,2) → 8 cases (8 directions)
b : PM 0, hovered (2,2) → 0 case
c : PM 3, hovered (0,0) → 0 case
d : PM 3, hovered null  → 0 case
```

### TC3 — coût d'un chemin diagonal (**le bug actuel**)
```
grille 3×3 ouverte, from (0,0), to (2,2), maxPm 2
attendu : cost === 2      // diagonale = 1 pas
interdit : cost === 4     // 4 directions = bug actuel
et      : path.length === 3
```

### TC4 — barre de PV de survol
```
tc4a : drawFieldHpBar({ hovered: true,  kind: "enemy" }) → true
tc4b : drawFieldHpBar({ hovered: false, kind: "enemy" }) → false
tc4c : hpBarWidth({ hp: 12, maxHp: 50 }) avec TILE_W 64
       → floor(35.2 * 0.24) = floor(8.448) = 8
tc4d : hpBarWidth({ hp: 0, maxHp: 0 }) → 0
```

### TC5 — teinte d'une ligne de journal
```
tc5a : "… 34 dégâts Feu."   → "#D2452F"
tc5b : "… 12 dégâts Terre." → "#A9722B"
tc5c : "Vous récupérez 20 PV." → "#6AD06A"
tc5d : "Échec critique."     → "#8C8C8C"
tc5e : "C'est au tour de…"   → "#E8DCC8"
```

## 10. À copier / à ne pas copier

### À copier
| Élément | Raison (5 mots) |
|---|---|
| Anneau d'équipe bleu/rouge au sol | identification instantanée, zéro ambiguïté |
| Chemin en pastilles au survol | on voit le trajet, pas une nappe |
| Zone PM au survol de soi — **écart assumé** | option 2.x adoptée : lisibilité |
| Frise de portraits en bas | ordre de jeu lisible |
| Panneau d'infos bas-droite | résistances avant de frapper |
| Chat unique en bas à gauche | un seul flux, canaux filtrés |
| Étoiles de bonus sur les groupes | récompense visible, pas un niveau |
| Barre de PV au survol seulement | le terrain reste lisible |
| `Ctrl+Fin` pour finir le tour | geste expert mémorisé |
| Fin de combat sobre | récompense, pas fanfare |

### À ne pas copier
| Élément | Pourquoi |
|---|---|
| Zone de déplacement **permanente** | option 2.x/3.x, illisible sur nos sols |
| Interface plein écran 1.38+ | ergonomie 2023, nos panneaux sont modulaires |
| Mini-carte | hors périmètre, bruit sur 16:9 |
| Coordonnées permanentes | gadget de bascule |
| Infobulles riches sur chaque sort | surcharge visuelle |
| Dégâts flottants colorés | non documenté en 1.29 |
| Sprites Ankama | interdit contractuel |
| Chat extensible à 50 % | gadget 2005, coûteux en 16:9 |
| Bandeau d'accueil plein écran | anachronique |

## 11. Non trouvé / à vérifier en jeu (ne pas inventer)

1. **Zone PM en Retro aujourd'hui** : aucun texte ; les traces écrites parlent d'une **option** 2.x/3.x.
2. **Tracé du chemin au survol en 1.29** : pas de description écrite.
3. **Couleur exacte** d'une cible valide/invalide en 1.29.
4. **Nombres de dégâts flottants** : existence non établie.
5. **Formulation exacte** des lignes du canal vert 1.29.
6. **Emplacement de la barre d'XP** en 1.29.
7. **Périodicité des étoiles** : sources contradictoires (24 h vs 2 h) ; plafond **10** consensuel.
8. **Position de la frise en Retro 1.38+** : la 1.38 a réorganisé l'interface (« deux panneaux ») ; « en bas » vient de captures 2005.

**Sources** : `dofusretro.jeuxonline.info/article/14761`, `/14763`, `/14788` · `dofus-reborn.fr/versions.html?vue=fresque` · `dofus-retro.com` notes 1.38 / 1.41 / 1.42 · `xixou.io/changelog` (miroir 1.47.x) · forums officiels dofus.com (étoiles, pictogrammes de sorts, dégâts colorés) · devblog Dofus (affichage de la portée) · `teckium.fr/en/maps`.

## 12. Limites connues du rendu iso

Ces deux limites sont des **choix assumés, mesurés, pas des oublis** : pas des
régressions en attente de correction, mais les conséquences géométriques et
techniques du rendu retenu. Elles sont écrites ici parce qu'elles ne vivaient
que dans la revue de la PR #68, où elles auraient été perdues.

### 12.1 Flou des sprites au-delà de ×1

La scène est mise à l'échelle « cover » pour remplir l'arène (PR #68,
`arenaScale` = `min(coverScale, cornerSafeScale)` dans
`src/renderer/gridProjection.ts`). Les **tuiles sont vectorielles**
(`Graphics.poly`, `src/renderer/tilePaint.ts:17`) et restent nettes à tout
facteur ; les **sprites de personnages et monstres sont des SVG rastérisés en
64 px** (`SPRITE_FRAME_SIZE = 64`, `src/renderer/sprites/frameMath.ts:8`) puis
agrandis par `EntitySprite.update` (PR #68 : `node.scale` suit l'échelle du
décor), donc **adoucis** au-delà de ×1. Facteurs observés : **×1,33** (1024×480),
**×1,45** (1024×570), **×2,19** (1664×840).

Piste : feuilles de sprites en **2×** (ou `resolution` Pixi) et texture
`nearest` pour rester pixel-art. Chantier `data/**` + générateur.

### 12.2 Les coins de l'écran restent vides — c'est géométrique

Une carte iso est un **losange**. Un losange n'occupe que **la moitié de sa boîte englobante** (aire `2ab` contre `4ab` pour le rectangle `2a × 2b`) : ses quatre pointes laissent donc les coins du rectangle dehors. Si le losange avait
le rapport d'aspect du viewport (`a = cW/2`, `b = cH/2`), le coin `(W/2, H/2)`
donnerait `1/c + 1/c = 2/c ≤ 1`, soit **`c ≥ 2`** : il faut au moins doubler
l'échelle pour atteindre les quatre coins.

Notre losange, lui, a un rapport **fixé à 2:1** par `TILE_W/TILE_H`
(`src/renderer/gridProjection.ts:4-6`) : il n'a jamais celui du viewport. Pour
un 4:3 (1,33), contenir les quatre coins avec un losange 2:1 exige
`a ≥ W/2 + H`, soit **≈ ×2,5** l'échelle d'inscription (×3 pour un carré,
×2,125 en 16:9) — et à ce zoom la carte déborde largement de l'écran.

D'où le choix de `arenaScale` (`src/renderer/gridProjection.ts:155`), plafonné
par `cornerSafeScale` : le losange est **inscrit**, le centre de **chaque** case
reste dans l'arène (donc toute case est cliquable, coins compris) et la carte
sature la dimension contraignante. Les quatre coins du viewport restent hors du
losange **par construction** : couvrir et « ne perdre aucune case » sont deux
critères incompatibles, et c'est le second qui a été retenu.

**Ce n'est pas un défaut** : c'est la raison pour laquelle Dofus dessine un
**fond sombre** derrière la carte. Piste : un fond d'arène, pas des cases
factices — des cases factices seraient cliquables et casseraient le pathfinding.
