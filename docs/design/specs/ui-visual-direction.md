---
title: Direction visuelle du HUD — direction retenue
status: decided
decided: 2026-11-22
variant: A — Pont de navire
source: ui-designer (proposition du coder, arbitrée par le propriétaire)
extends: docs/design/specs/ui-dofus-retro.md (§3 palette, §4 anti-anachronisme, §5 géométrie)
tags: [ui, design, palette, contraste, tailwind]
---

**Périmètre : le HUD HTML.** Tout ce document décrit les surfaces DOM de
`src/ui/` — panneaux, dock, bandeau, cartes, boutons, barres, overlays. Le
**rendu canvas (`src/renderer/**`, PixiJS) n'est pas couvert** : décor, sprites,
grille, anneaux au sol et traits de sort restent régis par
`ui-dofus-retro.md` §3 et §5. Aucun chiffre de ce document ne s'applique à un
pixel dessiné par PixiJS.

**Statut.** La **variante de carte** est tranchée (§3) ; le reste est une
direction à raffiner : `ui-designer` reprend ce document pour les détails et
signale ce qu'il corrige. Ce qui est **mesuré** (contrastes, hex existants dans
le code) ne se négocie pas ; ce qui est **choisi** (rayons, empilement
typographique) se discute encore.

**Aucune capture dans ce document.** Aucun navigateur n'a été lancé : les
chiffres sont des calculs WCAG, pas des observations d'écran. Le protocole de
vérification visuelle est au §8.

---

## 1. Palette

### 1.1 Règle d'or : la palette documentée ne bouge pas

`ui-dofus-retro.md` §3 fixe **déjà** ces couleurs, sourcées. Elles sont
**gardées telles quelles**, aucune n'est réinventée ici. La colonne « où »
montre où le code les écrit aujourd'hui : la refonte **ne change pas ces hex**.

| Rôle | Hex | Où c'est déjà écrit |
|---|---|---|
| Feu | `#D2452F` | `ui-dofus-retro.md` §3.1 |
| Eau | `#2F7FD2` | idem |
| Air | `#3FAE6A` | idem |
| Terre | `#A9722B` | idem |
| Neutre | `#E8DCC8` | idem + `HUD_COLORS.text` |
| Soin | `#6AD06A` | idem |
| Échec critique | `#8C8C8C` | idem |
| Case survolée | `#F2D64B` | idem §3.2 |
| Chemin prévisualisé | `#F0B429` | idem §3.2 |
| Cible invalide | `#B83B3B` | idem §3.2 + `HUD_COLORS.hpRed` |
| Cerclage allié | `#3F7FD6` | idem §3.2 |
| Cerclage ennemi | `#D64545` | idem §3.2 |
| Étoiles de groupe | `#E2C044` | idem §3.2 |
| Pierre / ardoise | `#2B241D` | `HUD_COLORS.stone`, §5 « barre basse » |
| Parchemin foncé | `#3D342A` | `HUD_COLORS.parchment` |
| Cuivre | `#8C6D46` | `HUD_COLORS.copper`, §5 « filet » |
| Or | `#D4A537` | `HUD_COLORS.gold` |
| PV | `#B83B3B` | `HUD_COLORS.hpRed` |
| PA | `#3B6FB8` | `HUD_COLORS.apBlue` |
| PM | `#4A8C4A` | `HUD_COLORS.mpGreen` |

**Ce que j'ajoute, et pourquoi.** (a) une **échelle de surfaces** (il n'y en a
que deux, `#2B241D` et `#3D342A`, d'où les deux littéraux Tailwind qui restent
dans le code : `bg-slate-950` sur les coques de `App.tsx:16,19` et
`text-slate-400` dans `DropList.tsx:2`) ; (b) des **lignes** intermédiaires ;
(c) une échelle de **textes** ; (d) des **encres d'éléments** — parce que les
couleurs ci-dessus, utilisées comme **texte**, échouent le 4,5:1 (§1.6). Les
unes et les autres sont des **variantes calculées**, pas de nouvelles teintes :
la teinte y est **ramenée vers le Neutre `#E8DCC8`** (mélange sRGB à 45 %), ce
qui la désature et la réchauffe — Feu `#D2452F` devient `#DC8974`, un rouge
terreux, pas un rouge « plus lumineux ».

### 1.2 Surfaces (échelle de 5)

| Token | Hex | Usage | Statut |
|---|---|---|---|
| `surface-0` | `#14100D` | fond de page, derrière le canvas, sous les overlays | ajouté (remplace `#0f172a` / `slate-950`) |
| `surface-1` | `#2B241D` | dock, bandeau, barre basse, colonne journal | existant |
| `surface-2` | `#3D342A` | corps de panneau | existant |
| `surface-3` | `#4A4034` | élément **posé** sur un panneau : case de sort survolée, ligne sélectionnée, ligne de journal alternée | ajouté |
| `surface-inset` | `#1A1512` | **creux** : piste de barre, champ de saisie, emplacement vide | ajouté |

L'ordre est strict : `0 < 1 < 2 < 3`. Un panneau (`surface-2`) ne se pose
**que** sur `surface-1` ou `surface-0` ; un creux (`surface-inset`) ne se pose
**que** dans `surface-2` ou `surface-1`. Aucune autre combinaison.

### 1.3 Lignes et séparateurs

| Token | Hex | Usage | Ratio mesuré |
|---|---|---|---|
| `line` | `#8C6D46` | bordure 2 px **sur `surface-1` ou plus sombre** | 3.20:1 sur `surface-1` |
| `line-strong` | `#967A57` | bordure 2 px **sur `surface-2`** (`line` y tombe à 2.55:1) | 3.03:1 sur `surface-2` |
| `line-soft` | `#655036` | filet 1 px décoratif (séparateur de lignes) — équivalent composité de `#8C6D46` à 60 % sur `surface-1` | 2.01:1 (décoratif, exempté) |
| `line-gold` | `#D4A537` | liseré 2 px d'en-tête, anneau de combattant actif | 5.36:1 sur `surface-2` |

