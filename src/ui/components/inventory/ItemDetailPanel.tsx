import type { ItemDef } from "../../../schemas/itemSchema";
import { GAME_CATALOG } from "../../../store/useGameStore";
import type { ItemDetailRow, ItemDetailSet, ItemDetailView } from "./itemDetailView";
import { itemDetailView } from "./itemDetailView";
import {
  CHIP,
  DETAIL_DESCRIPTION,
  DETAIL_HINT,
  DETAIL_META,
  DETAIL_PANEL,
  HEADING,
  ROW,
  SMALL_BUTTON,
} from "./inventoryTheme";

/** Le store type son catalogue en `ItemLike` : à l'exécution ce sont les `ItemDef` parsés. */
const CATALOG_ITEMS = GAME_CATALOG.items as readonly ItemDef[];
const DETAIL_CONTEXT = { sets: GAME_CATALOG.sets };

export interface ItemDetailPanelProps {
  itemId: string | null;
  onClear: () => void;
}

function DetailHint() {
  return <p className={DETAIL_HINT}>Sélectionne un objet pour voir ses caractéristiques</p>;
}

function RowChip({ row }: { row: ItemDetailRow }) {
  return <li className={CHIP}>{row.label} <strong>{row.value}</strong></li>;
}

/** Section rendue uniquement si elle a du contenu : jamais de titre orphelin. */
function RowGroup({ title, rows }: { title: string; rows: readonly ItemDetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <h4 className={HEADING}>{title}</h4>
      <ul className={ROW}>{rows.map((row) => <RowChip key={row.key} row={row} />)}</ul>
    </div>
  );
}

function metaParts(view: ItemDetailView): string[] {
  const level = view.level === null ? null : `Niveau ${view.level}`;
  return [view.category, view.slot, level].filter((part): part is string => part !== null);
}

function MetaLine({ view }: { view: ItemDetailView }) {
  return <p className={DETAIL_META}>{metaParts(view).join(" · ")}</p>;
}

function SetLine({ set }: { set: ItemDetailSet | null }) {
  if (set === null) return null;
  return <p className={DETAIL_META}>Panoplie : {set.name} · {set.pieces} pièces</p>;
}

function PriceLine({ sellPrice, buyPrice }: { sellPrice: number; buyPrice: number | null }) {
  return (
    <p className={DETAIL_META}>
      Prix de vente : {sellPrice}
      {buyPrice === null ? null : <> · Prix d'achat : {buyPrice}</>}
    </p>
  );
}

function DetailHead({ view }: { view: ItemDetailView }) {
  return (
    <header className="flex items-baseline gap-2">
      <h3 className="text-[12px] font-bold text-[#d4a537]">{view.title}</h3>
      <span className={DETAIL_META}>{view.id}</span>
    </header>
  );
}

function DetailFooter({ view }: { view: ItemDetailView }) {
  return (
    <>
      <SetLine set={view.set} />
      <PriceLine sellPrice={view.sellPrice} buyPrice={view.buyPrice} />
    </>
  );
}

function DetailFacts({ view }: { view: ItemDetailView }) {
  return (
    <>
      <RowGroup title="Caractéristiques" rows={view.rows} />
      <RowGroup title="Résistances" rows={view.resistances} />
      <RowGroup title="Effets" rows={view.effects} />
      <DetailFooter view={view} />
    </>
  );
}

/** Corps pur de la fiche : props seulement, testable via `react-dom/server`. */
export function ItemDetailBody({ view }: { view: ItemDetailView }) {
  return (
    <div className="flex flex-col gap-1">
      <DetailHead view={view} />
      <MetaLine view={view} />
      <DetailFacts view={view} />
      <p className={DETAIL_DESCRIPTION}>{view.description}</p>
    </div>
  );
}

function itemOf(itemId: string | null): ItemDef | undefined {
  if (itemId === null) return undefined;
  return CATALOG_ITEMS.find((item) => item.id === itemId);
}

function CloseDetailButton({ onClear }: { onClear: () => void }) {
  return (
    <button type="button" className={`${SMALL_BUTTON} self-end`} onClick={onClear}>
      Fermer le détail
    </button>
  );
}

function DetailContent({ itemId, onClear }: ItemDetailPanelProps) {
  const item = itemOf(itemId);
  if (item === undefined) return <DetailHint />;
  return (
    <>
      <ItemDetailBody view={itemDetailView(item, DETAIL_CONTEXT)} />
      <CloseDetailButton onClear={onClear} />
    </>
  );
}

/**
 * Panneau en bas de l'inventaire. Région `aria-live="polite"` nommée :
 * l'ouverture est annoncée sans voler le focus de la liste en cours de
 * navigation clavier (le clavier reste sur l'objet, `Échap` referme).
 */
export default function ItemDetailPanel({ itemId, onClear }: ItemDetailPanelProps) {
  return (
    <section aria-label="Détail de l’objet" aria-live="polite" className={DETAIL_PANEL}>
      <DetailContent itemId={itemId} onClear={onClear} />
    </section>
  );
}
