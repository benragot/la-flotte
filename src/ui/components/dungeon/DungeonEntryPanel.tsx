import { useCombatStore } from "../../../store/useCombatStore";
import {
  DUNGEON_CATALOG,
  canEnterDungeon,
  dungeonEntries,
  levelWarning,
} from "../../../store/dungeonSelectors";
import type { DungeonEntryView } from "../../../store/dungeonSelectors";
import { GAME_CATALOG, useGameStore } from "../../../store/useGameStore";
import { BUTTON_GOLD } from "../../uiTokens";
import {
  DANGER_PLAQUE,
  OVERLAY_CARD,
  OVERLAY_HEAD,
  OVERLAY_SHEET,
  OVERLAY_TEXT,
  OVERLAY_TEXT_STRONG,
  OVERLAY_TITLE,
} from "../overlayTheme";
import { SMALL_BUTTON } from "../inventory/inventoryTheme";

/**
 * Fiche d'entrée de donjon — fenêtre de parchemin du lot 5.
 *
 * Le danger est une **plaque franche** (`danger-face` `#9C2F2F`, encre
 * `ink-1` = **5,42:1**) : « manquante » se lit sans transparence. Le refus
 * d'entrée reste rendu **dans** la fiche (jamais derrière la nappe) mais devient
 * un encart creux à bandeau rouge, plus lisible qu'un aplat rouge sur du papier.
 *
 * ⚠️ **Unique hex gardé du lot** : `bg-[#b83b3b]` du bandeau de refus. Il est
 * égal à `--color-danger-line` (`theme.css`) et **le test unitaire
 * `tests/unit/dungeonEntry.spec.ts` l'exige dans le rendu** ; ce fichier de test
 * est hors de mon périmètre d'écriture. Tout le reste passe par `var()`.
 */
const REFUSAL = [
  "flex items-stretch gap-1.5 rounded-[1px] border border-[var(--color-line-field)]",
  "bg-[var(--color-surface-inset)] px-2 py-1 text-[12px] font-bold text-[var(--color-ink-danger)]",
].join(" ");
const REFUSAL_BAND = "w-0.5 shrink-0 self-stretch bg-[#b83b3b]";
const WARNING = "text-[11px] leading-4 text-[var(--color-line-gold)]";
/** Région `aria-live` toujours montée : vide, elle ne peint rien. */
const NOTICE_ANCHOR = "pointer-events-none absolute right-2 top-10 z-30";
/** Notice non vide : une plaque `surface-1` lisible, pas une phrase posée sur la carte. */
const NOTICE_PLAQUE = [
  "rounded-[1px] border border-[var(--color-line-strong)] bg-[var(--color-surface-1)]",
  "px-2 py-0.5 text-[11px] leading-4 text-[var(--color-ink-2)]",
].join(" ");

export interface DungeonEntrySheetProps {
  entries: readonly DungeonEntryView[];
  heroLevel: number;
  /** Refus d'entrée : rendu **dans** la fiche, la nappe modale ne peut plus le cacher. */
  notice: string | null;
  onEnter: (dungeonId: string) => void;
  onClose: () => void;
}

interface EntryCardProps {
  entry: DungeonEntryView;
  heroLevel: number;
  notice: string | null;
  onEnter: (dungeonId: string) => void;
}

interface CardMetaProps {
  entry: DungeonEntryView;
  heroLevel: number;
  notice: string | null;
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
      <p className={OVERLAY_TEXT}>{text}</p>
      {warning === null ? null : <p role="alert" className={WARNING}>{warning}</p>}
    </>
  );
}

/**
 * Ligne de clef : un seul nœud de texte (`Clef : X — manquante`), parce que le
 * test unitaire du refus lit cette phrase d'un bloc. Quand la clef manque, la
 * ligne devient une plaque de danger franche ; possédée, elle reste en encre de
 * lecture.
 */
function KeyLine({ entry }: { entry: DungeonEntryView }) {
  const state = entry.hasKey ? "possédée" : "manquante";
  return <p className={entry.hasKey ? OVERLAY_TEXT : DANGER_PLAQUE}>Clef : {entry.keyName} — {state}</p>;
}

