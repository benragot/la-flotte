import type { SetBonusTier, StatBlock } from "../../../engine/inventory";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import type { SetView, SetViewSet } from "../../inventoryHudHelpers";
import { buildSetViews, buildStatLines, formatStatValue } from "../../inventoryHudHelpers";
import { CHIP, HEADING, LIST, ROW, TEXT_GOLD, TEXT_MUTED } from "./inventoryTheme";

function tierSummary(stats: StatBlock): string {
  const lines = buildStatLines(stats).filter((line) => line.value !== 0);
  return lines.map((line) => `${line.label} ${formatStatValue(line.value)}`).join(" · ");
}

/** Palier doré s'il est atteint, grisé s'il reste à débloquer. */
function TierChip({ tier, isActive }: { tier: SetBonusTier; isActive: boolean }) {
  const tone = isActive ? TEXT_GOLD : TEXT_MUTED;
  return <li className={`${CHIP} ${tone}`}>{tier.pieces} pièces · {tierSummary(tier.stats)}</li>;
}

function tierChips(set: SetViewSet, view: SetView) {
  return set.bonuses.map((tier) => (
    <TierChip key={tier.pieces} tier={tier} isActive={view.activePieces.includes(tier.pieces)} />
  ));
}

function NextTierHint({ hint }: { hint: string | null }) {
  if (hint === null) return null;
  return <span className="text-[9px] opacity-60">{hint}</span>;
}

function nextTierHint(view: SetView): string | null {
  return view.nextTier === null ? null : `Prochain palier : ${view.nextTier} pièces`;
}

function SetHeadline({ view }: { view: SetView }) {
  return <p className="text-[11px] font-bold">{view.setName} — {view.pieces}/{view.totalPieces}</p>;
}

function setOf(view: SetView): SetViewSet | undefined {
  return GAME_CATALOG.sets.find((entry) => entry.id === view.setId);
}

function SetItem({ set, view }: { set: SetViewSet; view: SetView }) {
  return (
    <li className="flex flex-col gap-1">
      <SetHeadline view={view} />
      <ul className={ROW}>{tierChips(set, view)}</ul>
      <NextTierHint hint={nextTierHint(view)} />
    </li>
  );
}

function SetRow({ view }: { view: SetView }) {
  const set = setOf(view);
  if (set === undefined) return null;
  return <SetItem set={set} view={view} />;
}

function useSetViews(): SetView[] {
  const inventory = useGameStore((state) => state.inventory);
  const sets = GAME_CATALOG.sets;
  return buildSetViews({ inventory, items: GAME_CATALOG.items, sets });
}

/** Panoplies possédées : pièces équipées et paliers atteints. */
export default function SetBonusPanel() {
  const views = useSetViews();
  if (views.length === 0) return null;
  return (
    <section aria-label="Panoplies" className="flex flex-col gap-1">
      <h3 className={HEADING}>Panoplies</h3>
      <ul className={LIST}>{views.map((view) => <SetRow key={view.setId} view={view} />)}</ul>
    </section>
  );
}
