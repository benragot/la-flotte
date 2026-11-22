import { useCombatStore } from "../../../store/useCombatStore";
import {
  DUNGEON_CATALOG,
  canEnterDungeon,
  dungeonEntries,
  levelWarning,
} from "../../../store/dungeonSelectors";
import type { DungeonEntryView } from "../../../store/dungeonSelectors";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";

const SHEET =
  "flex max-h-full w-full max-w-xl flex-col gap-2 overflow-auto rounded border-2 border-[#8c6d46] bg-[#2b241d] p-3 text-[#e8dcc8]";
const CARD = "flex flex-col gap-1 rounded border border-[#8c6d46] bg-[#3d342a] px-2 py-1";
const HEADING = "text-[10px] font-semibold uppercase tracking-widest text-[#d4a537]";
const BUTTON =
  "self-start rounded border border-[#8c6d46] bg-[#d4a537] px-2 py-1 text-xs font-bold text-[#2b241d] transition hover:bg-[#e8dcc8]";
const CLOSE_BUTTON =
  "rounded border border-[#8c6d46] bg-[#2b241d]/90 px-2 py-1 text-xs text-[#e8dcc8] transition hover:bg-[#d4a537] hover:text-[#2b241d]";
const WARNING = "text-xs text-[#d4a537]";
const NOTICE = "pointer-events-none absolute right-2 top-10 z-30 text-xs text-[#e8dcc8]";

export interface DungeonEntrySheetProps {
  entries: readonly DungeonEntryView[];
  heroLevel: number;
  onEnter: (dungeonId: string) => void;
  onClose: () => void;
}

interface EntryCardProps {
  entry: DungeonEntryView;
  heroLevel: number;
  onEnter: (dungeonId: string) => void;
}

interface LevelLineProps {
  recommendedLevel: number;
  heroLevel: number;
}

/** D67 : le niveau recommandé est toujours affiché, l'avertissement ne bloque rien. */
function LevelLine({ recommendedLevel, heroLevel }: LevelLineProps) {
  const warning = levelWarning({ recommendedLevel, heroLevel });
  const text = `Niveau recommandé ${recommendedLevel} · ton héros : niveau ${heroLevel}`;
  return (
    <>
      <p className="text-xs">{text}</p>
      {warning === null ? null : <p role="alert" className={WARNING}>{warning}</p>}
    </>
  );
}

function KeyLine({ entry }: { entry: DungeonEntryView }) {
  const state = entry.hasKey ? "possédée" : "manquante";
  return <p className="text-xs">Clef : {entry.keyName} — {state}</p>;
}

function EnterButton({ dungeonId, onEnter }: { dungeonId: string; onEnter: (id: string) => void }) {
  return (
    <button type="button" className={BUTTON} onClick={() => onEnter(dungeonId)}>
      Entrer
    </button>
  );
}

function EntryCard({ entry, heroLevel, onEnter }: EntryCardProps) {
  return (
    <li className={CARD}>
      <p className="text-sm font-bold">{entry.name}</p>
      <LevelLine recommendedLevel={entry.recommendedLevel} heroLevel={heroLevel} />
      <KeyLine entry={entry} />
      <EnterButton dungeonId={entry.id} onEnter={onEnter} />
    </li>
  );
}

function SheetHead({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex items-center justify-between">
      <h2 className={HEADING}>Donjons</h2>
      <button type="button" className={CLOSE_BUTTON} onClick={onClose}>Fermer</button>
    </header>
  );
}

function EntryCards({ entries, heroLevel, onEnter }: Omit<DungeonEntrySheetProps, "onClose">) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} heroLevel={heroLevel} onEnter={onEnter} />
      ))}
    </ul>
  );
}

/** Panneau pur (props seulement) : testable en rendu statique, sans jsdom. */
export function DungeonEntrySheet({ entries, heroLevel, onEnter, onClose }: DungeonEntrySheetProps) {
  if (entries.length === 0) return null;
  return (
    <section aria-label="Donjons disponibles" className={SHEET}>
      <SheetHead onClose={onClose} />
      <EntryCards entries={entries} heroLevel={heroLevel} onEnter={onEnter} />
    </section>
  );
}

/** Région `aria-live` toujours montée : le refus et la victoire sont annoncés. */
export function DungeonNoticeLine({ notice }: { notice: string | null }) {
  return (
    <p role="status" aria-live="polite" className={NOTICE}>
      {notice ?? ""}
    </p>
  );
}

export function DungeonNotice() {
  const notice = useCombatStore((state) => state.dungeonNotice);
  return <DungeonNoticeLine notice={notice} />;
}

function useEntryState() {
  const hero = useGameStore((state) => state.hero);
  const inventory = useGameStore((state) => state.inventory);
  const run = useCombatStore((state) => state.dungeonRun);
  const enter = useCombatStore((state) => state.enterDungeonRun);
  return { hero, inventory, runActive: run !== null, enter };
}

/** Ferme le panneau seulement si le run a démarré : un refus reste annoncé. */
function closingStart(enter: (input: { dungeonId: string }) => boolean, onClose: () => void) {
  return (dungeonId: string) => {
    enter({ dungeonId });
    if (useCombatStore.getState().dungeonRun !== null) onClose();
  };
}

/**
 * Entrée de donjon depuis l'exploration. Rien n'est rendu hors contexte : sans
 * héros, run déjà en cours ou catalogue vide. Le panneau se ferme après une
 * entrée acceptée ; un refus laisse la région `aria-live` parler.
 */
export default function DungeonEntryPanel({ onClose }: { onClose: () => void }) {
  const { hero, inventory, runActive, enter } = useEntryState();
  const entries = dungeonEntries({ dungeons: DUNGEON_CATALOG, items: GAME_CATALOG.items, inventory });
  const available = canEnterDungeon({ hasHero: hero !== null, runActive, dungeonCount: entries.length });
  if (!available || hero === null) return null;
  const start = closingStart(enter, onClose);
  return <DungeonEntrySheet entries={entries} heroLevel={hero.level} onEnter={start} onClose={onClose} />;
}
