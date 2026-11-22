import type { Hero } from "../../../engine/createHero";
import type { InventoryState, StatBlock } from "../../../engine/inventory";
import { computeTotalStats } from "../../../engine/inventory";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import { buildStatLines } from "../../inventoryHudHelpers";
import StatBadge from "./StatBadge";
import { HEADING, ROW } from "./inventoryTheme";

/** Base du héros : stats de capital + ressources (aucun point temporaire). */
function heroBase(hero: Hero): StatBlock {
  const stats = { vitality: hero.vitality, wisdom: hero.wisdom, strength: hero.strength, intelligence: hero.intelligence, chance: hero.chance, agility: hero.agility };
  return { ...stats, hp: hero.maxHp, ap: hero.ap, mp: hero.mp, prospection: hero.pp };
}

function totalFor(hero: Hero, inventory: InventoryState): StatBlock {
  const options = { base: heroBase(hero), capital: {}, inventory };
  return computeTotalStats({ ...options, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}

function StatList({ total }: { total: StatBlock }) {
  return (
    <ul className={ROW}>
      {buildStatLines(total).map((line) => <li key={line.key}><StatBadge label={line.label} value={line.value} /></li>)}
    </ul>
  );
}

function useHeroStats(): StatBlock | null {
  const hero = useGameStore((state) => state.hero);
  const inventory = useGameStore((state) => state.inventory);
  if (hero === null) return null;
  return totalFor(hero, inventory);
}

/** Total base + items équipés + bonus de panoplie active. */
export default function StatSummary() {
  const total = useHeroStats();
  if (total === null) return null;
  return (
    <section aria-label="Statistiques du héros" className="flex flex-col gap-1">
      <h3 className={HEADING}>Statistiques</h3>
      <StatList total={total} />
    </section>
  );
}
