import type { LogTone } from "../hudHelpers";
import { getRecentLog, logTone } from "../hudHelpers";
import { LOG_TEXT, PANEL_TITLE } from "../uiTokens";
import { DOCK_PANEL } from "./hudTheme";

const LOG_LIMIT = 5;

const LIST = `mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto ${LOG_TEXT}`;

/**
 * Encres du journal (spec §1.4) : le joueur en `ink-1`, l'ennemi en
 * `ink-danger` (4.72:1) et le système en `ink-3` (4.51:1). L'ancien
 * `#8C6D46` système ne pesait que 2.55:1 sur `surface-2`.
 */
const TONE_CLASS: Record<LogTone, string> = {
  player: "text-[var(--color-ink-1)]",
  enemy: "text-[var(--color-ink-danger)]",
  system: "text-[var(--color-ink-3)]",
};

interface LogEntryProps {
  line: string;
  playerName: string;
}

interface LogLinesProps {
  entries: readonly string[];
  playerName: string;
}

interface LogPanelProps {
  log: readonly string[];
  playerName: string;
}

function LogEntry({ line, playerName }: LogEntryProps) {
  return <li className={TONE_CLASS[logTone(line, playerName)]}>{line}</li>;
}

function LogLines({ entries, playerName }: LogLinesProps) {
  return (
    <ol className={LIST}>
      {entries.map((line, index) => <LogEntry key={`${index}-${line}`} line={line} playerName={playerName} />)}
    </ol>
  );
}

/** Journal du dock : les cinq dernières lignes, colorées par locuteur. */
export default function CombatLogPanel({ log, playerName }: LogPanelProps) {
  const recent = getRecentLog(log, LOG_LIMIT);
  return (
    <section aria-label="Journal de combat" className={DOCK_PANEL}>
      <h2 className={PANEL_TITLE}>Journal</h2>
      <LogLines entries={recent} playerName={playerName} />
    </section>
  );
}
