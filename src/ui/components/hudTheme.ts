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

/** En-tête de section : 10 px capitales, `tracking .12em` (§2.5 `label`). */
export const SECTION_HEADING = SECTION_LABEL;

/** Feuille centrée des panneaux superposés (fiche perso, grimoire). */
export const OVERLAY_SHEET =
  `flex max-h-full w-full max-w-xl flex-col gap-2 overflow-auto p-3 ${PANEL_MATERIAL}`;

/** Action principale : bouton or à quatre états (§2.2). Plus d'`opacity-40`. */
export const PRIMARY_BUTTON = BUTTON_GOLD;
