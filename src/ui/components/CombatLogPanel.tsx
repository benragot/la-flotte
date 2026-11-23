import type { SpellDef } from "../../schemas/spellSchema";
import type { LogTone } from "../hudHelpers";
import { getRecentLog, logTone } from "../hudHelpers";
import type { ElementTone, LogLook } from "../logElements";
import { logLook } from "../logElements";
import { LOG_BAND, LOG_GLYPH, LOG_TEXT, PANEL_TITLE } from "../uiTokens";
import { ELEMENT_BAND, ELEMENT_INK } from "./elementInk";
import { DOCK_PANEL } from "./hudTheme";

const LOG_LIMIT = 5;

const LIST = `mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto ${LOG_TEXT}`;

/**
 * Repli par locuteur (spec §1.4) : le joueur en `ink-1`, l'ennemi en
 * `ink-danger` (4.72:1) et le système en `ink-3` (4.51:1) quand la ligne ne
 * porte aucun élément.
 */
const SPEAKER_INK: Readonly<Record<LogTone, string>> = {
  player: "text-[var(--color-ink-1)]",
  enemy: "text-[var(--color-ink-danger)]",
  system: "text-[var(--color-ink-3)]",
};

interface LogEntryProps {
  line: string;
  playerName: string;
  spells: Record<string, SpellDef>;
}

interface LogLinesProps {
  entries: readonly string[];
  playerName: string;
  spells: Record<string, SpellDef>;
}

interface LogPanelProps {
  log: readonly string[];
  playerName: string;
  spells: Record<string, SpellDef>;
}

/** Encre de la ligne : celle de l'élément, sinon celle du locuteur. */
function inkOf(tone: ElementTone, speaker: LogTone): string {
  return tone === "neutre" ? SPEAKER_INK[speaker] : ELEMENT_INK[tone];
}

/**
 * Une ligne : bandeau de couleur, glyphe, texte. Le glyphe **double** toujours
 * la teinte (deutéranopie) et la ligne garde son texte intégral.
 */
function LogRow({ line, ink, look }: { line: string; ink: string; look: LogLook }) {
  const title = look.label === "" ? undefined : look.label;
  return (
    <li className={`flex items-stretch gap-1.5 ${ink}`} title={title}>
      <span className={`${LOG_BAND} ${ELEMENT_BAND[look.tone]}`} />
      <span className={LOG_GLYPH} aria-hidden="true">{look.glyph}</span>
      <span className="min-w-0 flex-1 break-words">{line}</span>
    </li>
  );
}

function LogEntry({ line, playerName, spells }: LogEntryProps) {
  const speaker = logTone(line, playerName);
  const look = logLook(line, spells);
  return <LogRow line={line} ink={inkOf(look.tone, speaker)} look={look} />;
}

function LogLines({ entries, playerName, spells }: LogLinesProps) {
  return (
    <ol className={LIST}>
      {entries.map((line, index) => <LogEntry key={`${index}-${line}`} line={line} playerName={playerName} spells={spells} />)}
    </ol>
  );
}

/** Journal du dock : les cinq dernières lignes, teintées par élément. */
export default function CombatLogPanel({ log, playerName, spells }: LogPanelProps) {
  const recent = getRecentLog(log, LOG_LIMIT);
  return (
    <section aria-label="Journal de combat" className={DOCK_PANEL}>
      <h2 className={PANEL_TITLE}>Journal</h2>
      <LogLines entries={recent} playerName={playerName} spells={spells} />
    </section>
  );
}