Un séparateur décoratif (`line-soft`) n'est pas une frontière de composant : il
n'a pas à atteindre 3:1. Une **bordure de panneau ou de bouton** en a
l'obligation (WCAG 1.4.11) — c'est pourquoi `line-strong` existe.

### 1.4 Textes

| Token | Hex | Usage |
|---|---|---|
| `ink-1` | `#E8DCC8` | texte principal (= `HUD_COLORS.text`, inchangé) |
| `ink-2` | `#CFC3AE` | texte secondaire, valeurs chiffrées courantes |
| `ink-3` | `#B09A7F` | texte tertiaire : numéros de raccourci, unités, versions |
| `ink-danger` | `#D68F87` | PV chiffrés, lignes de journal « ennemi » |

`ink-3` est le plancher : **aucun texte en dessous de `#B09A7F`**, sauf l'état
désactivé (§2.2), qui est exempté par WCAG.

### 1.5 Encres d'éléments — la règle, puis les exceptions

Une couleur d'élément (`#D2452F`, `#A9722B`…) est une couleur de **trait, de
remplissage de case ou de pastille** : sur le sol sombre du canvas elle passe,
en texte sur un panneau elle ne passe pas. Règle unique et reproductible :

> **encre = couleur d'élément mélangée à 45 % de `#E8DCC8`** (le Neutre, déjà
> dans la palette), canal par canal, en sRGB.

| Élément | Remplissage (inchangé) | Encre calculée | Ratio sur `surface-2` |
|---|---|---|---|
| Feu | `#D2452F` | `#DC8974` | 4.57:1 |
| Eau | `#2F7FD2` | `#82A9CE` | 4.94:1 |
| Air | `#3FAE6A` | `#8BC394` | 6.00:1 |
| Terre | `#A9722B` | `#C5A272` | 5.10:1 |
| Soin | `#6AD06A` | `#A3D594` | 7.26:1 |
| Échec | `#8C8C8C` | `#B5B0A7` | 5.65:1 |
| Allié | `#3F7FD6` | `#8BA9D0` | 5.04:1 |
| Ennemi | `#D64545` | `#DE8980` | 4.64:1 |
| Or | `#D4A537` | `#DDBE78` | 6.80:1 |

**Une seule exception, mesurée** (je reviens à la règle partout ailleurs) :

- **Cible invalide / PV** `#B83B3B` → encre `#D68F87`. À 45 %, `#CE837A` ne
  donne que **4.15:1** : la règle, appliquée telle quelle, **échoue ici**. On
  prend donc l'encre voisine qui passe (4.72:1) et on l'appelle `ink-danger`,
  parce que ce rouge sert aussi au texte des PV et des lignes « ennemi ».

**PA et PM suivent la règle, sans exception** : `#3B6FB8` → `#89A0BF`
(**4.55:1**) et `#4A8C4A` → `#91B083` (**5.07:1**). J'avais d'abord retenu
`#7EA0D0` / `#79AA79`, qui sont des mélanges au **blanc** et non au Neutre :
c'était une incohérence de méthode, pas une nécessité de contraste — la règle
suffit pour ces deux-là. Une règle, une exception ; l'exception est chiffrée
au-dessus.

### 1.6 Ratios mesurés — paires texte/fond

Tous calculés par la formule WCAG de luminance relative, pas à l'œil.
Seuil texte = **4,5:1**, seuil bordure/composant = **3:1**.

| Paire | Ratio | Verdict |
|---|---|---|
| `ink-1` `#E8DCC8` sur `surface-2` | 9.00:1 | ✅ |
| `ink-1` `#E8DCC8` sur `surface-1` | 11.29:1 | ✅ |
| `ink-1` `#E8DCC8` sur `surface-0` | 13.97:1 | ✅ |
| `ink-2` `#CFC3AE` sur `surface-2` | 7.01:1 | ✅ |
| `ink-3` `#B09A7F` sur `surface-2` | 4.51:1 | ✅ |
| `ink-3` `#B09A7F` sur `surface-1` | 5.66:1 | ✅ |
| `ink-danger` `#D68F87` sur `surface-2` | 4.72:1 | ✅ |
| `ink-danger` `#D68F87` sur `surface-1` | 5.93:1 | ✅ |
| `line-gold` `#D4A537` sur `surface-2` | 5.36:1 | ✅ |
| `ink-3` `#B09A7F` sur `surface-3` `#4A4034` | 3.75:1 | ❌ **interdit** : `ink-3` ne va jamais sur `surface-3` |
| `#2B241D` sur bouton or `#D4A537` | 6.73:1 | ✅ état normal |
| `#2B241D` sur bouton or survolé `#E8DCC8` | 11.29:1 | ✅ état survol |
| `#2B241D` sur bouton or actif `#C79A2F` | 5.89:1 | ✅ état actif |
| `#8A7E6E` désactivé sur `#3D342A` | 3.07:1 | exempté (désactivé), **jamais** appliqué à du texte actif |
| `#E8DCC8` sur bouton danger `#9C2F2F` | 5.42:1 | ✅ état normal |
| `#E8DCC8` sur bouton danger survolé `#8F2B2B` | 6.08:1 | ✅ état survol |
| `#8C6D46` (line) sur `surface-1` | 3.20:1 | ✅ bordure |
| `#967A57` (line-strong) sur `surface-2` | 3.03:1 | ✅ bordure |
| `#8C6D46` (line) sur `surface-2` | 2.55:1 | ❌ **interdit** : utiliser `line-strong` |
| PV remplissage `#B83B3B` sur piste `#1A1512` | 3.21:1 | ✅ composant |
| PV en texte `#B83B3B` sur `surface-2` | 2.16:1 | ❌ **interdit** : utiliser `#D68F87` |
| PA en texte `#3B6FB8` sur `surface-2` | 2.41:1 | ❌ **interdit** : utiliser l'encre `#89A0BF` |
| PM en texte `#4A8C4A` sur `surface-2` | 2.98:1 | ❌ **interdit** : utiliser l'encre `#91B083` |
| Encre PA `#89A0BF` sur `surface-2` | 4.55:1 | ✅ règle des 45 % appliquée |
| Encre PM `#91B083` sur `surface-2` | 5.07:1 | ✅ règle des 45 % appliquée |
| `#F2D64B` (anneau de focus) sur `surface-1` | 10.56:1 | ✅ |
| Variante A — `#F0E3C8` sur bois `#4A3728` | 8.85:1 | ✅ |
| Variante B — `#E4E8EA` sur pierre `#3B3F44` | 8.60:1 | ✅ |
| Variante C — `#3A2E1E` sur parchemin `#E3D3AE` | 8.93:1 | ✅ |
| Variante C — carte `#E3D3AE` sur `surface-1` | 10.34:1 | ✅ la carte se détache du dock |
| Variante A — filet `#8A6A45` sur `surface-1` | 3.08:1 | ✅ bordure |
| Variante B — filet `#6E7681` sur `surface-1` | 3.33:1 | ✅ bordure |
| Variante C — filet `#B08D5E` sur `surface-1` | 4.97:1 | ✅ bordure |

