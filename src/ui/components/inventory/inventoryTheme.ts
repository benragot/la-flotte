import { DOCK_PANEL, SECTION_HEADING } from "../hudTheme";

/**
 * Jetons visuels du panneau d'inventaire. Les teintes hexadécimales sont les
 * mêmes que `HUD_COLORS` (`../../hudHelpers`), écrites en littéral pour que
 * Tailwind les génère : la palette 1.29 reste la référence documentée.
 */
export const PANEL = `${DOCK_PANEL} gap-2`;

export const HEADING = SECTION_HEADING;

export const ROW = "flex flex-wrap items-center gap-1";

export const LIST = "flex min-h-0 flex-col gap-1 overflow-y-auto text-[11px]";

export const COLUMNS = "grid min-h-0 flex-1 grid-cols-2 gap-2";

export const COLUMN = "flex min-w-0 flex-col gap-1";

export const SLOT_GRID = "grid grid-cols-2 gap-1";

const SLOT_TILE =
  "flex flex-col items-start rounded border px-1 py-0.5 text-left text-[10px] leading-3 transition";

export const SLOT_FILLED = `${SLOT_TILE} border-[#d4a537]/70 bg-[#2b241d] text-[#e8dcc8] hover:border-[#d4a537]`;

export const SLOT_EMPTY = `${SLOT_TILE} border-dashed border-[#8c6d46]/50 bg-[#2b241d]/40 text-[#e8dcc8]/50`;

export const SMALL_BUTTON =
  "rounded border border-[#8c6d46] bg-[#2b241d] px-2 py-0.5 text-[10px] font-bold text-[#e8dcc8] transition hover:border-[#d4a537] disabled:opacity-40";

export const CHIP = "rounded border px-1 py-0.5 text-[10px] leading-3";

export const TEXT_GOLD = "border-[#d4a537]/70 bg-[#d4a537]/10 text-[#d4a537]";

export const TEXT_MUTED = "border-[#8c6d46]/40 bg-[#2b241d]/50 text-[#e8dcc8]/50";

/** Statistique affichée mais inerte en combat (D45). */
export const TEXT_PENDING =
  "border-[#8c6d46]/30 bg-[#2b241d]/40 text-[#e8dcc8]/40 line-through decoration-dotted";

export const TEXT_OK = "text-[#4a8c4a]";

export const TEXT_KO = "text-[#b83b3b]";

export const FIELD =
  "h-12 w-full resize-none rounded border border-[#8c6d46] bg-[#2b241d] p-1 text-[10px] text-[#e8dcc8]";
