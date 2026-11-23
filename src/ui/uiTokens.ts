/**
 * Classes composées du HUD — variante A « Pont de navire ».
 *
 * Chaque valeur renvoie à `docs/design/specs/ui-visual-direction.md` :
 * surfaces §1.2, filets §1.3, encres §1.4/§1.5, panneau §2.1, boutons §2.2,
 * cases de sort §2.4, typographie §2.5.
 *
 * Les couleurs sont des `var()` déclarés par `src/ui/theme.css` : aucun hex
 * n'est écrit ici, et aucune classe ne dépend de la génération d'utilitaires
 * `@theme` (voir l'en-tête de `theme.css`).
 *
 * Rappel de composition : un panneau (`surface-2`) ne se pose que sur
 * `surface-1` ou `surface-0`, et son filet est `line-strong` — `line` y tombe à
 * 2.55:1, sous le seuil de 3:1 d'une frontière de composant.
 */

/** Corps de panneau : filet fort 2 px, rayon 2 px, arêtes et socle nets (§2.1). */
export const PANEL_MATERIAL = [
  "rounded-[2px] border-2 border-[var(--color-line-strong)]",
  "bg-[var(--color-surface-2)] text-[var(--color-ink-1)]",
  "shadow-[inset_0_0_0_1px_var(--color-inner-line),inset_0_1px_0_var(--color-edge-high),inset_0_-2px_0_var(--color-edge-low),0_2px_0_var(--color-surface-0)]",
].join(" ");

/** Barre basse du HUD : plaque pierre ceinte d'or, liseré doré sous l'arête haute. */
export const DOCK_SHELL = [
  "pointer-events-auto flex h-[150px] shrink-0 gap-2 rounded-[2px]",
  "border-2 border-[var(--color-line)] bg-[var(--color-surface-1)] px-2 py-2",
  "shadow-[inset_0_2px_0_var(--color-line-gold),inset_0_1px_0_var(--color-edge-high)]",
].join(" ");

/** Creux : piste de barre, champ, emplacement vide (§2.1 `.field`). */
export const FIELD_MATERIAL = [
  "rounded-[1px] border border-[var(--color-line-field)] bg-[var(--color-surface-inset)]",
  "shadow-[inset_0_1px_0_var(--color-field-inset)]",
].join(" ");

/** Titre de panneau : Georgia système, 18 / 24, or de la palette (§2.5). */
export const PANEL_TITLE =
  "font-serif text-[18px] font-bold leading-6 text-[var(--color-line-gold)]";

/** En-tête de section : 10 / 14, capitales, `tracking .12em`, or de la palette. */
export const SECTION_LABEL =
  "text-[10px] font-bold uppercase leading-[14px] tracking-[0.12em] text-[var(--color-line-gold)]";

/** Numéro de raccourci / unité : 9 / 12, encre tertiaire — plancher de lisibilité. */
export const MICRO =
  "font-mono text-[9px] font-bold leading-3 text-[var(--color-ink-3)]";

/** Chiffre du HUD : monospace à chiffres tabulaires, il ne tremble pas (§2.5). */
export const VALUE = "font-mono text-[14px] font-bold leading-5 tabular-nums";

/** Ligne de journal : sans-système, 11 / 16 (§2.5 `body`). */
export const LOG_TEXT = "text-[11px] leading-4";

/**
 * Géométrie commune des boutons (§2.2) : 32 px de haut, rayon 2 px, texte 12/600.
 * Les transitions **nomment** leurs propriétés (I8 : `transition-all` interdit).
 * `focus-visible` seulement : la souris ne ceint pas le bouton.
 */
const BUTTON_BASE = [
  "rounded-[2px] border-2 px-3 py-1.5 text-[12px] font-semibold tracking-[0.02em]",
  "transition-[background-color,border-color,transform,box-shadow] duration-[90ms] ease-out",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
  "disabled:cursor-not-allowed",
].join(" ");

/** État désactivé : franc, jamais délavé (I10). */
const BUTTON_OFF = [
  "disabled:border-[var(--color-line-field)] disabled:bg-[var(--color-surface-2)]",
  "disabled:text-[var(--color-btn-disabled-ink)] disabled:shadow-[inset_0_0_0_1px_var(--color-edge-low)]",
].join(" ");