### 1.7 Traduction Tailwind v4 (`@theme`) — PR future

Ces tokens s'écrivent dans `src/styles.css` avec `@theme`, ce qui produit les
utilitaires (`bg-surface-1`, `text-ink-1`, `border-line`…). **Cette PR ne touche
pas `src/`** : le bloc est donné pour que la PR suivante le colle tel quel.

```css
@theme {
  --color-surface-0: #14100D;
  --color-surface-1: #2B241D;
  --color-surface-2: #3D342A;
  --color-surface-3: #4A4034;
  --color-surface-inset: #1A1512;

  --color-line: #8C6D46;
  --color-line-strong: #967A57;
  --color-line-soft: #655036;
  --color-line-gold: #D4A537;

  --color-ink-1: #E8DCC8;
  --color-ink-2: #CFC3AE;
  --color-ink-3: #B09A7F;
  --color-ink-danger: #D68F87;

  --color-el-feu: #D2452F;    --color-el-feu-ink: #DC8974;
  --color-el-eau: #2F7FD2;    --color-el-eau-ink: #82A9CE;
  --color-el-air: #3FAE6A;    --color-el-air-ink: #8BC394;
  --color-el-terre: #A9722B;  --color-el-terre-ink: #C5A272;
  --color-el-soin: #6AD06A;   --color-el-soin-ink: #A3D594;
  --color-el-echec: #8C8C8C;  --color-el-echec-ink: #B5B0A7;
  --color-el-allie: #3F7FD6;  --color-el-allie-ink: #8BA9D0;
  --color-el-ennemi: #D64545; --color-el-ennemi-ink: #DE8980;

  --color-hp: #B83B3B;
  --color-ap: #3B6FB8;
  --color-mp: #4A8C4A;
  --color-ink-ap: #89A0BF;
  --color-ink-mp: #91B083;

  /* Les tokens de matière du §1.8 (edge-high, wood-face, stone-line…) se
     déclarent dans ce même bloc, avec les mêmes noms. */
}
```

`HUD_COLORS` (`src/ui/hudHelpers.ts`) garde **ses clés actuelles** (`stone`,
`copper`, `parchment`, `text`, `hpRed`, `apBlue`, `mpGreen`, `gold`) et reçoit
les nouvelles **en plus** : changer une clé existante casserait les imports.

### 1.8 Tokens de matière — la liste est close

Le §2 et le §3 ont besoin de plus que des surfaces : des arêtes de relief, des
faces de bouton, des liserés internes, des faces de variante. **Ils sont
déclarés ici**, dans le §1, et **nulle part ailleurs** : c'est ce qui rend
l'interdit I9 (« aucun hex hors du §1 ») **satisfiable par ce document
lui-même** — un agent qui applique le §6 n'écrit aucun hex qui ne soit pas dans
ce tableau.

