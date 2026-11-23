import type { EquipmentSlot, EquipmentState } from "../../../engine/inventory";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { SlotView } from "../../inventoryHudHelpers";
import { buildSlotViews } from "../../inventoryHudHelpers";
import type { ItemSelectionProps } from "./itemSelection";
import {
  HEADING,
  SLOT_ACTION,
  SLOT_EMPTY,
  SLOT_FILLED,
  SLOT_GRID,
  SLOT_LABEL,
  SLOT_SELECTED,
} from "./inventoryTheme";

export interface SlotTileProps {
  view: SlotView;
  itemId: string | null;
  selected: boolean;
  onSelect: (itemId: string) => void;
  onUnequip: () => void;
}

function slotClass(itemId: string | null, selected: boolean): string {
  if (itemId === null) return SLOT_EMPTY;
  return selected ? SLOT_SELECTED : SLOT_FILLED;
}

/** Affordance d'inspection : sélectionne le slot sans toucher à l'équipement. */
function DetailButton({ name, selected, onSelect }: { name: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" aria-pressed={selected} aria-label={`Détails de ${name}`} className={SLOT_ACTION} onClick={onSelect}>
      Détails
    </button>
  );
}

/** Affordance de retrait, distincte de l'inspection (sémantique `unequip` inchangée). */
function UnequipButton({ name, onUnequip }: { name: string; onUnequip: () => void }) {
  return (
    <button type="button" aria-label={`Déséquiper ${name}`} className={SLOT_ACTION} onClick={onUnequip}>×</button>
  );
}

function SlotActions({ view, itemId, selected, onSelect, onUnequip }: SlotTileProps) {
  if (itemId === null) return null;
  const name = view.itemName ?? "";
  return (
    <span className="flex w-full items-center justify-between gap-1">
      <DetailButton name={name} selected={selected} onSelect={() => onSelect(itemId)} />
      <UnequipButton name={name} onUnequip={onUnequip} />
    </span>
  );
}

/** Tuile pure (sans hook) : nom du slot, item porté, inspecter puis déséquiper. */
export function SlotTile({ view, itemId, selected, onSelect, onUnequip }: SlotTileProps) {
  return (
    <div className={slotClass(itemId, selected)}>
      <span className={SLOT_LABEL}>{view.label}</span>
      <strong>{view.itemName ?? "Vide"}</strong>
      <SlotActions view={view} itemId={itemId} selected={selected} onSelect={onSelect} onUnequip={onUnequip} />
    </div>
  );
}

interface SlotGridProps extends ItemSelectionProps {
  views: readonly SlotView[];
  equipment: EquipmentState;
  onUnequip: (input: { slot: EquipmentSlot }) => void;
}

function tileProps(view: SlotView, grid: SlotGridProps): SlotTileProps {
  const itemId = grid.equipment[view.slot] ?? null;
  return {
    view,
    itemId,
    selected: itemId !== null && itemId === grid.selected,
    onSelect: grid.onSelect,
    onUnequip: () => grid.onUnequip({ slot: view.slot }),
  };
}

function SlotGrid(props: SlotGridProps) {
  return (
    <div className={SLOT_GRID}>
      {props.views.map((view) => <SlotTile key={view.slot} {...tileProps(view, props)} />)}
    </div>
  );
}

function SlotsBody({ selected, onSelect }: ItemSelectionProps) {
  const inventory = useGameStore((state) => state.inventory);
  const onUnequip = useGameStore((state) => state.unequip);
  const views = buildSlotViews({ inventory, items: GAME_CATALOG.items });
  return (
    <SlotGrid views={views} equipment={inventory.equipment} selected={selected} onSelect={onSelect} onUnequip={onUnequip} />
  );
}

/** Grille des huit emplacements dans l'ordre canonique de `EQUIPMENT_SLOTS`. */
export default function EquipmentSlots({ selected, onSelect }: ItemSelectionProps) {
  return (
    <section aria-label="Équipement" className="flex flex-col gap-1">
      <h3 className={HEADING}>Équipement</h3>
      <SlotsBody selected={selected} onSelect={onSelect} />
    </section>
  );
}
