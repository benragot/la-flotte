import { BUTTON_COMPACT } from "../../uiTokens";
import { OVERLAY_SHEET_WIDE } from "../overlayTheme";

/**
 * Jetons de **contenu** des fenêtres modales (inventaire, grimoire).
 *
 * Ramené au thème unique au lot 5 : plus **aucun hex** ici. Les surfaces, filets
 * et encres viennent de `src/ui/theme.css` par `var()`, la matière du corps de
 * fenêtre de `../overlayTheme`, et les tailles de bouton de `../../uiTokens`.
 *
 * Trois règles tenues par les jetons, pas par les composants :
 * - un état n'est **jamais** un `opacity` (I10) : « en attente » se lit à
 *   l'encre tertiaire + un filet pointillé, pas à 60 % de transparence ;
 * - une encre de texte reste ≥ 4,5:1 : `ink-3` sur `surface-1` = 5,66:1,
 *   `ink-danger` sur `surface-inset` = 6,3:1, `el-air-ink` sur `surface-2` = 6:1 ;
 * - rayon **2 px** (1 px pour une tuile ou un creux), filet 2 px sur une plaque.
 */

/** Fenêtre de l'inventaire : la coque large des overlays, deux colonnes dedans. */
export const PANEL = OVERLAY_SHEET_WIDE;

/** En-tête de section : 10 px capitales, `tracking .12em` (§2.5 `label`). */
export const HEADING =
  "text-[10px] font-bold uppercase leading-[14px] tracking-[0.12em] text-[var(--color-line-gold)]";

export const ROW = "flex flex-wrap items-center gap-1";

export const LIST = "flex min-h-0 flex-col gap-1 overflow-y-auto text-[11px]";

export const COLUMNS = "grid min-h-0 flex-1 grid-cols-2 gap-2";

export const COLUMN = "flex min-w-0 flex-col gap-1";

export const SLOT_GRID = "grid grid-cols-2 gap-1";

/** Tuile d'emplacement : plaque 2 px, rayon 2 px, transitions nommées (I8). */
const SLOT_TILE = [
  "flex flex-col items-start rounded-[2px] border px-1 py-0.5 text-left text-[10px] leading-3",
  "transition-[border-color,background-color,color] duration-[90ms] ease-out",
].join(" ");

/** Emplacement occupé : planche `surface-1`, filet de cuivre, survol or. */
export const SLOT_FILLED = [
  `${SLOT_TILE} border-[var(--color-line)] bg-[var(--color-surface-1)] text-[var(--color-ink-1)]`,
  "hover:border-[var(--color-line-gold)]",
].join(" ");

/** Emplacement vide : creux pointillé, encre tertiaire — franc, pas translucide. */
export const SLOT_EMPTY =
  `${SLOT_TILE} border-dashed border-[var(--color-line-field)] bg-[var(--color-surface-inset)] text-[var(--color-ink-3)]`;

/** Tuile dont l'objet porté est ouvert dans le bandeau de détail : cerclage or. */
export const SLOT_SELECTED = [
  `${SLOT_TILE} border-[var(--color-line-gold)] bg-[var(--color-surface-3)] text-[var(--color-ink-1)]`,
  "shadow-[inset_0_0_0_1px_var(--color-line-gold)]",
].join(" ");

/** Libellé du slot : encre tertiaire sur `surface-1` (5,66:1), plus d'`opacity-70`. */
export const SLOT_LABEL = "text-[var(--color-ink-3)]";

/** Micro-action d'une tuile (« Détails », « × ») : filet creux, or au survol. */
export const SLOT_ACTION = [
  "rounded-[1px] border border-[var(--color-line-field)] bg-[var(--color-surface-1)] px-1",
  "text-[9px] font-bold leading-3 text-[var(--color-ink-2)]",
  "transition-[border-color,color] duration-[90ms] ease-out",
  "hover:border-[var(--color-line-gold)] hover:text-[var(--color-line-gold)]",
  "aria-pressed:border-[var(--color-line-gold)] aria-pressed:text-[var(--color-line-gold)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus)]",
].join(" ");