| Famille | Token | Hex | Rôle |
|---|---|---|---|
| relief | `edge-high` | `#6B5C49` | arête haute du panneau (`inset 0 1px 0`) |
| relief | `edge-low` | `#2E2720` | arête basse du panneau (`inset 0 -2px 0`) |
| relief | `inner-line` | `#4F4437` | filet interne du panneau (`inset 0 0 0 1px`) |
| creux | `line-field` | `#57452F` | bordure 1 px d'un creux, piste de barre |
| creux | `field-inset` | `#0A0806` | ombre interne d'un creux (`inset 0 1px 0`) |
| bouton | `btn-face-active` | `#C79A2F` | fond de l'état actif |
| bouton | `btn-top-normal` | `#F4E9D4` | arête haute, état normal |
| bouton | `btn-bottom-normal` | `#A87C22` | arête basse, état normal |
| bouton | `btn-top-hover` | `#FFF7E7` | arête haute, état survol |
| bouton | `btn-bottom-hover` | `#B9A98F` | arête basse, état survol |
| bouton | `btn-inset-active` | `#7A5A14` | ombre interne, état actif |
| bouton | `btn-disabled-ink` | `#8A7E6E` | texte de l'état désactivé |
| danger | `danger-face` | `#9C2F2F` | fond du bouton danger |
| danger | `danger-face-hover` | `#8F2B2B` | fond du bouton danger, survol |
| danger | `danger-inset` | `#4A1010` | ombre interne, danger actif |
| barre | `bar-hp-high` | `#D64545` | arête haute du remplissage PV (= cerclage ennemi) |
| barre | `bar-ap-high` | `#5A8ACF` | arête haute du remplissage PA |
| barre | `bar-mp-high` | `#67A867` | arête haute du remplissage PM |
| encre | `ink-ap` | `#89A0BF` | chiffres PA (règle §1.5) |
| encre | `ink-mp` | `#91B083` | chiffres PM (règle §1.5) |
| sort | `slot-disabled-face` | `#332C24` | fond d'une case de sort désactivée |
| variante A | `wood-face` | `#4A3728` | bois de la carte |
| variante A | `wood-joint` | `#33261B` | joint de planche |
| variante A | `wood-line` | `#8A6A45` | bordure de carte |
| variante A | `wood-high` | `#6B5138` | arête haute |
| variante A | `wood-low` | `#2E2118` | arête basse |
| variante A | `wood-ink` | `#F0E3C8` | texte (8.85:1) |
| variante B | `stone-face` | `#3B3F44` | pierre de la carte |
| variante B | `stone-joint` | `#2A2D31` | joint de pierre |
| variante B | `stone-line` | `#6E7681` | bordure de carte |
| variante B | `stone-high` | `#575C63` | arête haute |
| variante B | `stone-ink` | `#E4E8EA` | texte (8.60:1) |
| variante C | `parch-face` | `#E3D3AE` | papier |
| variante C | `parch-fold` | `#F2E8CC` | repli du papier (`inset 0 0 0 3px`) |
| variante C | `parch-line` | `#B08D5E` | bordure |
| variante C | `parch-ink` | `#3A2E1E` | encre (8.93:1) |

Deux hex restent dans le code mais **sortent** de la palette ; ils ne figurent
ici que pour être déclarés une fois et bannis : `#020617` (`bg-slate-950` des
coques de `App.tsx`) et `#E2E8F0` (le `color` de `src/styles.css`). Avec eux,
**tout hex du document est au §1** : I9 est satisfiable sans exception.

---

## 2. Formes et matière

Tout est **CSS pur** : `box-shadow` inset, `border`, `background-image`,
`outline`. Aucune image, aucun `filter`, aucun pseudo-élément décoratif injecté
par JS. Les valeurs Tailwind sont en **arbitraire explicite** (`rounded-[2px]`)
pour ne pas dépendre des renommages v3→v4 (`rounded-sm` valait 2 px en v3,
4 px en v4).

### 2.1 Panneau

```css
.panel {
  border: 2px solid #8C6D46;
  border-radius: 2px;
  background-color: #3D342A;
  color: #E8DCC8;
  box-shadow:
    inset 0 0 0 1px #4F4437,      /* filet interne : la feuille est encadrée */
    inset 0 1px 0 #6B5C49,        /* arête haute éclairée */
    inset 0 -2px 0 #2E2720,       /* arête basse dans l'ombre */
    0 2px 0 #14100D;              /* socle : le panneau ne flotte pas, il est posé */
}
```

- Rayon **2 px**, jamais plus. Un panneau de HUD est une plaque, pas une bulle.
- Épaisseur de bordure **2 px** (1 px uniquement pour un sous-élément dans un
  panneau, et alors `line-strong`).
- **Liseré doré d'en-tête** (option, une seule par panneau) :
  `box-shadow: inset 0 2px 0 #D4A537, …le reste`. Pas de `border-image` : un
  inset est plus simple à composer avec le reste de la pile d'ombres.
- **Ombre externe** : `0 2px 0` — **offset net**, zéro flou. Un flou est
  interdit (§4).

Équivalent Tailwind :

```
rounded-[2px] border-2 border-line bg-surface-2 text-ink-1
shadow-[inset_0_0_0_1px_#4F4437,inset_0_1px_0_#6B5C49,inset_0_-2px_0_#2E2720,0_2px_0_#14100D]
```

**Champ / creux** (un panneau dans un panneau) :

```css
.field {
  border: 1px solid #57452F;
  border-radius: 1px;
  background-color: #1A1512;
  box-shadow: inset 0 1px 0 #0A0806;
}
```

### 2.2 Boutons — 4 états chiffrés

Géométrie commune : hauteur **32 px**, padding horizontal **12 px**, rayon
**2 px**, bordure **2 px**, texte 12 px / graisse 600, `letter-spacing: 0.02em`.
Transitions **explicites** (pas de `transition-all`, §4) :

```css
transition: background-color 90ms ease-out, border-color 90ms ease-out,
            transform 60ms ease-out, box-shadow 60ms ease-out;
```

| État | Fond | Bordure | Texte | `box-shadow` | Transform |
|---|---|---|---|---|---|
| normal | `#D4A537` | `#8C6D46` | `#2B241D` | `inset 0 1px 0 #F4E9D4, inset 0 -2px 0 #A87C22, 0 2px 0 #14100D` | `none` |
| survol | `#E8DCC8` | `#D4A537` | `#2B241D` | `inset 0 1px 0 #FFF7E7, inset 0 -2px 0 #B9A98F, 0 3px 0 #14100D` | `translateY(-1px)` |
| actif | `#C79A2F` | `#8C6D46` | `#2B241D` | `inset 0 2px 4px #7A5A14` | `translateY(1px)` |
| désactivé | `#3D342A` | `#57452F` | `#8A7E6E` | `inset 0 0 0 1px #2E2720` | `none`, `cursor: not-allowed` |

**Désactivé sans `opacity`.** Le code actuel utilise `disabled:opacity-40` : sur
un fond déjà sombre, l'opacité produit un contraste non calculable (elle mélange
fond et texte). Les quatre valeurs ci-dessus sont mesurables et stables.

**Danger** (action destructrice, ex. « Nouvelle partie → Continuer ») : fond
`#9C2F2F`, bordure `#B83B3B`, texte `#E8DCC8` (5.42:1) ; survol fond `#8F2B2B`
(6.08:1) ; actif `translateY(1px)` + `inset 0 2px 4px #4A1010`.

