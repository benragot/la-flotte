import type { CombatRewards, CombatState } from "../../engine/combatLoop/types";
import type { Hero } from "../../engine/createHero";
import { useCombatStore } from "../../store/useCombatStore";
import { useGameStore } from "../../store/useGameStore";
import type { HudMode } from "../hudHelpers";
import type { EffectiveHp } from "../hudHp";
import { useEffectiveHp } from "../useEffectiveHp";
import EndOverlay from "./EndOverlay";
import Timeline from "./Timeline";
import TopBanner from "./TopBanner";
import VitalMeter from "./VitalMeter";
import { CombatDock } from "./battle/CombatDock";
import { DOCK_PANEL, PRIMARY_BUTTON } from "./hudTheme";
import { DOCK_SHELL, PANEL_TITLE, VALUE } from "../uiTokens";

/**
 * Le HUD n'est plus `fixed inset-0` : il est en colonne dans le flux de son
 * parent (zone libre `flex-1` pour la carte, puis dock `shrink-0`). C'est la
 * cause racine du recouvrement des dernières rangées du canvas (dette D08) qui
 * disparaît avec l'assemblage `App` de la phase B.
 *
 * Trois bandes, cf. `battle/layout.ts` : `header` (bandeau), `initiative`
 * (noms des combattants) puis `dock` (journal, vitals, tour, sorts).
 */
const HUD_SHELL =
  "pointer-events-none relative flex h-full w-full flex-col text-[var(--color-ink-1)]";
const INITIATIVE_ZONE = "pointer-events-none flex min-h-0 flex-1 items-start overflow-hidden";
const VITALS_COLUMN = "flex min-w-0 w-[24%] flex-col justify-center";
/** Exploration : le journal est passé en colonne gauche, le dock garde les ressources. */
const EXPLORATION_HUD_SHELL =
  "pointer-events-none flex w-full flex-col text-[var(--color-ink-1)]";

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

function HeroApMpLine({ hero }: { hero: Hero }) {
  return (
    <p className={`${VALUE} flex flex-wrap items-baseline gap-x-2`}>
      <span className="text-[var(--color-ink-ap)]">{`PA ${hero.ap}`}</span>
      <span className="text-[var(--color-ink-3)]">·</span>
      <span className="text-[var(--color-ink-mp)]">{`PM ${hero.mp}`}</span>
    </p>
  );
}

function HeroVitalsBody({ hero, hp }: { hero: Hero; hp: EffectiveHp }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <VitalMeter label="PV" tone="hp" current={hp.hp} max={hp.maxHp} />
      <HeroApMpLine hero={hero} />
    </div>
  );
}

/**
 * Dock d'exploration : le héros persisté ne porte **pas** de PA/PM maximum, donc
 * seuls les PV ont une barre ; les PA/PM restent des chiffres. Plus aucune icône
 * emoji : le libellé Dofus suffit et se lit sans police tierce.
 */
function HeroVitals({ hero, hp }: { hero: Hero; hp: EffectiveHp }) {
  return (
    <section aria-label="Ressources du héros" className={DOCK_PANEL}>
      <h2 className={PANEL_TITLE}>Héros</h2>
      <HeroVitalsBody hero={hero} hp={hp} />
    </section>
  );
}

function DockVitals({ hero }: { hero: Hero | null }) {
  const hp = useEffectiveHp();
  if (hero === null || hp === null) return null;
  return <HeroVitals hero={hero} hp={hp} />;
}

/**
 * Dock d'exploration : le journal est parti dans la colonne gauche et le
 * bandeau d'état au-dessus de la carte, il ne reste que les ressources du héros.
 * C'est le seul contenu du conteneur de HUD : il en fixe donc la hauteur.
 */
function ExplorationDock({ hero }: { hero: Hero | null }) {
  return (
    <div className={EXPLORATION_HUD_SHELL} role="group" aria-label="Dock du héros">
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
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[var(--color-scrim)]">
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
