import packageJson from "../../../package.json";
import type { CombatPhase } from "../../engine/combatLoop/types";
import { formatGameVersion } from "../../engine/version";
import { phaseLabel } from "../hudHelpers";

interface TopBannerProps {
  mapId: string;
  turn: number;
  phase: CombatPhase;
}

export default function TopBanner({ mapId, turn, phase }: TopBannerProps) {
  const version = formatGameVersion(packageJson.version);
  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 flex items-baseline justify-between gap-4 bg-slate-950/85 px-4 py-2 text-slate-100">
      <h1 className="text-lg font-bold tracking-wide text-amber-300">La Flotte <small className="text-xs font-normal text-slate-400">{version}</small></h1>
      <p className="text-xs">Carte {mapId} · Tour {turn}</p>
      <p className="text-sm font-semibold">{phaseLabel(phase)}</p>
    </header>
  );
}
