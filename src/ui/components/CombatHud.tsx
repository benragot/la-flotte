import { useEffect } from "react";
import type {
  CombatPhase,
  CombatRewards,
  CombatState,
} from "../../engine/combatLoop/types";
import { useCombatStore } from "../../store/useCombatStore";
import type { HudMode } from "../hudHelpers";
import type { Shortcut } from "../shortcuts";
import { resolveShortcut } from "../shortcuts";
import CombatLogPanel from "./CombatLogPanel";
import EndOverlay from "./EndOverlay";
import SpellSlots from "./SpellSlots";
import Timeline from "./Timeline";
import TopBanner from "./TopBanner";
import Vitals from "./Vitals";
import { PRIMARY_BUTTON } from "./hudTheme";

/**
 * Le HUD n'est plus `fixed inset-0` : il est en colonne dans le flux de son
 * parent (zone libre `flex-1` pour la carte, puis dock `shrink-0`). C'est la
 * cause racine du recouvrement des dernières rangées du canvas (dette D08) qui
 * disparaît ; l'assemblage `App` (canvas dans la zone libre) arrive en phase B.
 */
const HUD_SHELL = "pointer-events-none relative flex h-full w-full flex-col text-[#e8dcc8]";
const ARENA_ZONE = "pointer-events-none relative min-h-0 flex-1";
const DOCK_SHELL =
  "pointer-events-auto flex h-[150px] shrink-0 gap-2 border-t-2 border-[#8c6d46] bg-[#2b241d] px-2 py-2";
const LOG_COLUMN = "min-w-0 w-[34%]";
const VITALS_COLUMN = "flex min-w-0 w-[24%] flex-col justify-center";
const SPELL_COLUMN = "min-w-0 flex-1";

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
  mode: HudMode;
  onReturnToMap?: (() => void) | undefined;
}

interface ShortcutContext {
  phase: CombatPhase;
  onSelect: (index: number) => void;
  onEndTurn: () => void;
  onCancel: () => void;
}

interface KeyboardDeps {
  combat: CombatState;
  selectSpell: (spellId: string | null) => void;
  endTurn: () => void;
}

function isTextField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function keyboardContext(deps: KeyboardDeps): ShortcutContext {
  const { combat, selectSpell, endTurn } = deps;
  const onSelect = (index: number) => selectSpell(combat.player.spellIds[index] ?? null);
  const onCancel = () => selectSpell(null);
  return { phase: combat.phase, onSelect, onEndTurn: endTurn, onCancel };
}

function applyShortcut(shortcut: Shortcut, ctx: ShortcutContext): void {
  if (shortcut.kind === "selectSpell") return ctx.onSelect(shortcut.index);
  if (shortcut.kind === "endTurn") return ctx.onEndTurn();
  if (shortcut.kind === "cancelSpell") return ctx.onCancel();
}

function handleKeyDown(ctx: ShortcutContext, event: KeyboardEvent): void {
  const focusInTextField = isTextField(event.target);
  const shortcut = resolveShortcut({ code: event.code, phase: ctx.phase, focusInTextField });
  if (shortcut.kind === "none") return;
  event.preventDefault();
  applyShortcut(shortcut, ctx);
}

function useHudKeyboard(ctx: ShortcutContext): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDown(ctx, event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [ctx]);
}

function HudKeyboard({ combat }: { combat: CombatState }) {
  const selectSpell = useCombatStore((state) => state.selectSpell);
  const endTurn = useCombatStore((state) => state.endTurn);
  useHudKeyboard(keyboardContext({ combat, selectSpell, endTurn }));
  return null;
}

function ArenaZone({ combat, mapId }: { combat: CombatState; mapId: string }) {
  return (
    <div className={ARENA_ZONE}>
      <HudKeyboard combat={combat} />
      <TopBanner mapId={mapId} turn={combat.turn} phase={combat.phase} />
      <Timeline player={combat.player} enemy={combat.enemy} phase={combat.phase} />
    </div>
  );
}

function BottomDock(props: HudLayoutProps) {
  const { combat, selectedSpellId, mode } = props;
  return (
    <div className={DOCK_SHELL}>
      <div className={LOG_COLUMN}><CombatLogPanel log={combat.log} playerName={combat.player.name} /></div>
      <div className={VITALS_COLUMN}><Vitals combat={combat} mode={mode} /></div>
      <div className={SPELL_COLUMN}><SpellSlots combat={combat} selectedSpellId={selectedSpellId} /></div>
    </div>
  );
}

function HudLayout(props: HudLayoutProps) {
  const { combat, mapId, rewards } = props;
  return (
    <div className={HUD_SHELL}>
      <ArenaZone combat={combat} mapId={mapId} />
      <BottomDock {...props} />
      <EndOverlay phase={combat.phase} rewards={rewards} onReturnToMap={props.onReturnToMap} />
    </div>
  );
}

function IdlePanel() {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#2b241d]/80">
      <button type="button" onClick={startDemoCombat} className={PRIMARY_BUTTON}>Lancer le combat de démonstration</button>
    </div>
  );
}

export default function CombatHud({ mode = "combat", onReturnToMap }: CombatHudProps) {
  const combat = useCombatStore((state) => state.combat);
  const mapId = useCombatStore((state) => state.mapId);
  const rewards = useCombatStore((state) => state.rewards);
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  if (combat === null) return <IdlePanel />;
  return <HudLayout combat={combat} mapId={mapId} rewards={rewards} selectedSpellId={selectedSpellId} mode={mode} onReturnToMap={onReturnToMap} />;
}