**Focus clavier** : `outline: 2px solid #F2D64B; outline-offset: 2px;`
(10.56:1 sur `surface-1`). Jamais `focus:` seul — `focus-visible:` pour ne pas
cerner la souris.

### 2.3 Barres — PV / PA / PM

| Barre | Remplissage | Piste | Filet | Hauteur | Texte chiffré |
|---|---|---|---|---|---|
| PV | `#B83B3B` (+ `inset 0 1px 0 #D64545`) | `#1A1512` | 1 px `#57452F` | 8 px (dock), 4 px (mini-carte) | `#D68F87` |
| PA | `#3B6FB8` (+ `inset 0 1px 0 #5A8ACF`) | `#1A1512` | 1 px `#57452F` | 6 px | `#89A0BF` |
| PM | `#4A8C4A` (+ `inset 0 1px 0 #67A867`) | `#1A1512` | 1 px `#57452F` | 6 px | `#91B083` |

- Rayon **1 px**, pas d'arrondi en bout de remplissage (une barre de jeu n'est
  pas une pilule).
- Largeur de remplissage : `Math.floor(100 * courant / max)` %, et **0 %** si
  `max <= 0` (formule déjà dans `ui-dofus-retro.md` §6).
- **Confirmation** : le rouge de vie, le bleu de PA et le vert de PM
  **existent déjà** (`HUD_COLORS.hpRed/apBlue/mpGreen`) et sont **confirmés**
  comme **remplissages**. Ils sont **corrigés comme texte** (2.16:1, 2.41:1,
  2.98:1 sur `surface-2`) : les chiffres utilisent les encres de la dernière
  colonne. C'est la seule correction de couleur du document.
- Le rouge `#B83B3B` est **aussi** « cible invalide » dans la spec canvas. Les
  deux usages ne se croisent jamais : l'un est un pixel PixiJS au sol, l'autre
  un rectangle DOM dans le dock. Collision assumée et documentée.

### 2.4 Case de sort

| État | Fond | Bordure | Texte |
|---|---|---|---|
| vide | transparent | 2 px `dashed` `#8C6D46` à 60 % | — |
| au repos | `surface-1` | 2 px `line` | `ink-1` |
| survol | `surface-1` | 2 px `line-gold` | `ink-1` |
| sélectionnée | `surface-3` | 2 px `#D4A537` + `inset 0 0 0 1px #D4A537` | `ink-1` |
| désactivée | `#332C24` | 2 px `#57452F` | `#8A7E6E` |

Contenu : numéro de raccourci **9 px / 700 / `ink-3`** en haut-gauche, nom du
sort **10 px / 600** sur deux lignes, coût PA **10 px / 700 / `#89A0BF`** en
bas-droite. Le coût PA reste **écrit** (contrairement à 1.29 où il est en
infobulle) : c'est une décision déjà prise dans le code, elle n'est pas rouverte
ici.

### 2.5 Typographie — **aucune police téléchargée**

Contrainte dure : pas de `@font-face`, pas de CDN, pas de dépendance. Donc trois
**empilements système**, assignés par fonction :

| Token | Empilement | px / interligne | Graisse | Usage |
|---|---|---|---|---|
| `display` | `Georgia, 'Iowan Old Style', 'Palatino Linotype', ui-serif, serif` | 30 / 36 | 700 | verdict de fin de combat |
| `title` | idem | 18 / 24 | 700 | titre de panneau, phase |
| `label` | `ui-sans-serif, system-ui, 'Segoe UI', Roboto, sans-serif` | 10 / 14 | 700, majuscules, `letter-spacing: 0.12em` | en-têtes de section |
| `body` | idem | 11 / 16 | 400 | lignes de journal |
| `body-strong` | idem | 12 / 16 | 600 | libellé de bouton |
| `value` | `ui-monospace, 'SF Mono', Menlo, Consolas, monospace` | 14 / 20 | 700, `font-variant-numeric: tabular-nums` | PV / PA / PM |
| `micro` | idem | 9 / 12 | 700 | numéro de raccourci, compteur d'étoiles |

