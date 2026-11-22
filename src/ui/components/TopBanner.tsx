import packageJson from "../../../package.json";
import type { CombatPhase } from "../../engine/combatLoop/types";
import { formatGameVersion } from "../../engine/version";
import { phaseLabel } from "../hudHelpers";

interface TopBannerProps {
  mapId: string;
  turn: number;
  phase: CombatPhase;
}

const BANNER =
  "pointer-events-auto flex items-baseline gap-4 border-b border-[#8c6d46]/60 bg-[#2b241d]/90 py-1 pl-3 pr-44 text-[#e8dcc8]";
const TITLE = "text-sm font-bold tracking-wide text-[#d4a537]";
const VERSION = "text-[10px] font-normal text-[#8c6d46]";

export default function TopBanner({ mapId, turn, phase }: TopBannerProps) {
  const version = formatGameVersion(packageJson.version);
  return (
    <header className={BANNER}>
      <h1 className={TITLE}>La Flotte <small className={VERSION}>{version}</small></h1>
      <p className="text-[11px] opacity-80">Carte {mapId} · Tour {turn}</p>
      <p className="ml-auto text-sm font-semibold text-[#d4a537]">{phaseLabel(phase)}</p>
    </header>
  );
}
