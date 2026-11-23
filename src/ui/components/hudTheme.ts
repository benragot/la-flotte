import { BUTTON_GOLD, PANEL_MATERIAL, SECTION_LABEL } from "../uiTokens";

/**
 * Jetons visuels partagés du HUD — variante A « Pont de navire ».
 *
 * La **matière** (surfaces, filets, encres, ombres) vit dans `src/ui/uiTokens.ts`
 * et ne s'écrit qu'une fois ; ce fichier ne compose que la **mise en page** des
 * surfaces historiques du HUD. Les hex sont ceux de
 * `docs/design/specs/ui-visual-direction.md` §1, via `src/ui/theme.css`.
 *
 * `HUD_COLORS` (`../hudHelpers`) reste la référence documentée de la palette
 * pour le canvas : elle n'est ni complétée ni renommée ici.
 */

/** Panneau posé dans le dock : corps `surface-2`, filet fort 2 px, rayon 2 px. */
export const DOCK_PANEL =
  `pointer-events-auto flex h-full min-w-0 flex-col px-2 py-1 ${PANEL_MATERIAL}`;

/**
 * Bandeau de contexte (`data-zone="header"`) : une seule ligne, plaque
 * `surface-1` **opaque** — un fond translucide rend le contraste incalculable,
 * et `line` `#8C6D46` tombait à 3,31:1 sur le bandeau précédent.
 *
 * Hauteur inchangée (28 px : `py-1` + ligne de 20 px + filet bas 1 px) : le
 * budget vertical 28 + 62 + 150 = 240 px de `App.tsx` ne bouge pas.
 */
export const TOP_BANNER = [
  "pointer-events-auto flex shrink-0 items-baseline gap-4",
  "border-b border-[var(--color-line-soft)] bg-[var(--color-surface-1)]",
  "py-1 pl-3 pr-3 text-[var(--color-ink-1)]",
].join(" ");

/** Titre du bandeau : 14 px gras, or `line-gold` (6,73:1 sur `surface-1`). */
export const TOP_BANNER_TITLE =
  "text-sm font-bold tracking-wide text-[var(--color-line-gold)]";

/** Ligne de contexte (carte, tour) : `ink-2`, 9,4:1 — plus d'`opacity-80`. */
export const TOP_BANNER_CONTEXT = "text-[11px] text-[var(--color-ink-2)]";

/** Version : `ink-3` 5,66:1, le plancher de lisibilité (§1.4). */
export const TOP_BANNER_MICRO =
  "font-mono text-[10px] font-normal text-[var(--color-ink-3)]";

/** En-tête de section : 10 px capitales, `tracking .12em` (§2.5 `label`). */
export const SECTION_HEADING = SECTION_LABEL;

/**
 * La fenêtre modale n'est **plus** définie ici : `OVERLAY_SHEET` vit dans
 * `./overlayTheme` depuis le lot 5, avec la matière unique des overlays
 * (parchemin). Ce fichier ne garde que la mise en page des surfaces du HUD.
 */

/** Action principale : bouton or à quatre états (§2.2). Plus d'`opacity-40`. */
export const PRIMARY_BUTTON = BUTTON_GOLD;

/**
 * Bouton de barre d'accès (Inventaire, Fiche perso, Sorts, Donjons) : plaque
 * `surface-1` à filet 2 px, rayon 2 px, socle net. Le survol éclaire le filet
 * en or ; désactivé, il prend les valeurs de §2.2 — jamais d'`opacity`.
 */
export const CHROME_BUTTON = [
  "rounded-[2px] border-2 border-[var(--color-line)] bg-[var(--color-surface-1)] px-2 py-1",
  "text-[12px] font-semibold text-[var(--color-ink-1)]",
  "shadow-[inset_0_1px_0_var(--color-edge-high),0_2px_0_var(--color-surface-0)]",
  "transition-[background-color,border-color,color] duration-[90ms] ease-out",
  "enabled:hover:border-[var(--color-line-gold)] enabled:hover:text-[var(--color-line-gold)]",
  "disabled:cursor-not-allowed disabled:border-[var(--color-line-field)] disabled:text-[var(--color-btn-disabled-ink)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
].join(" ");
