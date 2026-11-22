import { useCombatStore } from "../../store/useCombatStore";
import type { CombatMode } from "../../store/useCombatStore";
import type { BattleState } from "../../engine/multiCombat";
import { visibleExplorationLog } from "../explorationLog";
import {
  JOURNAL_ENTRIES,
  JOURNAL_PANEL,
  STATUS_HINT,
  STATUS_OVERLAY,
  STATUS_TEXT,
  STATUS_TITLE,
} from "../explorationLayout";
import { SECTION_HEADING } from "./hudTheme";

export interface ExplorationJournalProps {
  lines: readonly string[];
}

/**
 * Liste vide **stable** : un `[]` littéral dans le sélecteur zustand renvoyait un
 * nouveau tableau à chaque snapshot et React bouclait jusqu'au « Maximum update
 * depth exceeded » (arène blanche) dès qu'un héros existait sans exploration.
 */
const NO_LOG: readonly string[] = [];

export interface ExplorationStatusProps {
  mapId: string;
}

/** Colonne gauche : le journal d'exploration, plein écran de sa colonne. */
export function ExplorationJournal({ lines }: ExplorationJournalProps) {
  return (
    <aside aria-label="Journal d’exploration" className={JOURNAL_PANEL}>
      <h1 className={SECTION_HEADING}>Journal</h1>
      <ol className={JOURNAL_ENTRIES}>
        {lines.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
      </ol>
    </aside>
  );
}

/** Overlay haut-gauche posé sur la carte, sans intercepter le clic de déplacement. */
export function ExplorationStatusOverlay({ mapId }: ExplorationStatusProps) {
  return (
    <header className={STATUS_OVERLAY}>
      <p className={STATUS_TITLE}>La Flotte</p>
      <p className={STATUS_HINT}>Mode Exploration — Clique un monstre pour combattre</p>
      <p className={STATUS_TEXT}>Carte {mapId}</p>
    </header>
  );
}

/** Connexion au store : le mode dev/prod vient de Vite, jamais d'un flag maison. */
export function ExplorationJournalPanel() {
  const log = useCombatStore((state) => state.exploration?.log ?? NO_LOG);
  return <ExplorationJournal lines={visibleExplorationLog(log, import.meta.env.DEV)} />;
}

/** Le bandeau ne s'affiche qu'en exploration pure : ni salle ouverte, ni mode combat. */
export interface ExplorationStatusSectionProps {
  mapId: string;
  mode: CombatMode;
  battle: BattleState | null;
}

/** Corps pur du portillon, testable en rendu statique. */
export function ExplorationStatusSection({ mapId, mode, battle }: ExplorationStatusSectionProps) {
  if (battle !== null || mode !== "exploration") return null;
  return <ExplorationStatusOverlay mapId={mapId} />;
}

/**
 * Connexion au store. **Portillon** : une salle ouverte (`battle`) ou un mode
 * non-exploratoire supprime le bandeau. C'était le défaut vu en capture : le
 * donjon laissait `mode = "exploration"`, le bandeau s'affichait donc au-dessus
 * de la grille de salle et se faisait recouvrir par le panneau de combat.
 */
export function ExplorationStatus() {
  const mapId = useCombatStore((state) => state.mapId);
  const mode = useCombatStore((state) => state.mode);
  const battle = useCombatStore((state) => state.battle);
  return <ExplorationStatusSection mapId={mapId} mode={mode} battle={battle} />;
}
