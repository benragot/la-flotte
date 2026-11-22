import BackpackList from "./BackpackList";
import ConsumableBar from "./ConsumableBar";
import EquipmentSlots from "./EquipmentSlots";
import SaveControls from "./SaveControls";
import SetBonusPanel from "./SetBonusPanel";
import StatSummary from "./StatSummary";
import { COLUMN, COLUMNS, HEADING, PANEL, ROW, SMALL_BUTTON } from "./inventoryTheme";

export interface InventoryPanelProps {
  onClose?: (() => void) | undefined;
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

/** Gauche : équipement, stats et panoplies. Droite : sac, remontants, sauvegarde. */
function PanelColumns() {
  return (
    <div className={COLUMNS}>
      <div className={COLUMN}><EquipmentSlots /><StatSummary /><SetBonusPanel /></div>
      <div className={COLUMN}><BackpackList /><ConsumableBar /><SaveControls /></div>
    </div>
  );
}

/** Panneau d'inventaire autonome : lit le store, aucune prop obligatoire. */
export default function InventoryPanel({ onClose }: InventoryPanelProps) {
  return (
    <section aria-label="Inventaire" className={PANEL}>
      <PanelHeader onClose={onClose} />
      <PanelColumns />
    </section>
  );
}
