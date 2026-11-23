import { OVERLAY_BODY, OVERLAY_SHEET, OVERLAY_TITLE } from "../overlayTheme";

/**
 * Matière de l'écran de création et de la fiche du héros — « registre de bord ».
 *
 * Toutes les couleurs sont des `var()` de `src/ui/theme.css` (hex du
 * `docs/design/specs/ui-visual-direction.md` §1) ; les matières composées
 * suivent §2.1 (panneau, creux), §2.2 (bouton) et §2.5 (typographie).
 *
 * **La feuille n'est pas définie ici** : le corps de parchemin vient de
 * `../overlayTheme` (`OVERLAY_BODY`) et la fiche du héros **est** la fenêtre
 * modale standard (`OVERLAY_SHEET`), pas une copie. C'est la décision du lot 5 :
 * fiche, grimoire, inventaire, donjons, confirmation et fin de combat partagent
 * une seule matière, donc aucune ne peut rediverger.
 *
 * Règles tenues ici, pas dans les composants :
 * - rayon **2 px** (1 px pour un creux), jamais 4 px ;
 * - filet **2 px** sur une planche ou un panneau, **1 px** sur un creux ;
 * - ombres **nettes** (`0 2px 0`, insets), aucun flou (I6) ;
 * - aucun état par `opacity` (I10), aucune transition implicite (I8).
 */

/** Feuille de création : une seule liseré doré en tête (§2.1), 16 px de respiration. */
export const CREATION_SHEET = `pointer-events-auto flex w-full max-w-3xl flex-col gap-4 p-4 ${OVERLAY_BODY}`;

/** Fiche du héros : **la** fenêtre modale standard, même jeton que le grimoire. */
export const HERO_SHEET = OVERLAY_SHEET;

/** Titre d'écran : `display` 30 / 36, Georgia, or `line-gold` (§2.5). */
export const CREATION_TITLE =
  "font-[family-name:var(--font-display)] text-[30px] font-bold leading-9 text-[var(--color-line-gold)]";

/** Titre de la fiche : `title` 18 / 24, Georgia, or (§2.5). */
export const HERO_SHEET_TITLE = OVERLAY_TITLE;

/** Planche de classe : bois `wood-face` texturé, filet 2 px, socle net (§3 A). */
const CLASS_CARD = [
  "flex flex-col gap-1 rounded-[2px] border-2 px-2 py-1.5 text-left",
  "bg-[var(--color-wood-face)] [background-image:var(--texture-wood)] text-[var(--color-wood-ink)]",
  "transition-[border-color,background-color,box-shadow] duration-[90ms] ease-out",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
].join(" ");

/**
 * Relief d'une planche : arêtes hautes/basses en inset, socle `0 2px 0`.
 * Il est **par variante**, jamais dans la base : deux classes `shadow-[…]` sur
 * le même nœud ne se composent pas, c'est l'ordre de la feuille qui tranche.
 */
const PLANK = "shadow-[inset_2px_2px_0_var(--color-wood-high),inset_-2px_-2px_0_var(--color-wood-low),0_2px_0_var(--color-surface-0)]";

/** Planche au repos : filet de bois `wood-line`, survol or. */
export const CLASS_CARD_IDLE = `${CLASS_CARD} border-[var(--color-wood-line)] hover:border-[var(--color-line-gold)] ${PLANK}`;

/** Planche choisie : filet **et** cerclage or intérieur, franc (pas d'`opacity`). */
export const CLASS_CARD_PICKED = [
  CLASS_CARD,
  "border-[var(--color-line-gold)]",
  "shadow-[inset_0_0_0_1px_var(--color-line-gold),inset_2px_2px_0_var(--color-wood-high),inset_-2px_-2px_0_var(--color-wood-low),0_2px_0_var(--color-surface-0)]",
].join(" ");

/** Nom de classe : 13 / 18, encre de bois claire (8,79:1 sur `wood-face`). */
export const CLASS_NAME = "text-[13px] font-bold leading-[18px] text-[var(--color-wood-ink)]";

/** Quatre stats de base : 10 px monospace tabulaire, même encre, hiérarchie par la taille. */
export const CLASS_STATS =
  "flex justify-between font-mono text-[10px] leading-[14px] tabular-nums text-[var(--color-wood-ink)]";

/** Champ du nom : creux 1 px `surface-inset`, focus visible or (§2.1, §2.2). */
export const NAME_FIELD = [
  "w-full rounded-[1px] border border-[var(--color-line-field)] bg-[var(--color-surface-inset)]",
  "px-2 py-1.5 text-[12px] leading-4 text-[var(--color-ink-1)]",
  "shadow-[inset_0_1px_0_var(--color-field-inset)]",
  "placeholder:text-[var(--color-ink-3)]",
  "focus-visible:border-[var(--color-line-gold)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus)]",
].join(" ");

/** Validité du nom : `ink-3` 11 / 15, plancher de lisibilité — plus d'`opacity-80`. */
export const NAME_HINT = "text-[11px] leading-[15px] text-[var(--color-ink-3)]";

/** Répartition du capital : creux d'un panneau (`surface-1`, filet fort 1 px). */
export const ALLOCATION_PANEL = [
  "pointer-events-auto flex w-full flex-col gap-2 rounded-[2px] border border-[var(--color-line-strong)]",
  "bg-[var(--color-surface-1)] px-2 py-2 text-[var(--color-ink-1)]",
  "shadow-[inset_0_1px_0_var(--color-edge-high)]",
].join(" ");

/** Ligne de caractéristique : libellé 12 / 16, chiffres tabulaires à droite. */
export const ALLOCATION_ROW = "flex items-center gap-2 text-[12px] leading-4";

/** Valeur courante : monospace 12 px, elle ne tremble pas quand elle change. */
export const ALLOCATION_CURRENT = "w-10 text-right font-mono text-[12px] font-bold tabular-nums";

/** Palier de soft cap : 10 px monospace, or (6,73:1 sur `surface-1`). */
export const ALLOCATION_TIER =
  "w-32 text-right font-mono text-[10px] leading-[14px] tabular-nums text-[var(--color-line-gold)]";

/**
 * Bouton `+` de 24 px : face or, quatre états chiffrés (§2.2). Désactivé **sans**
 * `opacity` : l'ancien `disabled:opacity-40` rendait le contraste incalculable.
 * `p-0` est indispensable : le padding natif du bouton (1px 6px) rognait le `+`.
 */
export const PLUS_BUTTON = [
  "flex h-6 w-6 items-center justify-center rounded-[2px] border-2 border-[var(--color-line)] bg-[var(--color-btn-face)] p-0",
  "text-[14px] font-bold leading-none text-[var(--color-surface-1)]",
  "shadow-[inset_0_1px_0_var(--color-btn-top-normal),inset_0_-2px_0_var(--color-btn-bottom-normal)]",
  "transition-[background-color,border-color,transform] duration-[90ms] ease-out",
  "enabled:hover:border-[var(--color-line-gold)] enabled:hover:bg-[var(--color-ink-1)]",
  "enabled:active:translate-y-px enabled:active:bg-[var(--color-btn-face-active)]",
  "disabled:cursor-not-allowed disabled:border-[var(--color-line-field)]",
  "disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-btn-disabled-ink)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-focus)]",
].join(" ");
