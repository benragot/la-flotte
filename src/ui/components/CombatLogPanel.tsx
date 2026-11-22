import type { LogTone } from "../hudHelpers";
import { getRecentLog, logTone } from "../hudHelpers";
import { DOCK_PANEL, SECTION_HEADING } from "./hudTheme";

const LOG_LIMIT = 5;

const LIST = "mt-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto text-[11px] leading-4";

const TONE_CLASS: Record<LogTone, string> = {
  player: "text-[#e8dcc8]",
  enemy: "text-[#b83b3b]",
  system: "text-[#8c6d46]",
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
      <h2 className={SECTION_HEADING}>Journal</h2>
      <LogLines entries={recent} playerName={playerName} />
    </section>
  );
}
