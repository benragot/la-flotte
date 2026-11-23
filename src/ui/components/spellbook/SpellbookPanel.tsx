import { useState } from "react";
import type { SpellDef } from "../../../schemas/spellSchema";
import { useCombatStore } from "../../../store/useCombatStore";
import { useGameStore } from "../../../store/useGameStore";
import { SPELL_CATALOG } from "../../spellCatalog";
import { useEscapeClose } from "../../useEscapeClose";
import { ELEMENT_GLYPH, ELEMENT_INK } from "../elementInk";
import { OVERLAY_HEAD, OVERLAY_SHEET, OVERLAY_TITLE } from "../overlayTheme";
import {
  CHIP,
  DETAIL_DESCRIPTION,
  DETAIL_HINT,
  DETAIL_META,
  DETAIL_PANEL,
  DETAIL_TITLE,
  ITEM_BUTTON,
  ITEM_ROW,
  ITEM_ROW_SELECTED,
  LIST,
  ROW,
  SMALL_BUTTON,
} from "../inventory/inventoryTheme";
import type { SpellDetailRow, SpellDetailView } from "./spellbookView";
import { heroSpells, spellDetail, spellSummary } from "./spellbookView";

/** Sélection courante de la liste : re-clic = fermeture, comme les objets du sac. */
interface SpellSelection {
  selected: string | null;
  onSelect: (spellId: string) => void;
  onClear: () => void;
}

function toggleSelection(current: string | null, spellId: string): string | null {
  return current === spellId ? null : spellId;
}

function useSpellSelection(): SpellSelection {
  const [selected, setSelected] = useState<string | null>(null);
  const onSelect = (spellId: string) => setSelected((current) => toggleSelection(current, spellId));
  const onClear = () => setSelected(null);
  return { selected, onSelect, onClear };
}

/**
 * Sorts du héros : les siens, jamais les 44 lignes du YAML. En combat, la liste
 * apprise du combattant fait foi ; en exploration, ceux de sa classe.
 */
function useHeroSpells(): SpellDef[] {
  const classId = useGameStore((state) => state.hero?.classId ?? "");
  const combat = useCombatStore((state) => state.combat);
  const learnedIds = combat === null ? undefined : combat.player.spellIds;
  return heroSpells({ spells: SPELL_CATALOG, classId, learnedIds });
}

function SpellbookHead({ onClose }: { onClose: () => void }) {
  return (
    <header className={OVERLAY_HEAD}>
      <h2 className={OVERLAY_TITLE}>Grimoire</h2>
      <button type="button" onClick={onClose} className={SMALL_BUTTON}>Fermer</button>
    </header>
  );
}

interface SpellLineProps {
  view: SpellDetailView;
  selected: boolean;
  onSelect: (spellId: string) => void;
}

/** Glyphe d'élément : le même `▲ ◆ ◇ ■` que le journal, à la même encre. */
function ElementGlyph({ view }: { view: SpellDetailView }) {
  const className = `${ELEMENT_GLYPH} ${ELEMENT_INK[view.elementTone]}`;
  return <span aria-hidden="true" className={className}>{view.elementGlyph}</span>;
}

/** Ligne de sort : glyphe, nom cliquable, puis coût, élément, dégâts et portée. */
function SpellLine({ view, selected, onSelect }: SpellLineProps) {
  return (
    <li className={selected ? ITEM_ROW_SELECTED : ITEM_ROW}>
      <ElementGlyph view={view} />
      <button type="button" aria-pressed={selected} className={ITEM_BUTTON} onClick={() => onSelect(view.id)}>{view.name}</button>
      <span className={DETAIL_META}>{spellSummary(view)}</span>
    </li>
  );
}

interface SpellListProps {
  spells: readonly SpellDef[];
  selected: string | null;
  onSelect: (spellId: string) => void;
}

function SpellList({ spells, selected, onSelect }: SpellListProps) {
  if (spells.length === 0) return <p className={DETAIL_HINT}>Aucun sort appris pour l’instant.</p>;
  return (
    <ul aria-label="Sorts du héros" className={LIST}>
      {spells.map((spell) => <SpellLine key={spell.id} view={spellDetail(spell)} selected={spell.id === selected} onSelect={onSelect} />)}
    </ul>
  );
}

function DetailHead({ view }: { view: SpellDetailView }) {
  return (
    <header className="flex items-center gap-1.5">
      <ElementGlyph view={view} />
      <h3 className={DETAIL_TITLE}>{view.name}</h3>
    </header>
  );
}

/** Pastille de fait : libellé et valeur déjà formatées, rayon 1 px. */
function FactChip({ row }: { row: SpellDetailRow }) {
  return <li className={CHIP}>{row.label} <strong>{row.value}</strong></li>;
}

/** Corps pur de la fiche : props seulement, testable via `react-dom/server`. */
export function SpellDetailBody({ view }: { view: SpellDetailView }) {
  return (
    <div className="flex flex-col gap-1">
      <DetailHead view={view} />
      <p className={DETAIL_META}>{view.kind} · Coût {view.apCost} PA</p>
      <ul className={ROW}>{view.rows.map((row) => <FactChip key={row.key} row={row} />)}</ul>
      <p className={DETAIL_DESCRIPTION}>{view.description}</p>
    </div>
  );
}

function DetailHint() {
  return <p className={DETAIL_HINT}>Sélectionne un sort pour voir ce qu’il fait</p>;
}

interface DetailContentProps {
  spell: SpellDef | undefined;
  onClear: () => void;
}

function DetailContent({ spell, onClear }: DetailContentProps) {
  if (spell === undefined) return <DetailHint />;
  return (
    <>
      <SpellDetailBody view={spellDetail(spell)} />
      <button type="button" className={`${SMALL_BUTTON} self-end`} onClick={onClear}>Fermer le détail</button>
    </>
  );
}

interface SpellDetailPanelProps {
  spell: SpellDef | undefined;
  onClear: () => void;
}

/** Bandeau de détail, même région nommée que la fiche d'objet. Échap le referme avant le grimoire. */
function SpellDetailPanel({ spell, onClear }: SpellDetailPanelProps) {
  useEscapeClose(onClear, spell !== undefined);
  return (
    <section aria-label="Détail du sort" aria-live="polite" className={DETAIL_PANEL}>
      <DetailContent spell={spell} onClear={onClear} />
    </section>
  );
}

interface GrimoireProps {
  spells: readonly SpellDef[];
  selection: SpellSelection;
  onClose: () => void;
}

function Grimoire({ spells, selection, onClose }: GrimoireProps) {
  const selected = spells.find((spell) => spell.id === selection.selected);
  return (
    <section aria-label="Grimoire" className={OVERLAY_SHEET}>
      <SpellbookHead onClose={onClose} />
      <SpellList spells={spells} selected={selection.selected} onSelect={selection.onSelect} />
      <SpellDetailPanel spell={selected} onClear={selection.onClear} />
    </section>
  );
}

/** Grimoire : ce que chaque sort du héros fait vraiment (élément, dégâts, portée). */
export default function SpellbookPanel({ onClose }: { onClose: () => void }) {
  const selection = useSpellSelection();
  const spells = useHeroSpells();
  return <Grimoire spells={spells} selection={selection} onClose={onClose} />;
}
