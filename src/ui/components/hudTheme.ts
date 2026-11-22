/**
 * Jetons visuels partagés du HUD rétro Dofus 1.29.
 *
 * Les valeurs hexadécimales sont écrites en clair dans les classes Tailwind
 * arbitraires : Tailwind ne génère du CSS qu'à partir de littéraux présents
 * dans les sources, jamais depuis une chaîne interpolée. `HUD_COLORS`
 * (`../hudHelpers`) reste la référence documentée de la palette.
 */
export const DOCK_PANEL =
  "pointer-events-auto flex h-full min-w-0 flex-col rounded border border-[#8c6d46] bg-[#3d342a] px-2 py-1 text-[#e8dcc8]";

export const SECTION_HEADING =
  "text-[10px] font-semibold uppercase tracking-widest text-[#d4a537]";

/** Feuille centrée des panneaux superposés (fiche perso, grimoire) : aucun style neuf. */
export const OVERLAY_SHEET =
  "flex max-h-full w-full max-w-xl flex-col gap-2 overflow-auto rounded border-2 border-[#8c6d46] bg-[#2b241d] p-3 text-[#e8dcc8]";

export const PRIMARY_BUTTON =
  "rounded border-2 border-[#8c6d46] bg-[#d4a537] px-4 py-2 text-sm font-bold text-[#2b241d] transition hover:bg-[#e8dcc8] disabled:opacity-40";
