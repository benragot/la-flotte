import type { Hero } from "../../../engine/createHero";
import type { InventoryState, ItemLike, SetLike, StatBlock } from "../../../engine/inventory";
import { computeTotalStats } from "../../../engine/inventory";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { StatLine } from "../../inventoryHudHelpers";
import { buildStatLines, effectiveProspection, statApplicationStatus } from "../../inventoryHudHelpers";
import { effectiveHp } from "../../hudHp";
import StatBadge from "./StatBadge";
import { HEADING, ROW } from "./inventoryTheme";

export interface HeroStatsViewInput {
  hero: Hero;
  inventory: InventoryState;
  items: readonly ItemLike[];
  sets: readonly SetLike[];
}

/** Base du héros : stats de capital et ressources, sans PP ni PV effectifs. */
function heroBase(hero: Hero): StatBlock {
  const stats = { vitality: hero.vitality, wisdom: hero.wisdom, strength: hero.strength, intelligence: hero.intelligence, chance: hero.chance, agility: hero.agility };
  return { ...stats, ap: hero.ap, mp: hero.mp };
}

/**
 * Total items + panoplies de l'inventaire. Les PV viennent du domaine effectif
 * (`effectiveHp`), la PP de `computeProspection` (D46).
 */
export function heroStatsView(input: HeroStatsViewInput): StatBlock {
  const { hero, inventory, items, sets } = input;
  const total = computeTotalStats({ base: heroBase(hero), capital: {}, inventory, items, sets });
  const hp = effectiveHp(input).maxHp;
  return { ...total, hp, prospection: effectiveProspection({ basePp: hero.pp, total }) };
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
  return heroStatsView({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}

/** Total base + items + panoplies, PV effectifs et PP effective, stats inertes annotées. */
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
