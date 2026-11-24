import type { BattleState } from "../../../engine/multiCombat";
import { isDefeat } from "../../../engine/multiCombat";
import type { BattleCombatantView } from "../../../renderer/battleViewModel";
import { battleViewModel, shouldRenderBattle } from "../../../renderer/battleViewModel";
import { turnSide } from "../../../store/battleSelectors";
import { useCombatStore } from "../../../store/useCombatStore";
import { battleAttackButton } from "../../battle/attackButtonState";
import type { AttackButtonState } from "../../battle/attackButtonState";
import { useEscapeClose } from "../../useEscapeClose";
import { PRIMARY_BUTTON, SECTION_HEADING } from "../hudTheme";
import { closeBattle } from "./closeBattle";
import { CombatantList } from "./CombatantList";
import { ACTION_BUTTON, BATTLE_PANEL, CARD_HEAD, FOOT, HINT, LOG_LINE } from "./battleTheme";
import { useCombatBeat } from "./useCombatBeat";

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
  attack: AttackButtonState;
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
  /** `false` : l'actif n'est pas le héros, « Terminer le tour » est alors sans effet. */
  heroTurn: boolean;
  onEndTurn: () => void;
}

function useBattleHandlers(): BattleHandlers {
  const beat = useCombatBeat();
  const settle = useCombatStore((state) => state.settleDungeonRoom);
  const abandon = useCombatStore((state) => state.endBattle);
  const close = (battle: BattleState) => closeBattle(battle, { settle, abandon });
  return { attack: beat.attack, endTurn: beat.endTurn, close };
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

/** La main du héros est la condition du bouton : hors main, le tour n'est pas le sien. */
function EndTurnButton({ enabled, onEndTurn }: { enabled: boolean; onEndTurn: () => void }) {
  return (
    <button type="button" className={PRIMARY_BUTTON} onClick={onEndTurn} disabled={!enabled}>
      Terminer le tour
    </button>
  );
}

function PanelFoot({ log, defeated, heroTurn, onEndTurn }: PanelFootProps) {
  return (
    <footer className={FOOT}>
      <LogLines log={log} />
      {defeated ? <DefeatNotice /> : null}
      <EndTurnButton enabled={heroTurn && !defeated} onEndTurn={onEndTurn} />
    </footer>
  );
}

function BattleChrome({ battle, views, attack, handlers }: BattleChromeProps) {
  const heroTurn = turnSide(battle) === "player";
  return (
    <section aria-label="Combat de salle" className={BATTLE_PANEL}>
      <PanelHead battle={battle} views={views} onClose={() => handlers.close(battle)} />
      <CombatantList views={views} attack={attack} onAttack={handlers.attack} />
      <PanelFoot log={battle.log} defeated={isDefeat(battle)} heroTurn={heroTurn} onEndTurn={handlers.endTurn} />
    </section>
  );
}

/** Corps du panneau, isolé du store : testable en rendu statique. */
export function BattleSections({ battle }: { battle: BattleState }) {
  const views = battleViewModel(battle);
  const handlers = useBattleHandlers();
  const attack = battleAttackButton(battle);
  // Échap emprunte la **seule** sortie du panneau : `closeBattle` reporte la
  // victoire ou abandonne la salle, donc jamais un combat orphelin.
  useEscapeClose(() => handlers.close(battle));
  return <BattleChrome battle={battle} views={views} attack={attack} handlers={handlers} />;
}

/** Portillon : `battle` seul décide, le 1v1 (`combat`) garde son arène et son HUD. */
export default function BattlePanel() {
  const battle = useCombatStore((state) => state.battle);
  if (!shouldRenderBattle(battle)) return null;
  return <BattleSections battle={battle} />;
}