/** Bouton compact des fenêtres : quatre états francs, focus clavier visible. */
export const SMALL_BUTTON = BUTTON_COMPACT;

/** Pastille d'attribut : filet 1 px, rayon 1 px, texte 10 px. */
export const CHIP = "rounded-[1px] border px-1 py-0.5 text-[10px] leading-3";

/** Valeur positive : or sur `surface-1`, 6,73:1. */
export const TEXT_GOLD =
  "border-[var(--color-line-gold)] bg-[var(--color-surface-1)] text-[var(--color-line-gold)]";

/** Valeur neutre : encre tertiaire sur `surface-1`, 5,66:1. */
export const TEXT_MUTED =
  "border-[var(--color-line-field)] bg-[var(--color-surface-1)] text-[var(--color-ink-3)]";

/** Statistique affichée mais inerte en combat (D45) : filet pointillé, pas d'`opacity`. */
export const TEXT_PENDING = [
  "border-dotted border-[var(--color-line-field)] bg-[var(--color-surface-inset)] text-[var(--color-ink-3)]",
  "line-through decoration-dotted",
].join(" ");

/** Succès (import, sauvegarde) : encre d'élément Air, 6,00:1 sur le parchemin. */
export const TEXT_OK = "text-[var(--color-el-air-ink)]";

/** Refus (import, équipement) : encre de danger, 4,72:1 sur le parchemin. */
export const TEXT_KO = "text-[var(--color-ink-danger)]";

/** Champ creux (export/import) : 1 px `line-field`, fond `surface-inset`. */
export const FIELD = [
  "h-12 w-full resize-none rounded-[1px] border border-[var(--color-line-field)]",
  "bg-[var(--color-surface-inset)] p-1 text-[10px] text-[var(--color-ink-1)]",
  "shadow-[inset_0_1px_0_var(--color-field-inset)]",
  "placeholder:text-[var(--color-ink-3)]",
  "focus-visible:border-[var(--color-line-gold)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus)]",
].join(" ");

/** Liste vide : encre tertiaire, italique — lisible sans `opacity`. */
export const EMPTY_HINT = "text-[10px] italic leading-3 text-[var(--color-ink-3)]";

/** Bandeau de détail ancré en bas de l'inventaire (place laissée libre par la grille). */
export const DETAIL_PANEL =
  "flex min-h-[96px] shrink-0 flex-col gap-1 overflow-y-auto border-t border-[var(--color-line-strong)] pt-1";

/** Invite de la fenêtre de détail : l'ancien `opacity-60` rendait l'encre incalculable. */
export const DETAIL_HINT = EMPTY_HINT;

/** Métadonnées d'un objet ou d'un sort : encre secondaire, 7,01:1. */
export const DETAIL_META = "text-[10px] leading-3 text-[var(--color-ink-2)]";

/** Description : encre secondaire italique — lisible, sans transparence. */
export const DETAIL_DESCRIPTION = "text-[10px] leading-3 italic text-[var(--color-ink-2)]";

/** Titre d'une fiche (objet, sort) : 12 px gras, or du thème. */
export const DETAIL_TITLE = "text-[12px] font-bold leading-4 text-[var(--color-line-gold)]";

/** Ligne d'objet sélectionnable : bouton focusable dans une liste `role="listbox"`. */
export const ITEM_ROW =
  "flex items-center gap-1 rounded-[1px] border border-transparent px-1 py-0.5 text-[11px]";

/** Ligne ouverte : `surface-3` cerclé d'or (encre principale, jamais `ink-3`). */
export const ITEM_ROW_SELECTED = `${ITEM_ROW} border-[var(--color-line-gold)] bg-[var(--color-surface-3)]`;

/** Nom cliquable d'une ligne : or au survol, 90 ms, propriété nommée (I8). */
export const ITEM_BUTTON =
  "min-w-0 flex-1 truncate text-left transition-[color] duration-[90ms] ease-out hover:text-[var(--color-line-gold)]";