**Pourquoi ça sert le style.** Georgia est **lisible à 10 px** et porte une
connotation de **plaque gravée / registre de bord** ; c'est un des rares serifs
présents sur macOS, Windows et Linux sans téléchargement. Le monospace à
**chiffres tabulaires** empêche les compteurs PV/PA/PM de **trembler** quand ils
passent de `9` à `10` (un `1` est plus étroit qu'un `0` en proportionnel : la
barre saute d'un pixel, ça se voit à chaque tour). Le sans-système sert le texte
dense du journal, là où un serif à 11 px devient poisseux sur 5 lignes.

Règle : **jamais plus de 3 tailles dans un même panneau**. Le dock en utilise
déjà 4 (`text-sm`, `text-[11px]`, `text-[10px]`, `text-[9px]`) — une des causes
du bruit actuel.

---

## 3. Trois variantes de la carte de combattant

> **Variante retenue : A — Pont de navire (décision du propriétaire, 2026-11-22).**
> Les variantes B et C restent documentées ci-dessous, telle quelles : elles
> tracent la décision (« pourquoi pas B / pas C ») et servent si la direction
> change. Ce n'est pas un menu à relire avant chaque PR.

C'est un **goût**, pas un calcul : le propriétaire a choisi. Les trois respectent
le même gabarit (**240 px de large, ≈ 44 px de haut**, rayon 2 px, bordure 2 px,
nom 11 px, ligne de PV 10 px monospace, mini-barre 4 px) et ne changent que la
**matière**. Les **62 px** de `ui-dofus-retro.md` §5 sont la hauteur de la
**bande** d'initiative qui contient la carte (marge et alignement compris), pas
la carte elle-même.


### A — « Pont de navire »

Bois `#4A3728`, joints de planche 1 px `#33261B` tous les 6 px
(`repeating-linear-gradient`), deux clous 2 × 2 px `#14100D` à 4 px des coins
haut-gauche et haut-droit. Bordure 2 px `#8A6A45` (3.08:1 sur le dock), arêtes
`inset 2px 2px 0 #6B5138` / `inset -2px -2px 0 #2E2118`, socle `0 2px 0
#14100D`. Encre `#F0E3C8` (8.85:1). Actif : bordure `#D4A537` + `outline 2px
#D4A537` à 2 px d'offset.
**Sert le mieux** : le HUD actuel, qui est déjà brun (`#2B241D` / `#3D342A`) —
c'est la seule variante qui **ne demande aucune reprise des surfaces**.
**Coût** : 2 `background-image` (bois + clous) à poser **une fois** dans un
token, pas par composant ; les dégradés ramollissent le texte dense sur 240 px ;
implémentation moyenne (la plus longue des trois en CSS, la plus courte en
intégration).

### B — « Pierre gravée »

Pierre `#3B3F44`, joints 1 px `#2A2D31` tous les 8 px, deux runes `▲` `◆`
8 px à 35 % d'opacité en bas-droite (décor, `aria-hidden`). Bordure 2 px
`#6E7681` (3.33:1 sur le dock), `inset 0 1px 0 #575C63` / `inset 0 -2px 0
#2A2D31`. Encre `#E4E8EA` (8.60:1). Actif : bordure `#F2D64B` + `outline 2px
#F2D64B`.
**Sert le mieux** : les panneaux de **grille/terrain** (donjons, salles), où le
sol est minéral — la carte se fond dans le décor au lieu de jurer.
**Coût** : tons **froids** contre un dock chaud `#2B241D` → il faut soit
repeindre le dock, soit accepter un HUD bi-ton (et alors c'est tout le HUD qui
devient B). Implémentation la **moins chère** (aplats + 1 filet). Risque réel :
gris sur gris + coins arrondis + ombres floues = « dashboard SaaS », c'est-à-dire
l'interdit I4.

### C — « Parchemin »

Papier `#E3D3AE`, encre `#3A2E1E` (8.93:1 — la meilleure lisibilité des trois
pour du texte long), bordure 1 px `#B08D5E` (4.97:1 sur le dock) + 3 px de
`inset 0 0 0 3px #F2E8CC` (le papier se replie), sceau de cire 10 px `#B83B3B` à
4 px du coin bas-droit, bords irréguliers via `clip-path: polygon(...)` à ±1 px.
**Sert le mieux** : la **fiche de héros** et le **journal** — les deux surfaces
où l'on lit des phrases, pas des chiffres.
**Coût** : **polarité inversée** sur un HUD sombre : chaque carte devient une
source de lumière sur fond `#2B241D` (10.34:1, la carte « saute »), ce qui casse
le balayage de l'arène 16:9 à douze cartes. `clip-path` rogne l'ombre portée sur
les bords découpés → il faut renoncer au socle `0 2px 0`. Et le rouge du sceau
`#B83B3B` **collisionne avec le rouge de PV**. Implémentation la plus chère des
trois.

**Recommandation si un choix doit être fait maintenant** : **A** pour la carte
de combattant (coût d'intégration nul, contraste 8.85:1), **C** réservé à la
fiche de héros et au journal. **B** seulement si le propriétaire accepte de
repeindre tout le HUD en froid.

---

## 4. Interdits

Formulés comme des **interdits**, pas des préférences. Dérivés de
`ui-dofus-retro.md` §4 et §10.

- **I1 — Mini-carte.** Aucune carte miniature, aucun médaillon de plan.
- **I2 — Bandeau permanent.** Aucune bande permanente de mode / niveau / zone.
  Le bandeau de combat actuel (`data-zone="header"`) reste **une ligne de
  contexte**, pas un tableau de bord ; celui d'exploration ne coexiste pas avec
  un panneau (`tests/ui/layout.spec.ts` le vérifie).
- **I3 — PV flottants permanents hors combat.** Une seule barre à l'écran, celle
  du jeton survolé (`R4`).
- **I4 — « Dashboard SaaS ».** Aucune grille de cartes statistiques (KPI), aucun
  graphe, aucun badge de tendance, aucune colonne de navigation latérale.
- **I5 — Coins arrondis partout.** Rayon **2 px** maximum sur panneau, bouton,
  carte ; **1 px** sur barre et champ. Aucun `rounded-lg`, `rounded-xl`,
  `rounded-full` hors pastille de chemin.
- **I6 — Ombres floues.** Aucune ombre avec un `blur` > 0 (`shadow-md`,
  `shadow-lg`, `shadow-[0_0_8px_…]`). Le halo du combattant actif
  (`TimelineCard`, `shadow-[0_0_8px_#d4a537]`) devient un `outline 2px`.
- **I7 — Verre / dégradés décoratifs.** Aucun `backdrop-blur`, aucun
  `linear-gradient` à 3 arrêts, aucun `opacity` sur un panneau pour le
  « fondre ».
- **I8 — `transition-all`.** Toute transition nomme ses propriétés et sa durée
  (§2.2). Durée maximale **120 ms**.
- **I9 — Couleur hors du §1.** Aucun hex littéral qui ne soit déclaré au §1 :
  surfaces §1.2, lignes §1.3, textes §1.4, encres §1.5, tokens de matière §1.8.
  Le §1 est **exhaustif** et le §6 n'emploie que ses tokens : la règle se
  vérifie en relisant ce document, elle n'est pas une intention. Aucune classe
  `bg-slate-*`, `text-amber-*`, `text-neutral-*` ; `#0f172a`, `#020617`,
  `#e2e8f0`, `text-slate-400` et `text-amber-200` disparaissent.
- **I10 — État désactivé par `opacity`.** Quatre valeurs explicites (§2.2).
- **I11 — Emoji comme icône structurelle.** `❤ ★ 👢` en **icône de ligne de
  statistique** : interdit — remplacer par un libellé (« PV 42/50 »). Les emoji
  restent autorisés **dans le texte du journal**, jamais dans l'ossature d'un
  panneau.
- **I12 — Police téléchargée.** Aucun `@font-face`, aucun lien de police, aucun
  paquet d'icônes.
- **I13 — Barre de vie flottante permanente, toast, combo circulaire, réticule
  animé.** Interdits (§4 de la spec canvas, appliqué aussi au HUD). En revanche,
  sur le canvas, les **nombres de dégâts et de soins flottants sont autorisés** —
  jamais permanents : ~1,5 s, au-dessus du jeton de la cible, Neutre `#E8DCC8`
  (soin `#6AD06A`) cerclé de Pierre `#2B241D` (§1.1). Référence d'implémentation :
  `src/renderer/floatingText.ts`, feature « nombres de dégâts flottants ».

---

## 5. Contraintes dures

Ces contraintes sont **vérifiées par des tests existants** : une refonte qui les
casse fait rougir `npm run check` ou `npm run test:ui`.

### 5.1 Géométrie mesurée par `tests/ui/layout.spec.ts`

Playwright mesure de **vrais rectangles** (`jsdom` renvoie des zéros, ces tests
tournent dans un navigateur). Invariants à ne pas casser :

| Test | Invariant | Conséquence sur la refonte |
|---|---|---|
| « le canvas occupe toute la zone jouable » | canvas centré dans `section[aria-label="Zone jouable"]` | la refonte ne touche pas `App.tsx` (`ARENA_STAGE_CLASS`) |
| « le canvas remplit la surface » | couverture ≥ **95 %** | aucun padding ni bordure ajouté autour du canvas |
| « l'arène et le dock sont contigus » | `expectVerticallyAdjacent` + `expectFlushWithViewportBottom` | le dock reste le **dernier** élément, collé au bas du viewport, **sans marge basse** |
| « le bouton de fin de tour ne recouvre pas les PA/PM » | pas d'intersection `PA_PM_ROW` ∩ `TURN_BUTTON` | le bouton garde **sa propre colonne** (`data-zone="turn"`, 120 px) ; jamais d'`absolute` dessus |
| « le nom du monstre n'est pas masqué par Sorts » | pas d'intersection `TIMELINE` ∩ `SPELLS` | l'initiative reste **une bande dans le flux**, pas un `absolute` |
| « le journal ne recouvre pas la barre de sorts » | `COMBAT_JOURNAL` ∩ (`SPELLS`, `VITALS`) = ∅ | le dock reste une rangée `flex` à colonnes disjointes |
| « l'ordre de jeu tient dans le viewport » | `TIMELINE` dans le viewport, pas d'intersection avec l'arène | hauteur de bande inchangée |

**Budget vertical de combat** : bandeau **~28 px** + bande d'initiative **~62
px** + dock **150 px** = **240 px** (`HUD_HEIGHT_CLASS`). Toute refonte qui
ajoute un pixel de padding dans ces trois bandes doit en retirer un ailleurs, ou
réduire le `flex-1` de l'arène — et le test de couverture du canvas le dira.

### 5.2 Sélecteurs intouchables

- `data-zone` : `header`, `initiative`, `journal`, `vitals`, `turn`, `spells`
  (déclarés dans `src/ui/components/battle/layout.ts`, vérifiés par
  `tests/unit/combatLayout.spec.ts`, qui lit le **rendu HTML**). Ajouter ou
  retirer une zone est un changement de contrat ; **restyler** ne l'est pas.
- `data-hero-cell` sur le `main` de l'arène (`tests/ui/explorationMove.spec.ts`,
  `tests/ui/mapExit.spec.ts`) : format `"x,y"`, intouchable.
- `data-combatant` sur chaque carte (`tests/unit/combatLayout.spec.ts`) :
  valeur = `combatant.id`.
- `aria-label` : **ce sont des sélecteurs**, pas de la décoration. Sont utilisés
  par les tests au minimum : « Zone jouable », « Terrain de combat »,
  « Ressources du héros », « Sorts disponibles », « Ordre de jeu », « Journal de
  combat », « Journal d'exploration », « Dock du héros », « Fiche du héros »,
  « Donjons disponibles », « Combat de salle », « Création de personnage »,
  « Fin du combat ». **Renommer un `aria-label` casse la CI** : on peut changer
  le style du nœud, pas son nom accessible.
- `role="group"` du dock d'exploration et `article` des cartes : conservés.

### 5.3 Aucun asset, aucune dépendance

Pas de fichier image, pas de police, pas de `lucide-react`, pas de
`framer-motion`, pas de `clsx`. Uniquement Tailwind v4 (`@theme`) et du CSS
arbitraire. Toute tentation d'animation se règle avec `transition` nommée +
`transform` (90 ms).

### 5.4 `src/renderer/**` est hors périmètre

**Ce document couvre le HUD HTML, pas le rendu canvas.** Le décor, les sprites,
la grille iso, les anneaux d'équipe, les pastilles de chemin et les traits de
sort sont dessinés par **PixiJS** dans `src/renderer/` et restent régis par
`ui-dofus-retro.md` §3, §5 et §6. Un agent UI **ne modifie pas** `renderer/` ;
un changement de couleur de case se fait dans `tileStyle.ts` / `tokens.ts`, avec
ses propres tests, et pas au nom de ce document.

### 5.5 Règles de code inchangées

Fonctions **≤ 10 lignes**, complexité ≤ 4, désactivation ESLint interdite (on
découpe la fonction), `src/engine/` sans React/Pixi/`window`, zéro donnée métier
en dur (les couleurs ne sont pas de la donnée métier : elles restent dans
`src/ui/`).

---

## 6. Exemple appliqué — carte de combattant, variante A

⚠️ **C'est un exemple dans un document, pas un composant livré.** Il n'est ni
importé, ni testé, ni compilé par cette PR. Il montre « le document appliqué »
pour que la PR d'implémentation ait un point de comparaison exact.

```tsx
import type { CombatantState } from "../../engine/combatLoop/types";
import { formatHpBar } from "../hudHelpers";

interface TimelineCardProps {
  combatant: CombatantState;
  isActive: boolean;
}

/** Variante A — « Pont de navire ». Carte 240 px × ≈ 44 px, rayon 2 px. */
const CARD_BASE =
  "w-60 min-w-0 shrink-0 rounded-[2px] border-2 border-[#8A6A45] bg-[#4A3728] " +
  "bg-[repeating-linear-gradient(0deg,#33261B_0_1px,transparent_1px_6px)] " +
  "px-2 py-1 text-[#F0E3C8] " +
  "shadow-[inset_2px_2px_0_#6B5138,inset_-2px_-2px_0_#2E2118,0_2px_0_#14100D]";

const ACTIVE_CARD =
  `${CARD_BASE} border-[#D4A537] outline outline-2 outline-offset-2 outline-[#D4A537]`;

const IDLE_CARD = CARD_BASE;

function cardClass(isActive: boolean): string {
  return isActive ? ACTIVE_CARD : IDLE_CARD;
}

function cardLabel(combatant: CombatantState): string {
  return `${combatant.name}, niveau ${combatant.level}`;
}

/** Barre 4 px : piste creuse, remplissage rouge, liseré 1 px. */
function MiniHpBar({ percent }: { percent: number }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-[1px] border border-[#57452F] bg-[#1A1512] shadow-[inset_0_1px_0_#0A0806]">
      <div
        className="h-full bg-[#B83B3B] shadow-[inset_0_1px_0_#D64545]"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default function TimelineCard({ combatant, isActive }: TimelineCardProps) {
  const hp = formatHpBar(combatant.hp, combatant.maxHp);
  const label = cardLabel(combatant);
  return (
    <article aria-label={label} data-combatant={combatant.id} className={cardClass(isActive)}>
      <p className="truncate text-[11px] font-bold uppercase leading-4 tracking-[0.08em]">
        {combatant.name}
      </p>
      <p className="font-mono text-[10px] leading-3 tabular-nums text-[#D68F87]">
        Niv. {combatant.level} · {hp.text} PV
      </p>
      <MiniHpBar percent={hp.percent} />
    </article>
  );
}
```

Points de lecture : les **2 px** de bordure et le **rayon 2 px** sont écrits en
arbitraire ; le combattant actif n'a **pas** de halo flou mais un `outline` net
à 2 px d'offset ; la ligne de PV est en **monospace tabulaire** pour ne pas
sauter d'un pixel ; `data-combatant` et `aria-label` sont **inchangés** (ce sont
des sélecteurs) ; `formatHpBar` reste la source du pourcentage (aucun calcul
dupliqué dans le composant).

---

## 7. Ce que ce document ne tranche pas

À arbitrer par le propriétaire, puis à figer par `ui-designer`.

**Tranché :** la variante de la carte de combattant est **A — Pont de navire**
(§3). Les points ci-dessous restent ouverts.

1. **La variante des autres surfaces.** A est retenue pour la carte
   d'initiative ; C (parchemin) reste la candidate pour la fiche de héros et le
   journal, B n'est pas retenue.
2. **Rayon 2 px ou 0 px.** 0 px est plus proche de 1.29, 2 px pardonne mieux les
   bords de bordure à l'écran. Je propose 2 px, je ne l'impose pas.
3. **Serif pour les titres** (Georgia) ou tout en sans-système. Le serif aide le
   registre « plaque gravée » ; il coûte une taille de plus dans le dock.
4. **Le bandeau de combat** : le garder (une ligne) ou le supprimer (Dofus 1.29
   n'en a aucun). Le supprimer **casse** `data-zone="header"` et
   `tests/unit/combatLayout.spec.ts` → c'est un chantier à part.
5. **Le sort du dock 150 px** : le réorganiser en deux colonnes (journal 40 % /
   sorts 60 %) réduirait le bruit, mais change `data-zone` et les tests.

---

## 8. Vérification sans capture

Impossible de rendre le résultat depuis cette session : **aucune capture n'est
fournie, et ce document ne prétend pas montrer à quoi ça ressemble**. Le
propriétaire valide donc **par étapes**, une PR par surface, chacune avec sa
capture d'écran Playwright jointe au corps de PR :

| PR | Surface | Critère de recette |
|---|---|---|
| 1 | `@theme` + `hudTheme.ts` (tokens) | `npm run check` vert, aucune classe changée visuellement |
| 2 | dock de combat (panneaux, en-têtes, bordures) | capture 1440 × 900, `npm run test:ui` vert |
| 3 | carte d'initiative (variante retenue) | capture + contraste de la variante relu |
| 4 | barres PV/PA/PM + compteurs | capture : chiffres lisibles, pas de saut de barre |
| 5 | grille de sorts (5 états) | capture de l'état sélectionné et désactivé |
| 6 | journal + bandeau d'exploration | capture + `tests/ui/layout.spec.ts` vert |
| 7 | overlays (fin de combat, fiche, donjons, confirmation) | capture + boutons danger |

Commande de capture, à joindre à chaque PR :

```bash
npx playwright screenshot --viewport-size=1440,900 "http://localhost:5173/?demo=combat" pr-capture.png
npx playwright test tests/ui/layout.spec.ts
```

Étape suivante possible (hors périmètre) : un test unitaire qui **parse** les
tokens `@theme` et vérifie mécaniquement chaque paire déclarée — il demande une
fonction de luminance côté test, pas une dépendance.