/** Bouton or : action principale du HUD, quatre états chiffrés (§2.2). */
export const BUTTON_GOLD = [
  BUTTON_BASE,
  "border-[var(--color-line)] bg-[var(--color-btn-face)] text-[var(--color-surface-1)]",
  "shadow-[inset_0_1px_0_var(--color-btn-top-normal),inset_0_-2px_0_var(--color-btn-bottom-normal),0_2px_0_var(--color-surface-0)]",
  "enabled:hover:-translate-y-px enabled:hover:border-[var(--color-line-gold)] enabled:hover:bg-[var(--color-ink-1)]",
  "enabled:hover:shadow-[inset_0_1px_0_var(--color-btn-top-hover),inset_0_-2px_0_var(--color-btn-bottom-hover),0_3px_0_var(--color-surface-0)]",
  "enabled:active:translate-y-px enabled:active:bg-[var(--color-btn-face-active)]",
  "enabled:active:shadow-[inset_0_2px_4px_var(--color-btn-inset-active)]",
  BUTTON_OFF,
].join(" ");

/**
 * Bouton danger (§2.2) : la seule action destructrice de l'interface —
 * « Nouvelle partie → Continuer ». Fond `danger-face` `#9C2F2F`, filet
 * `danger-line`, encre `ink-1` : **5,42:1** au repos, 6,08:1 au survol.
 * Les quatre états restent francs, §2.2 l'exige (aucun `opacity`).
 */
export const BUTTON_DANGER = [
  BUTTON_BASE,
  "border-[var(--color-danger-line)] bg-[var(--color-danger-face)] text-[var(--color-ink-1)]",
  "shadow-[inset_0_1px_0_var(--color-danger-line),inset_0_-2px_0_var(--color-danger-inset),0_2px_0_var(--color-surface-0)]",
  "enabled:hover:-translate-y-px enabled:hover:bg-[var(--color-danger-face-hover)]",
  "enabled:hover:shadow-[inset_0_1px_0_var(--color-danger-line),inset_0_-2px_0_var(--color-danger-inset),0_3px_0_var(--color-surface-0)]",
  "enabled:active:translate-y-px enabled:active:bg-[var(--color-danger-face-hover)]",
  "enabled:active:shadow-[inset_0_2px_4px_var(--color-danger-inset)]",
  BUTTON_OFF,
].join(" ");

/**
 * Bouton compact (§2.2, taille réduite) : la plaque `surface-1` des sorties de
 * fenêtre (« Fermer », « Annuler », « Exporter »…) et des petites actions.
 * Mêmes quatre états ; désactivé **franc**, jamais délavé (I10).
 */
export const BUTTON_COMPACT = [
  "rounded-[2px] border-2 border-[var(--color-line)] bg-[var(--color-surface-1)] px-2 py-0.5",
  "text-[10px] font-bold leading-4 text-[var(--color-ink-1)]",
  "transition-[background-color,border-color,color,box-shadow] duration-[90ms] ease-out",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
  "enabled:hover:border-[var(--color-line-gold)] enabled:hover:text-[var(--color-line-gold)]",
  "enabled:active:translate-y-px enabled:active:bg-[var(--color-surface-2)]",
  "disabled:cursor-not-allowed disabled:border-[var(--color-line-field)]",
  "disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-btn-disabled-ink)]",
].join(" ");

/**
 * Socle d'une case de sort : 2 px de filet, rayon 2 px, aucun `opacity` (§2.4).
 * Les cinq états **francs** ne diffèrent que par la face, le filet et l'encre :
 * c'est la seule façon de rester lisible pour un daltonien, une teinte seule
 * n'étant pas un état.
 */
const SLOT_TILE =
  "relative flex flex-col items-start overflow-hidden rounded-[2px] border-2 text-left leading-none";

export const SLOT_EMPTY = `${SLOT_TILE} border-dashed border-[var(--color-line)] bg-transparent`;

/** Disponible : planche `surface-1`, filet `line`, or au survol. */
export const SLOT_IDLE = [
  `${SLOT_TILE} border-[var(--color-line)] bg-[var(--color-surface-1)] text-[var(--color-ink-1)]`,
  "transition-[border-color,background-color] duration-[90ms] ease-out",
  "enabled:hover:border-[var(--color-line-gold)] enabled:hover:bg-[var(--color-surface-3)]",
].join(" ");

/** Sélectionné : planche `surface-3`, filet or doublé d'un liseré interne. */
export const SLOT_SELECTED =
  `${SLOT_TILE} border-[var(--color-line-gold)] bg-[var(--color-surface-3)] text-[var(--color-ink-1)] shadow-[inset_0_0_0_1px_var(--color-line-gold)]`;

/**
 * Hors portée : **hachures** procédurales (une trame, pas une couleur seule),
 * filet creux et encre tertiaire — 5,10:1 sur `slot-disabled`.
 */
export const SLOT_OUT_OF_RANGE = [
  `${SLOT_TILE} border-[var(--color-line-field)] bg-[var(--color-slot-disabled)] text-[var(--color-ink-3)]`,
  "[background-image:repeating-linear-gradient(45deg,transparent_0_4px,var(--color-field-inset)_4px,var(--color-field-inset)_5px)]",
].join(" ");

