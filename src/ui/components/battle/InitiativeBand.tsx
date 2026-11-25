import type { InitiativeEntry } from "../../../renderer/battleViewModel";
import { SECTION_HEADING } from "../hudTheme";
import {
  INITIATIVE_ACTIVE,
  INITIATIVE_BLOCK,
  INITIATIVE_CAMP,
  INITIATIVE_CHIP,
  INITIATIVE_GRID,
  INITIATIVE_MARK,
  INITIATIVE_NAME,
  INITIATIVE_POSITION,
  INITIATIVE_VALUE,
} from "./battleTheme";

/** Camp en toutes lettres dans le libellé : la couleur n'est jamais la seule information. */
const CAMP_LABEL: Record<InitiativeEntry["side"], string> = { player: "héros", enemy: "monstre" };
/** Camp en forme : ancre contre fer croisé, distinct de la cible rouge des cartes. */
const CAMP_MARK: Record<InitiativeEntry["side"], string> = { player: "⚓", enemy: "⚔" };

export interface InitiativeBandProps {
  /** Séquence des vivants, déjà calculée par `initiativeOrder` (aucune règle ici). */
  entries: readonly InitiativeEntry[];
}

function chipClass(entry: InitiativeEntry): string {
  return entry.isActive ? `${INITIATIVE_CHIP} ${INITIATIVE_ACTIVE}` : INITIATIVE_CHIP;
}

/** « Initiative 2 : Balthazar, héros, 30, actif » — rang, camp et actif annoncés. */
function chipLabel(entry: InitiativeEntry): string {
  const active = entry.isActive ? ", actif" : "";
  return `Initiative ${entry.position} : ${entry.name}, ${CAMP_LABEL[entry.side]}, ${entry.initiative}${active}`;
}

function Mark({ entry }: { entry: InitiativeEntry }) {
  const mark = entry.isActive ? "▸" : " ";
  return <span aria-hidden="true" className={INITIATIVE_MARK}>{mark}</span>;
}

function Camp({ entry }: { entry: InitiativeEntry }) {
  return <span aria-hidden="true" className={INITIATIVE_CAMP}>{CAMP_MARK[entry.side]}</span>;
}

function Position({ entry }: { entry: InitiativeEntry }) {
  return (
    <>
      <span aria-hidden="true" className={INITIATIVE_POSITION}>{entry.position}</span>
      <span className={INITIATIVE_NAME}>{entry.name}</span>
      <span aria-hidden="true" className={INITIATIVE_VALUE}>{entry.initiative}</span>
    </>
  );
}

function ChipParts({ entry }: { entry: InitiativeEntry }) {
  return (
    <>
      <Mark entry={entry} />
      <Camp entry={entry} />
      <Position entry={entry} />
    </>
  );
}

function InitiativeChip({ entry }: { entry: InitiativeEntry }) {
  return (
    <li className={chipClass(entry)} aria-label={chipLabel(entry)} aria-current={entry.isActive ? "true" : undefined}>
      <ChipParts entry={entry} />
    </li>
  );
}

function ChipList({ entries }: InitiativeBandProps) {
  return (
    <ol aria-label="Ordre d’initiative" className={INITIATIVE_GRID}>
      {entries.map((entry) => <InitiativeChip key={entry.id} entry={entry} />)}
    </ol>
  );
}

/** Bande « Initiative » : compacte, dans le panneau, pour anticiper le tour suivant. */
export function InitiativeBand({ entries }: InitiativeBandProps) {
  if (entries.length === 0) return null;
  return (
    <div className={INITIATIVE_BLOCK}>
      <h3 className={SECTION_HEADING}>Initiative</h3>
      <ChipList entries={entries} />
    </div>
  );
}
