/**
 * Matière **unique** des fenêtres modales — « registre de bord » (parchemin).
 *
 * Décision du lot 5 (arbitrage de la divergence relevée au lot 4 : fiche du
 * héros en parchemin, grimoire en bois). **Une seule** matière pour **toutes**
 * les fenêtres posées au-dessus de l'arène : inventaire, fiche du héros,
 * grimoire, donjons, confirmation « Nouvelle partie », fin de combat.
 *
 * Pourquoi le parchemin (`docs/design/specs/ui-visual-direction.md` §3-C) :
 * - ces six surfaces servent d'abord à **lire** — caractéristiques d'objet,
 *   description de sort, refus d'entrée, récompenses ; c'est la variante que la
 *   spec §3 réserve à « la fiche de héros et au journal », et `ink-1` sur
 *   `surface-2` y pèse **9,00:1** (§1.6) ;
 * - un overlay flotte sur `--color-scrim`, jamais sur le dock : la polarité
 *   inversée reprochée à C dans une arène de douze cartes ne s'applique pas ;
 * - le bois reste la matière des **cartes d'initiative et des planches de
 *   classe** (variante A) : une seule surface en bois par écran, pas deux.
 *
 * `HERO_SHEET` (`./hero/heroTheme`) et `OVERLAY_SHEET` **sont le même jeton** :
 * `heroTheme` importe celui-ci et le ré-exporte, donc aucune copie ne peut
 * diverger — c'est exactement le défaut que l'audit du lot 4 avait trouvé.
 *
 * Toutes les couleurs sont des `var()` de `src/ui/theme.css` : aucun hex ici.
 * Formes §2.1 (rayon 2 px, filet 2 px, ombres nettes), typographie §2.5.
 */

/** Corps de fenêtre : panneau `surface-2`, filet fort 2 px, fibres de parchemin. */
export const OVERLAY_BODY = [
  "rounded-[2px] border-2 border-[var(--color-line-strong)]",
  "bg-[var(--color-surface-2)] [background-image:var(--texture-parchment)]",
  "text-[var(--color-ink-1)]",
  "shadow-[inset_0_2px_0_var(--color-line-gold),inset_0_0_0_1px_var(--color-inner-line),inset_0_-2px_0_var(--color-edge-low),0_2px_0_var(--color-surface-0)]",
].join(" ");

/** Coque commune : une colonne défilante, 12 px de respiration, gardée au viewport. */
const OVERLAY_SHELL = `flex max-h-full w-full flex-col gap-2 overflow-auto p-3 ${OVERLAY_BODY}`;

/** Fenêtre standard (fiche du héros, grimoire, donjons) : 576 px. */
export const OVERLAY_SHEET = `${OVERLAY_SHELL} max-w-xl`;

/** Fenêtre large (inventaire à deux colonnes) : 768 px. */
export const OVERLAY_SHEET_WIDE = `${OVERLAY_SHELL} max-w-3xl`;

/** Fenêtre étroite (confirmation, fin de combat) : une question, une réponse. */
export const OVERLAY_SHEET_NARROW = `${OVERLAY_SHELL} max-w-md`;

/** Titre de fenêtre : 18 / 24 Georgia, or du thème (§2.5 `title`). */
export const OVERLAY_TITLE =
  "font-[family-name:var(--font-display)] text-[18px] font-bold leading-6 text-[var(--color-line-gold)]";

/** Bandeau de tête : titre à gauche, sortie à droite, filet `line-soft` de séparation. */
export const OVERLAY_HEAD =
  "flex items-center justify-between gap-2 border-b border-[var(--color-line-soft)] pb-2";

/** Voile de fenêtre : `surface-0` translucide, jamais un fond de panneau (I7). */
const LAYER_BASE =
  "pointer-events-auto inset-0 flex items-center justify-center overflow-auto bg-[var(--color-scrim)] p-4";

/**
 * Voile des fenêtres modales : **`fixed`**, pas `absolute`. Mesuré en capture
 * (1280×720) : en `absolute`, le voile épousait la seule zone jouable et
 * laissait la colonne du journal et le dock en pleine lumière — deux surfaces
 * qui rivalisaient avec la fenêtre ouverte. `fixed` couvre le viewport entier.
 *
 * **Arbitrage : le voile intercepte les clics** (`pointer-events-auto`). Une
 * fenêtre ouverte est modale : la barre d'accès (`z-30`) et le dock sont
 * inertes tant qu'elle est là. Laisser passer les clics rendrait le dock
 * cliquable *derrière* une modale — c'est un bug d'ergonomie, pas un
 * raccourci. Conséquence pour les tests : on referme la fenêtre (Échap) et on
 * attend sa disparition **avant** de cliquer le bouton suivant.
 */
export const LAYER_SCRIM = `${LAYER_BASE} fixed z-40`;

/** Voile local à une bande du HUD (fin de combat) : il reste **sous** les fenêtres. */
export const LAYER_LOCAL = `${LAYER_BASE} absolute z-20`;

/**
 * Voile de la fin de combat : plein écran (l'arène n'est plus jouable) mais
 * **sous** la barre d'accès (`z-30`) et sous les fenêtres (`z-40`), pour que
 * « Nouvelle partie » reste atteignable après une défaite.
 */
export const LAYER_END = `${LAYER_BASE} fixed z-10`;

/**
 * Voile d'une boîte de dialogue montée **dans** la barre d'accès (1 px de haut) :
 * `fixed` est indispensable, sinon le voile se réduirait à ses boutons ; `z-50`
 * le pose au-dessus des autres fenêtres.
 */
export const LAYER_DIALOG = `${LAYER_BASE} fixed z-50`;

/** Plaque intérieure (carte de donjon) : `surface-1` posé sur le parchemin. */
export const OVERLAY_CARD = [
  "flex flex-col gap-1 rounded-[2px] border border-[var(--color-line-strong)]",
  "bg-[var(--color-surface-1)] px-2 py-1",
  "shadow-[inset_0_1px_0_var(--color-edge-high)]",
].join(" ");

/** Texte de lecture d'une fenêtre : 11 / 16, encre secondaire (7,01:1). */
export const OVERLAY_TEXT = "text-[11px] leading-4 text-[var(--color-ink-2)]";

/** Texte fort d'une fenêtre : 12 / 16, encre principale (9,00:1). */
export const OVERLAY_TEXT_STRONG = "text-[12px] font-bold leading-4 text-[var(--color-ink-1)]";

/**
 * Plaque de danger **franche** : `ink-1` sur `danger-face` = **5,42:1**
 * (§1.6, §2.2). Le filet sombre `surface-0` donne l'arête de la plaque
 * (3,2:1 sur le parchemin) sans ajouter de teinte (§1.8).
 */
export const DANGER_PLAQUE = [
  "inline-block rounded-[1px] border border-[var(--color-surface-0)]",
  "bg-[var(--color-danger-face)] px-1.5 py-0.5 text-[11px] font-bold leading-4 text-[var(--color-ink-1)]",
].join(" ");
