import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { SlotView } from "../../inventoryHudHelpers";
import { buildSlotViews } from "../../inventoryHudHelpers";
import { HEADING, SLOT_EMPTY, SLOT_FILLED, SLOT_GRID } from "./inventoryTheme";

function slotClass(view: SlotView): string {
  return view.itemName === null ? SLOT_EMPTY : SLOT_FILLED;
}

/** Un slot se déséquipe au clic ; l'équipement se fait depuis le sac. */
function SlotTile({ view }: { view: SlotView }) {
  const unequip = useGameStore((state) => state.unequip);
  const isEmpty = view.itemName === null;
  return (
    <button type="button" disabled={isEmpty} title={view.label} className={slotClass(view)} onClick={() => unequip({ slot: view.slot })}>
      <span className="opacity-70">{view.label}</span>
      <strong>{view.itemName ?? "Vide"}</strong>
    </button>
  );
}

function EquipmentBody({ views }: { views: readonly SlotView[] }) {
  return (
    <div className={SLOT_GRID}>
      {views.map((view) => <SlotTile key={view.slot} view={view} />)}
    </div>
  );
}

/** Grille des huit emplacements dans l'ordre canonique de `EQUIPMENT_SLOTS`. */
export default function EquipmentSlots() {
  const inventory = useGameStore((state) => state.inventory);
  const views = buildSlotViews({ inventory, items: GAME_CATALOG.items });
  return (
    <section aria-label="Équipement" className="flex flex-col gap-1">
      <h3 className={HEADING}>Équipement</h3>
      <EquipmentBody views={views} />
    </section>
  );
}
