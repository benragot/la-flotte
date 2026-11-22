import type { BattleState } from "../../../engine/multiCombat";
import { isDefeat } from "../../../engine/multiCombat";
import type { BattleCombatantView } from "../../../renderer/battleViewModel";
import { battleViewModel, shouldRenderBattle } from "../../../renderer/battleViewModel";
import { useCombatStore } from "../../../store/useCombatStore";
import { useEscapeClose } from "../../useEscapeClose";
import { PRIMARY_BUTTON, SECTION_HEADING } from "../hudTheme";
import { closeBattle } from "./closeBattle";
import { CombatantList } from "./CombatantList";
import { ACTION_BUTTON, BATTLE_PANEL, CARD_HEAD, FOOT, HINT, LOG_LINE } from "./battleTheme";

/** Nombre de lignes de journal gardées à l'écran : le joueur voit sa riposte. */
const LOG_LINES = 5;

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
  defeated: boolean;
  onEndTurn: () => void;
}

function useBattleHandlers(): BattleHandlers {
  const attack = useCombatStore((state) => state.battleSpellAttack);
  const retaliate = useCombatStore((state) => state.playEnemyTurns);
  const settle = useCombatStore((state) => state.settleDungeonRoom);
  const abandon = useCombatStore((state) => state.endBattle);
  const close = (battle: BattleState) => closeBattle(battle, { settle, abandon });
  return { attack: (targetId) => attack({ targetId }), endTurn: () => retaliate(), close };
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

function LogLines({ log }: { log: readonly string[] }) {
  const recent = log.slice(-LOG_LINES);
  return (
    <ul aria-label="Journal du combat">
      {recent.map((line, index) => <li key={index} className={LOG_LINE}>{line}</li>)}
    </ul>
  );
}

function DefeatNotice() {
  return <p role="alert" className={HINT}>Défaite : le héros est tombé, la salle reste aux monstres.</p>;
}

function PanelFoot({ log, defeated, onEndTurn }: PanelFootProps) {
  return (
    <footer className={FOOT}>
      <LogLines log={log} />
      {defeated ? <DefeatNotice /> : null}
      <button type="button" className={PRIMARY_BUTTON} onClick={onEndTurn}>Terminer le tour</button>
    </footer>
  );
}

function BattleChrome({ battle, views, handlers }: BattleChromeProps) {
  return (
    <section aria-label="Combat de salle" className={BATTLE_PANEL}>
      <PanelHead battle={battle} views={views} onClose={() => handlers.close(battle)} />
      <CombatantList views={views} onAttack={handlers.attack} />
      <PanelFoot log={battle.log} defeated={isDefeat(battle)} onEndTurn={handlers.endTurn} />
    </section>
  );
}

/** Corps du panneau, isolé du store : testable en rendu statique. */
export function BattleSections({ battle }: { battle: BattleState }) {
  const views = battleViewModel(battle);
  const handlers = useBattleHandlers();
  // Échap emprunte la **seule** sortie du panneau : `closeBattle` reporte la
  // victoire ou abandonne la salle, donc jamais un combat orphelin.
  useEscapeClose(() => handlers.close(battle));
  return <BattleChrome battle={battle} views={views} handlers={handlers} />;
}

/** Portillon : `battle` seul décide, le 1v1 (`combat`) garde son arène et son HUD. */
export default function BattlePanel() {
  const battle = useCombatStore((state) => state.battle);
  if (!shouldRenderBattle(battle)) return null;
  return <BattleSections battle={battle} />;
}
