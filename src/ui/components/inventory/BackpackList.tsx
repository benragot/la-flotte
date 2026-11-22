import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { BackpackEntry } from "../../inventoryHudHelpers";
import { backpackItems } from "../../inventoryHudHelpers";
import { HEADING, LIST, ROW, SMALL_BUTTON } from "./inventoryTheme";

function EquipButton({ itemId }: { itemId: string }) {
  const equip = useGameStore((state) => state.equip);
  return <button type="button" className={SMALL_BUTTON} onClick={() => equip({ itemId })}>Équiper</button>;
}

/** Seuls les équipements portent une action ; le reste du sac est informatif. */
function BagAction({ entry }: { entry: BackpackEntry }) {
  if (entry.category !== "equipment") return null;
  return <EquipButton itemId={entry.itemId} />;
}

function BagRow({ entry }: { entry: BackpackEntry }) {
  return (
    <li className={ROW}>
      <span className="min-w-0 truncate">{entry.name} ×{entry.quantity}</span>
      <BagAction entry={entry} />
    </li>
  );
}

function BagList({ entries }: { entries: readonly BackpackEntry[] }) {
  if (entries.length === 0) return <p className="text-[10px] opacity-60">Sac vide.</p>;
  return <ul className={LIST}>{entries.map((entry) => <BagRow key={entry.itemId} entry={entry} />)}</ul>;
}

/** Sac du héros : piles connues, quantités et bouton d'équipement. */
export default function BackpackList() {
  const inventory = useGameStore((state) => state.inventory);
  const entries = backpackItems({ inventory, items: GAME_CATALOG.items });
  return (
    <section aria-label="Sac" className="flex min-h-0 flex-col gap-1">
      <h3 className={HEADING}>Sac</h3>
      <BagList entries={entries} />
    </section>
  );
}
