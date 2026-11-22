import type { Hero } from "../../../engine/createHero";
import type { InventoryState, StatBlock } from "../../../engine/inventory";
import { computeTotalStats } from "../../../engine/inventory";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { StatLine } from "../../inventoryHudHelpers";
import { buildStatLines, effectiveProspection, statApplicationStatus } from "../../inventoryHudHelpers";
import StatBadge from "./StatBadge";
import { HEADING, ROW } from "./inventoryTheme";

/** Base du héros : stats de capital et ressources, sans PP (calculée à part). */
function heroBase(hero: Hero): StatBlock {
  const stats = { vitality: hero.vitality, wisdom: hero.wisdom, strength: hero.strength, intelligence: hero.intelligence, chance: hero.chance, agility: hero.agility };
  return { ...stats, hp: hero.maxHp, ap: hero.ap, mp: hero.mp };
}

/** Total items + panoplies, puis PP effective via `computeProspection` (D46). */
function totalWithProspection(hero: Hero, inventory: InventoryState): StatBlock {
  const total = computeTotalStats({ base: heroBase(hero), capital: {}, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
  return { ...total, prospection: effectiveProspection({ basePp: hero.pp, total }) };
}

function StatRow({ line }: { line: StatLine }) {
  const pending = statApplicationStatus(line.key) === "pending";
  return <li><StatBadge label={line.label} value={line.value} pending={pending} /></li>;
}

function StatList({ total }: { total: StatBlock }) {
  return (
    <ul className={ROW}>
      {buildStatLines(total).map((line) => <StatRow key={line.key} line={line} />)}
    </ul>
  );
}

function useHeroStats(): StatBlock | null {
  const hero = useGameStore((state) => state.hero);
  const inventory = useGameStore((state) => state.inventory);
  if (hero === null) return null;
  return totalWithProspection(hero, inventory);
}

/** Total base + items + panoplies, PP effective incluse, stats inertes annotées. */
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
