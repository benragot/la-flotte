/**
 * Butin de fin de combat : une ligne par objet, sans couleur d'accent.
 * `ink-3` est le plancher de lecture (§1.4) — plus de `text-slate-400` (I9).
 */
export default function DropList({ drops }: { drops: readonly string[] }) {
  if (drops.length === 0) return <p className="text-[11px] leading-4 text-[var(--color-ink-3)]">Aucun butin.</p>;
  return (
    <ul className="text-[11px] leading-4 text-[var(--color-ink-2)]">
      {drops.map((drop) => <li key={drop}>Butin : {drop}</li>)}
    </ul>
  );
}
