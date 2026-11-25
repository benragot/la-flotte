import type { ClassDef } from "../../../schemas/classSchema";
import type { SpellDef } from "../../../schemas/spellSchema";
import { ELEMENT_BAND, ELEMENT_BAND_CELL, ELEMENT_GLYPH } from "../elementInk";
import type { BaseSocle, CapLine, ClassExtra, ClassSpellLine } from "./classIdentity";
import { capLines, classExtras, classSpellLine } from "./classIdentity";
import {
  CLASS_CAP_LABEL,
  CLASS_CAP_ROW,
  CLASS_CAP_TITLE,
  CLASS_CARD_IDLE,
  CLASS_CARD_PICKED,
  CLASS_EXTRA,
  CLASS_NAME,
  CLASS_SEAL,
  CLASS_SEAL_LETTER,
  CLASS_SPELL_META,
  CLASS_SPELL_NAME,
  CLASS_SPELL_ROW,
} from "./heroTheme";

/**
 * Planche d'une classe : identité (sceau + nom), trois sorts réels de
 * `data/spells.yaml`, quatre paliers élémentaires de `data/classes.yaml`, et
 * les seuls écarts au socle commun que les données portent. Aucun chiffre de
 * base n'est répété : le socle est annoncé une fois par la feuille.
 */
export interface ClassCardProps {
  classDef: ClassDef;
  spells: readonly SpellDef[];
  socle: BaseSocle;
  selected: boolean;
  onSelect: (classId: string) => void;
}

function Seal({ classDef }: { classDef: ClassDef }) {
  return (
    <span aria-hidden="true" className={CLASS_SEAL}>
      <span className={CLASS_SEAL_LETTER}>{classDef.name.slice(0, 1)}</span>
    </span>
  );
}

function ExtraBadges({ extras }: { extras: readonly ClassExtra[] }) {
  return (
    <span className="ml-auto flex shrink-0 gap-1">
      {extras.map((extra) => <span key={extra.key} data-class-extra="" className={CLASS_EXTRA}>{extra.label}</span>)}
    </span>
  );
}

function CardHead({ classDef, extras }: { classDef: ClassDef; extras: readonly ClassExtra[] }) {
  return (
    <span className="flex items-center gap-1.5">
      <Seal classDef={classDef} />
      <span className={CLASS_NAME}>{classDef.name}</span>
      <ExtraBadges extras={extras} />
    </span>
  );
}

function SpellRow({ line }: { line: ClassSpellLine }) {
  return (
    <span data-class-spell={line.spell.id} className={CLASS_SPELL_ROW}>
      <span aria-hidden="true" className={`${ELEMENT_BAND_CELL} ${ELEMENT_BAND[line.view.elementTone]}`} />
      <span aria-hidden="true" className={`${ELEMENT_GLYPH} text-[var(--color-wood-ink)]`}>{line.view.elementGlyph}</span>
      <span className={CLASS_SPELL_NAME} title={line.view.name}>{line.view.name}</span>
      <span className={CLASS_SPELL_META}>{line.meta}</span>
    </span>
  );
}

function SpellRows({ spells }: { spells: readonly SpellDef[] }) {
  return (
    <span className="flex flex-col">
      {spells.map((spell) => <SpellRow key={spell.id} line={classSpellLine(spell)} />)}
    </span>
  );
}

function CapRow({ line }: { line: CapLine }) {
  return (
    <span data-class-cap={line.stat} className={CLASS_CAP_ROW}>
      <strong className={CLASS_CAP_LABEL}>{line.label}</strong>
      {" "}
      {line.value}
    </span>
  );
}

function CapBlock({ classDef }: { classDef: ClassDef }) {
  return (
    <span className="flex flex-col border-t border-[var(--color-wood-joint)] pt-0.5">
      <span className={CLASS_CAP_TITLE}>Paliers — points par +1</span>
      {capLines(classDef).map((line) => <CapRow key={line.stat} line={line} />)}
    </span>
  );
}

export default function ClassCard({ classDef, spells, socle, selected, onSelect }: ClassCardProps) {
  const extras = classExtras(classDef, socle);
  return <button type="button" aria-pressed={selected} data-class-card={classDef.id} onClick={() => onSelect(classDef.id)} className={selected ? CLASS_CARD_PICKED : CLASS_CARD_IDLE}>
    <CardHead classDef={classDef} extras={extras} />
    <SpellRows spells={spells} />
    <CapBlock classDef={classDef} />
  </button>;
}
