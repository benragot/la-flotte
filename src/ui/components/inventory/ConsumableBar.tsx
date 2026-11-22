import type { ItemLike } from "../../../engine/inventory";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import { canUseConsumable, invokableConsumables } from "../../inventoryHudHelpers";
import { HEADING, LIST, ROW, SMALL_BUTTON } from "./inventoryTheme";

function DrinkButton({ item }: { item: ItemLike }) {
  const hero = useGameStore((state) => state.hero);
  const drink = useGameStore((state) => state.drinkConsumable);
  const canDrink = canUseConsumable({ item, hero });
  return (
    <button type="button" disabled={!canDrink} className={SMALL_BUTTON} onClick={() => drink({ itemId: item.id })}>Boire</button>
  );
}

function ConsumableRow({ item }: { item: ItemLike }) {
  return (
    <li className={ROW}>
      <span className="min-w-0 truncate">{item.name}</span>
      <DrinkButton item={item} />
    </li>
  );
}

function ConsumableList({ items }: { items: readonly ItemLike[] }) {
  if (items.length === 0) return <p className="text-[10px] opacity-60">Aucun remontant.</p>;
  return <ul className={LIST}>{items.map((item) => <ConsumableRow key={item.id} item={item} />)}</ul>;
}

/** Remontants possédés : le soin est désactivé à PV pleins. */
export default function ConsumableBar() {
  const inventory = useGameStore((state) => state.inventory);
  const items = invokableConsumables({ inventory, items: GAME_CATALOG.items });
  return (
    <section aria-label="Consommables" className="flex flex-col gap-1">
      <h3 className={HEADING}>Consommables</h3>
      <ConsumableList items={items} />
    </section>
  );
}
