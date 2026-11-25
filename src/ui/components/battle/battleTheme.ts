import { DOCK_SHELL, FIELD_MATERIAL, PANEL_MATERIAL } from "../../uiTokens";

/**
 * Jetons visuels du panneau 1vN et du dock de combat — variante A « Pont de
 * navire ». La matière vient de `src/ui/uiTokens.ts` (hex de
 * `docs/design/specs/ui-visual-direction.md` §1) ; ici, composition seulement.
 *
 * Les couleurs par combattant sont calculées (`colorForId`) et posées en style
 * inline, seule façon d'exprimer une couleur procédurale sans CSS à la volée.
 *
 * `shadow-lg` a disparu : l'ombre d'un panneau est un socle net de 2 px, sans
 * flou (I6), et aucune transition n'est globale (I8).
 */
/**
 * UI-05 : le panneau est une **colonne du flux**, pas un overlay. Il réserve
 * 320 px à côté de l'arène ; aucune case ne passe dessous et le clic de carte
 * ne peut plus être capté par le HUD. `h-full` épouse la rangée de jeu, donc le
 * panneau et l'arène partagent la même hauteur au-dessus du dock.
 */
export const BATTLE_PANEL =
  `pointer-events-auto relative flex h-full w-[320px] shrink-0 flex-col gap-1 p-2 ${PANEL_MATERIAL}`;

export const BATTLE_LIST = "flex flex-col gap-1";

/** Combattant : `surface-1` posé sur le panneau `surface-2`, filet or 2 px. */
export const COMBATANT_CARD =
  "rounded-[2px] border-2 border-[var(--color-line)] bg-[var(--color-surface-1)] px-2 py-1";

export const ACTIVE_CARD = "outline outline-2 outline-[var(--color-line-gold)]";

export const TARGETABLE_CARD = "ring-1 ring-[var(--color-danger-line)]";

export const CARD_HEAD = "flex items-center gap-2 text-xs font-bold";

export const COLOR_DOT = "inline-block h-3 w-3 shrink-0 rounded-full";

export const STATS_LINE = "text-[11px] leading-4 text-[var(--color-ink-2)]";

export const HP_TRACK = `${FIELD_MATERIAL} h-1 w-full overflow-hidden`;

export const HP_FILL = "h-full bg-[var(--color-hp)] shadow-[inset_0_1px_0_var(--color-hp-high)]";

export const ACTION_BUTTON = [
  "mt-1 rounded-[2px] border-2 border-[var(--color-line)] bg-[var(--color-surface-1)] px-2 py-0.5",
  "text-[11px] text-[var(--color-ink-1)]",
  "transition-[background-color,border-color,color] duration-[90ms] ease-out",
  "enabled:hover:border-[var(--color-line-gold)] enabled:hover:bg-[var(--color-btn-face)]",
  "enabled:hover:text-[var(--color-surface-1)]",
].join(" ");

export const FOOT = "mt-1 flex flex-col gap-1";

/**
 * Dock du combat 1v1 : une colonne par zone (`layout.ts`). Le bouton de tour a
 * la sienne, chiffrée en `px` : il ne peut plus être écrasé par les compteurs.
 */
export const COMBAT_DOCK = DOCK_SHELL;

export const DOCK_JOURNAL = "min-w-0 w-[28%]";

export const DOCK_VITALS = "min-w-0 w-[20%]";

export const DOCK_TURN = "flex w-[120px] shrink-0 items-center";

export const DOCK_SPELLS = "min-w-0 flex-1";

/** Encre secondaire : plus d'`opacity` sur du texte (I7/I10), une couleur mesurée. */
export const LOG_LINE = "truncate text-[10px] leading-4 text-[var(--color-ink-2)]";

export const HINT = "text-[10px] leading-4 text-[var(--color-ink-2)]";

/** Refus géométrique : encre tertiaire, italique, lisible à côté de la cible. */
export const BLOCKED_HINT = "text-[10px] italic leading-4 text-[var(--color-ink-3)]";

/**
 * Bande d'initiative (COMBAT-05) : deux colonnes de puces, matières du panneau.
 * L'actif ne se lit jamais à la couleur seule — la puce porte « ▸ » en plus du
 * filet or, et son libellé accessible finit par « actif ».
 */
export const INITIATIVE_BLOCK = "mt-0.5 flex flex-col gap-0.5";

export const INITIATIVE_GRID = "grid grid-cols-2 gap-x-1 gap-y-0.5";

export const INITIATIVE_CHIP = [
  "flex min-w-0 items-center gap-1 rounded-[1px] border px-1",
  "border-[var(--color-line-field)] bg-[var(--color-surface-1)]",
  "text-[10px] leading-4 text-[var(--color-ink-2)]",
].join(" ");

export const INITIATIVE_ACTIVE = "border-[var(--color-line-gold)] text-[var(--color-ink-1)]";

export const INITIATIVE_MARK = "w-2 shrink-0 text-center font-mono text-[10px] font-bold text-[var(--color-line-gold)]";

export const INITIATIVE_CAMP = "w-3 shrink-0 text-center text-[9px] text-[var(--color-ink-3)]";

export const INITIATIVE_POSITION = "shrink-0 font-mono text-[10px] font-bold tabular-nums text-[var(--color-ink-3)]";

export const INITIATIVE_NAME = "min-w-0 flex-1 truncate";

export const INITIATIVE_VALUE = "shrink-0 font-mono text-[10px] tabular-nums text-[var(--color-ink-3)]";