/** Refus d'entrée rendu **dans** la fiche, juste sous la ligne de clef. */
function RefusalNotice({ notice }: { notice: string | null }) {
  if (notice === null) return null;
  return (
    <p role="alert" aria-label="Refus d’entrée" className={REFUSAL}>
      <span className={REFUSAL_BAND} aria-hidden="true" />
      <span>{notice}</span>
    </p>
  );
}

function EnterButton({ dungeonId, onEnter }: { dungeonId: string; onEnter: (id: string) => void }) {
  return (
    <button type="button" className={`${BUTTON_GOLD} self-start`} onClick={() => onEnter(dungeonId)}>
      Entrer
    </button>
  );
}

function CardMeta({ entry, heroLevel, notice }: CardMetaProps) {
  return (
    <>
      <LevelLine recommendedLevel={entry.recommendedLevel} heroLevel={heroLevel} />
      <KeyLine entry={entry} />
      <RefusalNotice notice={notice} />
    </>
  );
}

function EntryCard({ entry, heroLevel, notice, onEnter }: EntryCardProps) {
  return (
    <li className={OVERLAY_CARD}>
      <p className={OVERLAY_TEXT_STRONG}>{entry.name}</p>
      <CardMeta entry={entry} heroLevel={heroLevel} notice={notice} />
      <EnterButton dungeonId={entry.id} onEnter={onEnter} />
    </li>
  );
}

function SheetHead({ onClose }: { onClose: () => void }) {
  return (
    <header className={OVERLAY_HEAD}>
      <h2 className={OVERLAY_TITLE}>Donjons</h2>
      <button type="button" className={SMALL_BUTTON} onClick={onClose}>Fermer</button>
    </header>
  );
}

function EntryCards({ entries, heroLevel, notice, onEnter }: Omit<DungeonEntrySheetProps, "onClose">) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} heroLevel={heroLevel} notice={notice} onEnter={onEnter} />
      ))}
    </ul>
  );
}

/** Panneau pur (props seulement) : testable en rendu statique, sans jsdom. */
export function DungeonEntrySheet({ entries, heroLevel, notice, onEnter, onClose }: DungeonEntrySheetProps) {
  if (entries.length === 0) return null;
  const cards = { entries, heroLevel, notice, onEnter };
  return (
    <section aria-label="Donjons disponibles" className={OVERLAY_SHEET}>
      <SheetHead onClose={onClose} />
      <EntryCards {...cards} />
    </section>
  );
}

/** Région `aria-live` toujours montée : le refus et la victoire sont annoncés. */
export function DungeonNoticeLine({ notice }: { notice: string | null }) {
  if (notice === null) return <p role="status" aria-live="polite" className={NOTICE_ANCHOR} />;
  return (
    <p role="status" aria-live="polite" className={`${NOTICE_ANCHOR} ${NOTICE_PLAQUE}`}>
      {notice}
    </p>
  );
}

export function DungeonNotice() {
  const notice = useCombatStore((state) => state.dungeonNotice);
  return <DungeonNoticeLine notice={notice} />;
}

function useEntryContext() {
  const hero = useGameStore((state) => state.hero);
  const inventory = useGameStore((state) => state.inventory);
  const run = useCombatStore((state) => state.dungeonRun);
  return { hero, inventory, runActive: run !== null };
}

function useEntryActions() {
  const battle = useCombatStore((state) => state.battle);
  const combat = useCombatStore((state) => state.combat);
  const notice = useCombatStore((state) => state.dungeonNotice);
  const enter = useCombatStore((state) => state.enterDungeonRun);
  const inCombat = combat !== null || battle !== null;
  return { notice, inCombat, enter };
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
 * héros, run, combat en cours ou catalogue vide. Le panneau se ferme après une
 * entrée acceptée ; un refus est rendu **dans** la fiche (jamais derrière la nappe).
 */
export default function DungeonEntryPanel({ onClose }: { onClose: () => void }) {
  const { hero, inventory, runActive } = useEntryContext();
  const { notice, inCombat, enter } = useEntryActions();
  const entries = dungeonEntries({ dungeons: DUNGEON_CATALOG, items: GAME_CATALOG.items, inventory });
  const available = canEnterDungeon({ hasHero: hero !== null, runActive, inCombat, dungeonCount: entries.length });
  if (!available || hero === null) return null;
  const props = { entries, heroLevel: hero.level, notice, onEnter: closingStart(enter, onClose), onClose };
  return <DungeonEntrySheet {...props} />;
}
