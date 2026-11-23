import packageJson from "../../../package.json";
import type { CombatPhase } from "../../engine/combatLoop/types";
import { formatGameVersion } from "../../engine/version";
import { phaseLabel } from "../hudHelpers";
import {
  TOP_BANNER,
  TOP_BANNER_CONTEXT,
  TOP_BANNER_MICRO,
  TOP_BANNER_TITLE,
} from "./hudTheme";

interface TopBannerProps {
  mapId: string;
  turn: number;
  phase: CombatPhase;
}

export default function TopBanner({ mapId, turn, phase }: TopBannerProps) {
  const version = formatGameVersion(packageJson.version);
  return (
    <header className={TOP_BANNER} data-zone="header">
      <h1 className={TOP_BANNER_TITLE}>La Flotte <small className={TOP_BANNER_MICRO}>{version}</small></h1>
      <p className={TOP_BANNER_CONTEXT}>Carte {mapId} · Tour {turn}</p>
      <p className={`ml-auto ${TOP_BANNER_TITLE}`}>{phaseLabel(phase)}</p>
    </header>
  );
}
