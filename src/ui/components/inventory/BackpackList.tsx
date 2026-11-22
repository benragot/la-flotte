import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { BackpackEntry } from "../../inventoryHudHelpers";
import { backpackItems } from "../../inventoryHudHelpers";
import type { ItemSelectionProps } from "./itemSelection";
import {
  HEADING,
  ITEM_BUTTON,
  ITEM_ROW,
  ITEM_ROW_SELECTED,
  LIST,
  SMALL_BUTTON,
} from "./inventoryTheme";

function EquipButton({ itemId }: { itemId: string }) {
  const equip = useGameStore((state) => state.equip);
  return <button type="button" className={SMALL_BUTTON} onClick={() => equip({ itemId })}>Équiper</button>;
}

/** Seuls les équipements portent une action ; le reste du sac est informatif. */
function BagAction({ entry }: { entry: BackpackEntry }) {
  if (entry.category !== "equipment") return null;
  return <EquipButton itemId={entry.itemId} />;
}

export interface BagRowProps {
  entry: BackpackEntry;
  selected: boolean;
  onSelect: (itemId: string) => void;
}

/** Ligne d'objet : bouton focusable (Tab + Entrée) marqué `aria-selected` si ouverte. */
export function BagRow({ entry, selected, onSelect }: BagRowProps) {
  return (
    <li role="option" aria-selected={selected} className={selected ? ITEM_ROW_SELECTED : ITEM_ROW}>
      <button type="button" className={ITEM_BUTTON} onClick={() => onSelect(entry.itemId)}>
        {entry.name} ×{entry.quantity}
      </button>
      <BagAction entry={entry} />
    </li>
  );
}

function BagRows({ entries, selected, onSelect }: { entries: readonly BackpackEntry[] } & ItemSelectionProps) {
  return entries.map((entry) => (
    <BagRow key={entry.itemId} entry={entry} selected={entry.itemId === selected} onSelect={onSelect} />
  ));
}

function BagList({ entries, selected, onSelect }: { entries: readonly BackpackEntry[] } & ItemSelectionProps) {
  if (entries.length === 0) return <p className="text-[10px] opacity-60">Sac vide.</p>;
  return (
    <ul role="listbox" aria-label="Objets du sac" className={LIST}>
      <BagRows entries={entries} selected={selected} onSelect={onSelect} />
    </ul>
  );
}

/** Sac du héros : piles connues, quantités et bouton d'équipement. */
export default function BackpackList({ selected, onSelect }: ItemSelectionProps) {
  const inventory = useGameStore((state) => state.inventory);
  const entries = backpackItems({ inventory, items: GAME_CATALOG.items });
  return (
    <section aria-label="Sac" className="flex min-h-0 flex-col gap-1">
      <h3 className={HEADING}>Sac</h3>
      <BagList entries={entries} selected={selected} onSelect={onSelect} />
    </section>
  );
}
