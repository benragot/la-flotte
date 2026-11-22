/**
 * Jetons visuels du panneau 1vN. Littéraux Tailwind uniquement : les couleurs
 * par combattant sont calculées (`colorForId`) et posées en style inline, seule
 * façon d'exprimer une couleur procédurale sans générer de CSS à la volée.
 */
export const BATTLE_PANEL =
  "pointer-events-auto absolute left-2 top-2 z-20 flex w-[320px] flex-col gap-1 rounded border-2 border-[#8c6d46] bg-[#3d342a]/95 p-2 text-[#e8dcc8] shadow-lg";

export const BATTLE_LIST = "flex flex-col gap-1";

export const COMBATANT_CARD = "rounded border border-[#8c6d46] bg-[#2b241d] px-2 py-1";

export const ACTIVE_CARD = "outline outline-2 outline-[#d4a537]";

export const TARGETABLE_CARD = "ring-1 ring-[#b83b3b]";

export const CARD_HEAD = "flex items-center gap-2 text-xs font-bold";

export const COLOR_DOT = "inline-block h-3 w-3 shrink-0 rounded-full";

export const STATS_LINE = "text-[11px] leading-4";

export const HP_TRACK = "h-1 w-full rounded bg-[#101820]";

export const HP_FILL = "h-1 rounded";

export const ACTION_BUTTON =
  "mt-1 rounded border border-[#8c6d46] bg-[#2b241d] px-2 py-0.5 text-[11px] text-[#e8dcc8] transition hover:bg-[#d4a537] hover:text-[#2b241d]";

export const FOOT = "mt-1 flex flex-col gap-1";

export const LOG_LINE = "truncate text-[10px] opacity-80";

export const HINT = "text-[10px] opacity-80";
