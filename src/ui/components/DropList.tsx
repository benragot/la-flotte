export default function DropList({ drops }: { drops: readonly string[] }) {
  if (drops.length === 0) return <p className="text-xs text-slate-400">Aucun butin.</p>;
  return (
    <ul className="text-xs">
      {drops.map((drop) => <li key={drop}>Butin : {drop}</li>)}
    </ul>
  );
}
