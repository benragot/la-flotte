import type { BattleState } from "../../../engine/multiCombat";
import type { BattleCombatantView } from "../../../renderer/battleViewModel";
import { battleViewModel, shouldRenderBattle } from "../../../renderer/battleViewModel";
import { useCombatStore } from "../../../store/useCombatStore";
import { PRIMARY_BUTTON, SECTION_HEADING } from "../hudTheme";
import { closeBattle } from "./closeBattle";
import { CombatantList } from "./CombatantList";
import { ACTION_BUTTON, BATTLE_PANEL, CARD_HEAD, FOOT, HINT, LOG_LINE } from "./battleTheme";

/** Actions exposées au panneau : elles délèguent toutes au store. */
interface BattleHandlers {
  attack: (targetId: string) => void;
  endTurn: () => void;
  /** Ferme la salle : report sur victoire, abandon sinon (`closeBattle`). */
  close: (battle: BattleState) => void;
}

interface BattleChromeProps {
  battle: BattleState;
  views: readonly BattleCombatantView[];
  handlers: BattleHandlers;
}

interface PanelHeadProps {
  battle: BattleState;
  views: readonly BattleCombatantView[];
  onClose: () => void;
}

interface PanelFootProps {
  log: readonly string[];
  onEndTurn: () => void;
}

function useBattleHandlers(): BattleHandlers {
  const attack = useCombatStore((state) => state.battleSpellAttack);
  const endTurn = useCombatStore((state) => state.advanceBattleTurn);
  const settle = useCombatStore((state) => state.settleDungeonRoom);
  const abandon = useCombatStore((state) => state.endBattle);
  const close = (battle: BattleState) => closeBattle(battle, { settle, abandon });
  return { attack: (targetId) => attack({ targetId }), endTurn, close };
}

function activeName(views: readonly BattleCombatantView[]): string {
  return views.find((view) => view.isActive)?.name ?? "—";
}

function PanelHead({ battle, views, onClose }: PanelHeadProps) {
  return (
    <header className={CARD_HEAD}>
      <h2 className={SECTION_HEADING}>Combat de salle · tour {battle.turn}</h2>
      <p className={HINT}>Actif : {activeName(views)}</p>
      <button type="button" className={ACTION_BUTTON} onClick={onClose}>Clore la salle</button>
    </header>
  );
}

function PanelFoot({ log, onEndTurn }: PanelFootProps) {
  return (
    <footer className={FOOT}>
      <p className={LOG_LINE}>{log.at(-1) ?? ""}</p>
      <button type="button" className={PRIMARY_BUTTON} onClick={onEndTurn}>Terminer le tour</button>
    </footer>
  );
}

function BattleChrome({ battle, views, handlers }: BattleChromeProps) {
  return (
    <section aria-label="Combat de salle" className={BATTLE_PANEL}>
      <PanelHead battle={battle} views={views} onClose={() => handlers.close(battle)} />
      <CombatantList views={views} onAttack={handlers.attack} />
      <PanelFoot log={battle.log} onEndTurn={handlers.endTurn} />
    </section>
  );
}

/** Corps du panneau, isolé du store : testable en rendu statique. */
export function BattleSections({ battle }: { battle: BattleState }) {
  const views = battleViewModel(battle);
  const handlers = useBattleHandlers();
  return <BattleChrome battle={battle} views={views} handlers={handlers} />;
}

/** Portillon : `battle` seul décide, le 1v1 (`combat`) garde son arène et son HUD. */
export default function BattlePanel() {
  const battle = useCombatStore((state) => state.battle);
  if (!shouldRenderBattle(battle)) return null;
  return <BattleSections battle={battle} />;
}