/** PA insuffisants : creux commun, mais filet **danger** et liseré bas rouge. */
export const SLOT_NO_AP = [
  `${SLOT_TILE} border-[var(--color-line-field)] bg-[var(--color-slot-disabled)] text-[var(--color-ink-2)]`,
  "shadow-[inset_0_-2px_0_var(--color-danger-line)]",
].join(" ");

/** Verrouillé (ce n'est pas le tour du joueur) : plaque mate, filet pointillé. */
export const SLOT_LOCKED =
  `${SLOT_TILE} border-dotted border-[var(--color-line-field)] bg-[var(--color-surface-2)] text-[var(--color-btn-disabled-ink)]`;

/**
 * Barres du dock (§2.3) : piste creuse, rayon 1 px, **8 px** pour les PV et
 * **6 px** pour les PA/PM. Le remplissage porte l'arête haute de son élément.
 */
const METER = `${FIELD_MATERIAL} w-full overflow-hidden`;
export const HP_METER = `${METER} h-2`;
export const AP_METER = `${METER} h-1.5`;
export const MP_METER = `${METER} h-1.5`;
export const HP_METER_FILL = "h-full bg-[var(--color-hp)] shadow-[inset_0_1px_0_var(--color-hp-high)]";
export const AP_METER_FILL = "h-full bg-[var(--color-ap)] shadow-[inset_0_1px_0_var(--color-ap-high)]";
export const MP_METER_FILL = "h-full bg-[var(--color-mp)] shadow-[inset_0_1px_0_var(--color-mp-high)]";

/**
 * Journal d'éléments (§3.1) : un bandeau de 2 px porte la **couleur de
 * remplissage**, le glyphe et le texte portent l'**encre** — la couleur ne
 * suffit jamais, le glyphe la double pour la deutéranopie.
 */
export const LOG_BAND = "w-0.5 shrink-0 self-stretch";
export const LOG_GLYPH = "w-3 shrink-0 text-center font-mono text-[10px] font-bold leading-4";

/**
 * Carte d'initiative, variante A « Pont de navire » (§3) : planche de bois
 * 240 px × **44 px**, joints et clous fournis par `--texture-wood`
 * (`theme.css`), arêtes nettes et socle `0 2px 0` — aucun flou (I6).
 *
 * `h-11` = 44 px **bordure comprise** : 16 px de nom + 12 px de PV + 4 px de
 * marge + 4 px de mini-barre = 36 px de contenu, plus 4 px de bordure et 4 px
 * de padding. Mesuré à 1280×720 : bandeau 29 px + dock 150 px sur les 240 px du
 * HUD laissent 61 px à la bande d'initiative, dont 52 px occupés par la rangée
 * (`py-1`) — la carte n'a donc **pas** besoin d'agrandir le budget vertical.
 * La couleur de filet n'est pas dans la base : chaque état la pose, sinon
 * l'ordre de la feuille générée déciderait de l'état affiché.
 */
const WOOD_CARD = [
  "h-11 w-60 min-w-0 shrink-0 rounded-[2px] border-2 px-2 py-0.5",
  "bg-[var(--color-wood-face)] [background-image:var(--texture-wood)]",
  "text-[var(--color-wood-ink)]",
  "shadow-[inset_2px_2px_0_var(--color-wood-high),inset_-2px_-2px_0_var(--color-wood-low),0_2px_0_var(--color-surface-0)]",
].join(" ");

/** Carte au repos : filet de bois `wood-line`, 3.08:1 sur le dock (§1.6). */
export const TIMELINE_CARD = `${WOOD_CARD} border-[var(--color-wood-line)]`;

/**
 * Carte du combattant qui joue (§3) : filet **et** `outline 2 px` or à 2 px
 * d'offset. L'`outline` remplace le halo `shadow-[0_0_8px_#d4a537]` ; il ne
 * prend pas de place, donc la bande de 62 px ne grandit pas.
 */
export const TIMELINE_CARD_ACTIVE = [
  WOOD_CARD,
  "border-[var(--color-line-gold)]",
  "outline outline-2 outline-offset-2 outline-[var(--color-line-gold)]",
].join(" ");

/** Mini-barre de PV de la carte : piste creuse de **4 px** (§2.3). */
export const MINI_HP_TRACK = `${FIELD_MATERIAL} mt-1 h-1 w-full overflow-hidden`;

/** Remplissage PV : rouge de vie, arête haute, bout net. */
export const MINI_HP_FILL =
  "h-full bg-[var(--color-hp)] shadow-[inset_0_1px_0_var(--color-hp-high)]";
