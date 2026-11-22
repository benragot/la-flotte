import { useCombatStore } from "../../store/useCombatStore";
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
  const log = useCombatStore((state) => state.exploration?.log ?? []);
  return <ExplorationJournal lines={visibleExplorationLog(log, import.meta.env.DEV)} />;
}

export function ExplorationStatus() {
  const mapId = useCombatStore((state) => state.mapId);
  return <ExplorationStatusOverlay mapId={mapId} />;
}
