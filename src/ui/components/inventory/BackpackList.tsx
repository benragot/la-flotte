import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { BackpackEntry } from "../../inventoryHudHelpers";
import { backpackItems, bagEquipHints } from "../../inventoryHudHelpers";
import type { ItemSelectionProps } from "./itemSelection";
import {
  EMPTY_HINT,
  HEADING,
  ITEM_BUTTON,
  ITEM_ROW,
  ITEM_ROW_SELECTED,
  LIST,
  ROW,
  SMALL_BUTTON,
  TEXT_KO,
} from "./inventoryTheme";

/** Raison lisible du refus, affichée à côté du bouton (badge rouge). */
function EquipHint({ id, hint }: { id: string; hint: string | null }) {
  if (hint === null) return null;
  return <span id={id} className={TEXT_KO}>{hint}</span>;
}

interface EquipTriggerProps {
  hint: string | null;
  hintId: string;
  onClick: () => void;
}

/** `title` n'est pas fiable sur un bouton `disabled` : le badge est lié par `aria-describedby`. */
function EquipTrigger({ hint, hintId, onClick }: EquipTriggerProps) {
  const describedBy = hint === null ? undefined : hintId;
  return (
    <button type="button" className={SMALL_BUTTON} disabled={hint !== null} title={hint ?? undefined} aria-describedby={describedBy} onClick={onClick}>Équiper</button>
  );
}

function EquipButton({ itemId, hint }: { itemId: string; hint: string | null }) {
  const equip = useGameStore((state) => state.equip);
  const hintId = `equip-hint-${itemId}`;
  return (
    <span className={ROW}>
      <EquipHint id={hintId} hint={hint} />
      <EquipTrigger hint={hint} hintId={hintId} onClick={() => equip({ itemId })} />
    </span>
  );
}

/** Seuls les équipements portent une action ; le reste du sac est informatif. */
function BagAction({ entry, hint }: { entry: BackpackEntry; hint: string | null }) {
  if (entry.category !== "equipment") return null;
  return <EquipButton itemId={entry.itemId} hint={hint} />;
}

export interface BagRowProps {
  entry: BackpackEntry;
  selected: boolean;
  onSelect: (itemId: string) => void;
  /** Refus explicité par le moteur ; `null`/absent quand l'objet est équipable. */
  hint?: string | null;
}

/** Ligne d'objet : bouton focusable (Tab + Entrée) qui porte `aria-pressed` quand ouverte. */
export function BagRow({ entry, selected, onSelect, hint = null }: BagRowProps) {
  return (
    <li className={selected ? ITEM_ROW_SELECTED : ITEM_ROW}>
      <button type="button" aria-pressed={selected} className={ITEM_BUTTON} onClick={() => onSelect(entry.itemId)}>
        {entry.name} ×{entry.quantity}
      </button>
      <BagAction entry={entry} hint={hint} />
    </li>
  );
}

export interface BagRowsProps extends ItemSelectionProps {
  entries: readonly BackpackEntry[];
  hints: Record<string, string>;
}

function BagRows({ entries, selected, onSelect, hints }: BagRowsProps) {
  const propsOf = (entry: BackpackEntry) => ({ entry, selected: entry.itemId === selected, onSelect, hint: hints[entry.itemId] ?? null });
  return entries.map((entry) => <BagRow key={entry.itemId} {...propsOf(entry)} />);
}

function BagList({ entries, selected, onSelect, hints }: BagRowsProps) {
  if (entries.length === 0) return <p className={EMPTY_HINT}>Sac vide.</p>;
  return (
    <ul aria-label="Objets du sac" className={LIST}>
      <BagRows entries={entries} selected={selected} onSelect={onSelect} hints={hints} />
    </ul>
  );
}

/** Sac + raisons de refus, lus une fois pour toutes les lignes. */
function useBagContent(): { entries: readonly BackpackEntry[]; hints: Record<string, string> } {
  const inventory = useGameStore((state) => state.inventory);
  const heroLevel = useGameStore((state) => state.hero?.level ?? 1);
  const entries = backpackItems({ inventory, items: GAME_CATALOG.items });
  const hints = bagEquipHints({ inventory, items: GAME_CATALOG.items, heroLevel });
  return { entries, hints };
}

/** Sac du héros : piles connues, quantités, bouton d'équipement et raison d'un refus. */
export default function BackpackList({ selected, onSelect }: ItemSelectionProps) {
  const { entries, hints } = useBagContent();
  return (
    <section aria-label="Sac" className="flex min-h-0 flex-col gap-1">
      <h3 className={HEADING}>Sac</h3>
      <BagList entries={entries} selected={selected} onSelect={onSelect} hints={hints} />
    </section>
  );
}
