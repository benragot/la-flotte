import type { CombatRewards, CombatState } from "../../engine/combatLoop/types";
import type { Hero } from "../../engine/createHero";
import { useCombatStore } from "../../store/useCombatStore";
import { useGameStore } from "../../store/useGameStore";
import type { HudMode } from "../hudHelpers";
import EndOverlay from "./EndOverlay";
import Timeline from "./Timeline";
import TopBanner from "./TopBanner";
import { CombatDock } from "./battle/CombatDock";
import { DOCK_PANEL, PRIMARY_BUTTON, SECTION_HEADING } from "./hudTheme";

/**
 * Le HUD n'est plus `fixed inset-0` : il est en colonne dans le flux de son
 * parent (zone libre `flex-1` pour la carte, puis dock `shrink-0`). C'est la
 * cause racine du recouvrement des dernières rangées du canvas (dette D08) qui
 * disparaît avec l'assemblage `App` de la phase B.
 *
 * Trois bandes, cf. `battle/layout.ts` : `header` (bandeau), `initiative`
 * (noms des combattants) puis `dock` (journal, vitals, tour, sorts).
 */
const HUD_SHELL = "pointer-events-none relative flex h-full w-full flex-col text-[#e8dcc8]";
const INITIATIVE_ZONE = "pointer-events-none flex min-h-0 flex-1 items-start overflow-hidden";
const DOCK_SHELL =
  "pointer-events-auto flex h-[150px] shrink-0 gap-2 border-t-2 border-[#8c6d46] bg-[#2b241d] px-2 py-2";
const VITALS_COLUMN = "flex min-w-0 w-[24%] flex-col justify-center";
/** Exploration : le journal est passé en colonne gauche, le dock garde les ressources. */
const EXPLORATION_HUD_SHELL = "pointer-events-none flex h-full w-full flex-col justify-end text-[#e8dcc8]";

export interface CombatHudProps {
  mode?: HudMode;
  /** Bouton « Retourner sur la carte » ; fallback sur la démo si absent. */
  onReturnToMap?: (() => void) | undefined;
}

interface HudLayoutProps {
  combat: CombatState;
  mapId: string;
  rewards: CombatRewards | null;
  selectedSpellId: string | null;
  onReturnToMap?: (() => void) | undefined;
}

interface CombatLayoutProps {
  combat: CombatState;
  onReturnToMap?: (() => void) | undefined;
}

function InitiativeZone({ combat }: { combat: CombatState }) {
  return (
    <div className={INITIATIVE_ZONE}>
      <Timeline player={combat.player} enemy={combat.enemy} phase={combat.phase} />
    </div>
  );
}

function HudLayout({ combat, mapId, rewards, selectedSpellId, onReturnToMap }: HudLayoutProps) {
  return (
    <div className={HUD_SHELL}>
      <TopBanner mapId={mapId} turn={combat.turn} phase={combat.phase} />
      <InitiativeZone combat={combat} />
      <CombatDock combat={combat} selectedSpellId={selectedSpellId} />
      <EndOverlay phase={combat.phase} rewards={rewards} onReturnToMap={onReturnToMap} />
    </div>
  );
}

function CombatLayout({ combat, onReturnToMap }: CombatLayoutProps) {
  const mapId = useCombatStore((state) => state.mapId);
  const rewards = useCombatStore((state) => state.rewards);
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  const layout = { combat, mapId, rewards, selectedSpellId, onReturnToMap };
  return <HudLayout {...layout} />;
}

function HeroVitals({ hero }: { hero: Hero }) {
  return (
    <section aria-label="Ressources du héros" className={DOCK_PANEL}>
      <h2 className={SECTION_HEADING}>Héros</h2>
      <p className="text-sm font-bold text-[#b83b3b]">❤ {hero.hp} / {hero.maxHp}</p>
      <p className="text-sm font-bold text-[#3b6fb8]">★ {hero.ap} PA · 👢 {hero.mp} PM</p>
    </section>
  );
}

function DockVitals({ hero }: { hero: Hero | null }) {
  if (hero === null) return null;
  return <HeroVitals hero={hero} />;
}

/**
 * Dock d'exploration : le journal est parti dans la colonne gauche et le
 * bandeau d'état au-dessus de la carte, il ne reste que les ressources du héros.
 */
function ExplorationDock({ hero }: { hero: Hero | null }) {
  return (
    <div className={EXPLORATION_HUD_SHELL}>
      <div className={DOCK_SHELL}>
        <div className={VITALS_COLUMN}><DockVitals hero={hero} /></div>
      </div>
    </div>
  );
}

function ExplorationHud() {
  const hero = useGameStore((state) => state.hero);
  return <ExplorationDock hero={hero} />;
}

function IdlePanel() {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#2b241d]/80">
      <button type="button" onClick={startDemoCombat} className={PRIMARY_BUTTON}>Lancer le combat de démonstration</button>
    </div>
  );
}

/**
 * Portillon : en exploration le HUD s'affiche même sans combat ; en combat
 * l'absence de combat retombe sur l'invite de démonstration.
 */
export default function CombatHud({ mode = "combat", onReturnToMap }: CombatHudProps) {
  const combat = useCombatStore((state) => state.combat);
  if (mode === "exploration") return <ExplorationHud />;
  if (combat === null) return <IdlePanel />;
  return <CombatLayout combat={combat} onReturnToMap={onReturnToMap} />;
}
