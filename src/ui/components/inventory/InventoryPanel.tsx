import { useState } from "react";
import type { KeyboardEvent } from "react";
import BackpackList from "./BackpackList";
import ConsumableBar from "./ConsumableBar";
import EquipmentSlots from "./EquipmentSlots";
import ItemDetailPanel from "./ItemDetailPanel";
import type { ItemSelectionProps } from "./itemSelection";
import { nextSelection, selectionAfterKey } from "./itemSelection";
import SaveControls from "./SaveControls";
import SetBonusPanel from "./SetBonusPanel";
import StatSummary from "./StatSummary";
import { COLUMN, COLUMNS, HEADING, PANEL, ROW, SMALL_BUTTON } from "./inventoryTheme";

export interface InventoryPanelProps {
  onClose?: (() => void) | undefined;
}

interface ItemSelection extends ItemSelectionProps {
  onClear: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

/** Le clic bascule (re-clic = fermeture), Échap referme depuis n'importe quel objet focusé. */
function useItemSelection(): ItemSelection {
  const [selected, setSelected] = useState<string | null>(null);
  const onSelect = (itemId: string) => setSelected((current) => nextSelection(current, { type: "toggle", itemId }));
  const onClear = () => setSelected((current) => nextSelection(current, { type: "escape" }));
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => setSelected((current) => selectionAfterKey(current, event.key));
  return { selected, onSelect, onClear, onKeyDown };
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return <button type="button" onClick={onClose} className={SMALL_BUTTON}>Fermer</button>;
}

function PanelHeader({ onClose }: InventoryPanelProps) {
  return (
    <header className={ROW}>
      <h2 className={HEADING}>Inventaire</h2>
      {onClose === undefined ? null : <CloseButton onClose={onClose} />}
    </header>
  );
}

/** Gauche : équipement (inspectable), stats et panoplies. */
function LeftColumn({ selected, onSelect }: ItemSelectionProps) {
  return (
    <div className={COLUMN}><EquipmentSlots selected={selected} onSelect={onSelect} /><StatSummary /><SetBonusPanel /></div>
  );
}

/** Droite : sac, remontants, sauvegarde. */
function RightColumn({ selected, onSelect }: ItemSelectionProps) {
  return (
    <div className={COLUMN}>
      <BackpackList selected={selected} onSelect={onSelect} />
      <ConsumableBar selected={selected} onSelect={onSelect} />
      <SaveControls />
    </div>
  );
}

function PanelColumns(props: ItemSelectionProps) {
  return (
    <div className={COLUMNS}>
      <LeftColumn selected={props.selected} onSelect={props.onSelect} />
      <RightColumn {...props} />
    </div>
  );
}

/** Panneau d'inventaire autonome : lit le store, aucune prop obligatoire. */
export default function InventoryPanel({ onClose }: InventoryPanelProps) {
  const selection = useItemSelection();
  return (
    <section aria-label="Inventaire" className={PANEL} onKeyDown={selection.onKeyDown}>
      <PanelHeader onClose={onClose} />
      <PanelColumns selected={selection.selected} onSelect={selection.onSelect} />
      <ItemDetailPanel itemId={selection.selected} onClear={selection.onClear} />
    </section>
  );
}
