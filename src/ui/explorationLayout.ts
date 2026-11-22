/**
 * Ancrages de l'exploration, sortis du HUD de combat :
 * - le journal est une **colonne gauche** dans le flux (jamais le dock bas) ;
 * - le bandeau d'état est un **overlay absolu haut-gauche**, posé sur la carte.
 *
 * Les couleurs restent en littéraux Tailwind arbitraires : Tailwind ne génère
 * du CSS qu'à partir de chaînes présentes dans les sources.
 */
export const JOURNAL_PANEL =
  "pointer-events-auto flex h-full w-64 shrink-0 flex-col gap-1 border-r-2 border-[#8c6d46] bg-[#2b241d] px-2 py-2 text-[#e8dcc8]";

export const JOURNAL_ENTRIES = "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto text-[11px] leading-4";

/** `pointer-events-none` : le clic traverse le bandeau et déplace le héros. */
export const STATUS_OVERLAY =
  "pointer-events-none absolute left-2 top-2 z-20 flex flex-col gap-0.5 rounded border border-[#8c6d46]/60 bg-[#2b241d]/90 px-3 py-1 text-[#e8dcc8]";

export const STATUS_TITLE = "text-sm font-bold tracking-wide text-[#d4a537]";
export const STATUS_HINT = "text-sm font-semibold text-[#d4a537]";
export const STATUS_TEXT = "text-[11px] opacity-80";
