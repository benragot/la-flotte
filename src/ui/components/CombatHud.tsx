import type { CombatRewards, CombatState } from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";
import CombatLogPanel from "./CombatLogPanel";
import EndOverlay from "./EndOverlay";
import EnemyPanel from "./EnemyPanel";
import HeroPanel from "./HeroPanel";
import SpellBar from "./SpellBar";
import TopBanner from "./TopBanner";
import TurnButton from "./TurnButton";

/**
 * Les gains affichés viennent de `state.rewards` (store) : `CombatState.rewards`
 * vaut `null` en V1, le moteur ne le réassigne jamais.
 */
interface HudLayoutProps {
  combat: CombatState;
  mapId: string;
  rewards: CombatRewards | null;
}

function BottomBar({ combat }: { combat: CombatState }) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3">
      <div className="flex gap-2"><HeroPanel player={combat.player} /><EnemyPanel enemy={combat.enemy} /></div>
      <SpellBar combat={combat} />
      <TurnButton phase={combat.phase} />
      <CombatLogPanel log={combat.log} />
    </div>
  );
}

function HudLayout({ combat, mapId, rewards }: HudLayoutProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <TopBanner mapId={mapId} turn={combat.turn} phase={combat.phase} />
      <BottomBar combat={combat} />
      <EndOverlay phase={combat.phase} rewards={rewards} />
    </div>
  );
}

function IdlePanel() {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  return (
    <div className="pointer-events-auto fixed inset-0 flex items-center justify-center bg-slate-950/60">
      <button type="button" onClick={startDemoCombat} className="rounded bg-amber-600 px-4 py-2 font-semibold text-slate-950">Lancer le combat de démonstration</button>
    </div>
  );
}

export default function CombatHud() {
  const combat = useCombatStore((state) => state.combat);
  const mapId = useCombatStore((state) => state.mapId);
  const rewards = useCombatStore((state) => state.rewards);
  if (combat === null) return <IdlePanel />;
  return <HudLayout combat={combat} mapId={mapId} rewards={rewards} />;
}
