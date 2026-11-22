import type { ItemLike } from "../../../engine/inventory";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import { canUseConsumable, invokableConsumables } from "../../inventoryHudHelpers";
import type { ItemSelectionProps } from "./itemSelection";
import { HEADING, ITEM_BUTTON, ITEM_ROW, ITEM_ROW_SELECTED, LIST, SMALL_BUTTON } from "./inventoryTheme";

function DrinkButton({ item }: { item: ItemLike }) {
  const hero = useGameStore((state) => state.hero);
  const drink = useGameStore((state) => state.drinkConsumable);
  const canDrink = canUseConsumable({ item, hero });
  return (
    <button type="button" disabled={!canDrink} className={SMALL_BUTTON} onClick={() => drink({ itemId: item.id })}>Boire</button>
  );
}

export interface ConsumableRowProps extends ItemSelectionProps {
  item: ItemLike;
}

/** Ligne de remontant : bouton de sélection (`aria-pressed`) + action de soin. */
export function ConsumableRow({ item, selected, onSelect }: ConsumableRowProps) {
  const isSelected = item.id === selected;
  return (
    <li className={isSelected ? ITEM_ROW_SELECTED : ITEM_ROW}>
      <button type="button" aria-pressed={isSelected} className={ITEM_BUTTON} onClick={() => onSelect(item.id)}>{item.name}</button>
      <DrinkButton item={item} />
    </li>
  );
}

function ConsumableRows({ items, selected, onSelect }: { items: readonly ItemLike[] } & ItemSelectionProps) {
  return items.map((item) => (
    <ConsumableRow key={item.id} item={item} selected={selected} onSelect={onSelect} />
  ));
}

function ConsumableList({ items, selected, onSelect }: { items: readonly ItemLike[] } & ItemSelectionProps) {
  if (items.length === 0) return <p className="text-[10px] opacity-60">Aucun remontant.</p>;
  return (
    <ul aria-label="Remontants" className={LIST}>
      <ConsumableRows items={items} selected={selected} onSelect={onSelect} />
    </ul>
  );
}

/** Remontants possédés : le soin est désactivé à PV pleins. */
export default function ConsumableBar({ selected, onSelect }: ItemSelectionProps) {
  const inventory = useGameStore((state) => state.inventory);
  const items = invokableConsumables({ inventory, items: GAME_CATALOG.items });
  return (
    <section aria-label="Consommables" className="flex flex-col gap-1">
      <h3 className={HEADING}>Consommables</h3>
      <ConsumableList items={items} selected={selected} onSelect={onSelect} />
    </section>
  );
}
