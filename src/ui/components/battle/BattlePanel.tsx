import type { BattleState } from "../../../engine/multiCombat";
import { isDefeat } from "../../../engine/multiCombat";
import type { BattleCombatantView, InitiativeEntry } from "../../../renderer/battleViewModel";
import { battleViewModel, initiativeOrder, shouldRenderBattle } from "../../../renderer/battleViewModel";
import { turnSide } from "../../../store/battleSelectors";
import { useCombatStore } from "../../../store/useCombatStore";
import { battleAttackButton, battleSelfButton } from "../../battle/attackButtonState";
import type { AttackButtonState } from "../../battle/attackButtonState";
import { useEscapeClose } from "../../useEscapeClose";
import { PRIMARY_BUTTON, SECTION_HEADING } from "../hudTheme";
import { closeBattle } from "./closeBattle";
import { CombatantList } from "./CombatantList";
import { InitiativeBand } from "./InitiativeBand";
import { ACTION_BUTTON, BATTLE_PANEL, CARD_HEAD, FOOT, HINT, LOG_LINE } from "./battleTheme";
import UnifiedEndOverlay from "./UnifiedEndOverlay";
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
  initiative: readonly InitiativeEntry[];
  attack: AttackButtonState;
  self: AttackButtonState | null;
  handlers: BattleHandlers;
}

interface PanelHeadProps {
  battle: BattleState;
  views: readonly BattleCombatantView[];
  onClose: () => void;
}

interface PanelFootProps {
  battle: BattleState;
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

function PanelFoot({ battle, onEndTurn }: PanelFootProps) {
  const enabled = turnSide(battle) === "player" && !isDefeat(battle);
  return (
    <footer className={FOOT}>
      <LogLines log={battle.log} />
      {isDefeat(battle) ? <DefeatNotice /> : null}
      <EndTurnButton enabled={enabled} onEndTurn={onEndTurn} />
    </footer>
  );
}

function BattleChrome({ battle, views, initiative, attack, self, handlers }: BattleChromeProps) {
  return (
    <section aria-label="Combat de salle" className={BATTLE_PANEL}>
      <PanelHead battle={battle} views={views} onClose={() => handlers.close(battle)} />
      <InitiativeBand entries={initiative} />
      <CombatantList views={views} attack={attack} self={self} onAttack={handlers.attack} />
      <PanelFoot battle={battle} onEndTurn={handlers.endTurn} />
    </section>
  );
}

/** Les deux boutons du panneau : leur coût suit le sort armé (SPELL-04). */
function armedButtons(battle: BattleState, selectedSpellId: string | null): Pick<BattleChromeProps, "attack" | "self"> {
  const attack = battleAttackButton(battle, selectedSpellId);
  return { attack, self: battleSelfButton(battle, selectedSpellId) };
}

/** Corps du panneau, isolé du store : testable en rendu statique. */
export function BattleSections({ battle }: { battle: BattleState }) {
  const views = battleViewModel(battle);
  const initiative = initiativeOrder(battle);
  const handlers = useBattleHandlers();
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  const buttons = armedButtons(battle, selectedSpellId);
  // Échap emprunte la **seule** sortie du panneau : `closeBattle` reporte la
  // victoire ou abandonne la salle, donc jamais un combat orphelin.
  useEscapeClose(() => handlers.close(battle));
  return <BattleChrome battle={battle} views={views} initiative={initiative} {...buttons} handlers={handlers} />;
}

/** Fin unifiée : récompenses créditées + retour carte, jamais une salle de donjon. */
function BattleEnd({ battle }: { battle: BattleState }) {
  const rewards = useCombatStore((state) => state.rewards);
  const excluded = useCombatStore((state) => state.dungeonRun !== null || state.activeGroup === null);
  const returnToMap = useCombatStore((state) => state.returnToMap);
  return <UnifiedEndOverlay battle={battle} rewards={rewards} excluded={excluded} onReturn={returnToMap} />;
}

/** Portillon : `battle` seul décide, le 1v1 (`combat`) garde son arène et son HUD. */
export default function BattlePanel() {
  const battle = useCombatStore((state) => state.battle);
  if (!shouldRenderBattle(battle)) return null;
  return (
    <>
      <BattleSections battle={battle} />
      <BattleEnd battle={battle} />
    </>
  );
}
