import { getRecentLog } from "../hudHelpers";

const LOG_LIMIT = 5;

function LogLines({ entries }: { entries: readonly string[] }) {
  return (
    <ol className="max-h-24 overflow-y-auto text-xs leading-5">
      {entries.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}
    </ol>
  );
}

export default function CombatLogPanel({ log }: { log: readonly string[] }) {
  const recent = getRecentLog(log, LOG_LIMIT);
  return (
    <section aria-label="Journal de combat" className="pointer-events-auto rounded border border-slate-700/60 bg-slate-900/85 px-3 py-2 text-slate-100">
      <h2 className="text-xs uppercase tracking-widest text-slate-400">Journal</h2>
      <LogLines entries={recent} />
    </section>
  );
}
