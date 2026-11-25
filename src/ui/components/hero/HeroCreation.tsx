import { useState } from "react";
import classesYaml from "../../../../data/classes.yaml";
import type { Hero } from "../../../engine/createHero";
import { classesFileSchema } from "../../../schemas/classSchema";
import type { ClassDef } from "../../../schemas/classSchema";
import { useGameStore } from "../../../store/useGameStore";
import { isValidCharacterName } from "../../heroHudHelpers";
import { SPELL_CATALOG } from "../../spellCatalog";
import { PRIMARY_BUTTON } from "../hudTheme";
import { heroSpells } from "../spellbook/spellbookView";
import CharacterNameField from "./CharacterNameField";
import ClassCard from "./ClassCard";
import { baseSocle, socleLabel } from "./classIdentity";
import StatAllocation from "./StatAllocation";
import { CREATION_SHEET, CREATION_TITLE, SOCLE_NOTE } from "./heroTheme";

/** Catalogue validé une fois (12 classes) : aucune donnée métier en dur ici. */
const classes = classesFileSchema.parse(classesYaml).classes;

/** Socle commun calculé depuis le YAML : jamais un littéral dans l'écran. */
const SOCLE = baseSocle(classes);

const SHEET = CREATION_SHEET;
const GRID = "grid grid-cols-2 gap-2 sm:grid-cols-4";

export interface HeroCreationProps {
  /** Appelé juste après `createCharacter` : la phase 4D branche l'entrée en arène. */
  onCreated?: (() => void) | undefined;
}

interface Draft {
  name: string;
  setName: (name: string) => void;
  classId: string | null;
  setClassId: (classId: string) => void;
}

interface Payload {
  name: string;
  classId: string;
}

function useDraft(): Draft {
  const [name, setName] = useState("");
  const [classId, setClassId] = useState<string | null>(null);
  return { name, setName, classId, setClassId };
}

function classById(classId: string | null): ClassDef | null {
  return classes.find((entry) => entry.id === classId) ?? null;
}

function draftPayload(draft: Draft): Payload | null {
  const classDef = classById(draft.classId);
  if (classDef === null || !isValidCharacterName(draft.name)) return null;
  return { name: draft.name.trim(), classId: classDef.id };
}

function ClassGrid({ classId, onSelect }: { classId: string | null; onSelect: (classId: string) => void }) {
  return (
    <div className={GRID}>
      {classes.map((entry) => (
        <ClassCard key={entry.id} classDef={entry} spells={heroSpells({ spells: SPELL_CATALOG, classId: entry.id })} socle={SOCLE} selected={entry.id === classId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function CreateButton({ draft, onCreate }: { draft: Draft; onCreate: (payload: Payload) => void }) {
  const payload = draftPayload(draft);
  const click = payload === null ? undefined : () => onCreate(payload);
  return (
    <button type="button" onClick={click} disabled={payload === null} className={PRIMARY_BUTTON}>
      Créer
    </button>
  );
}

function CreationHead() {
  return (
    <header className="border-b border-[var(--color-line-soft)] pb-2">
      <h1 className={CREATION_TITLE}>Crée ton héros</h1>
      <p data-class-socle="" className={SOCLE_NOTE}>{socleLabel(SOCLE)}</p>
    </header>
  );
}

function CreationFooter({ draft, onCreate }: { draft: Draft; onCreate: (payload: Payload) => void }) {
  return (
    <footer className="flex justify-end">
      <CreateButton draft={draft} onCreate={onCreate} />
    </footer>
  );
}

function CreationSheet({ draft, onCreate }: { draft: Draft; onCreate: (payload: Payload) => void }) {
  return (
    <section aria-label="Création de personnage" className={SHEET}>
      <CreationHead />
      <CharacterNameField name={draft.name} onChange={draft.setName} />
      <ClassGrid classId={draft.classId} onSelect={draft.setClassId} />
      <CreationFooter draft={draft} onCreate={onCreate} />
    </section>
  );
}

function AllocationPanel({ hero }: { hero: Hero }) {
  const classDef = classById(hero.classId);
  if (classDef === null) return null;
  return <StatAllocation hero={hero} classDef={classDef} />;
}

function useCreate(onCreated?: () => void): (payload: Payload) => void {
  const createCharacter = useGameStore((state) => state.createCharacter);
  return (payload) => {
    createCharacter(payload);
    onCreated?.();
  };
}

/**
 * Écran autonome : sans héros il affiche le formulaire (nom + 12 classes),
 * avec un héros il bascule sur la répartition du capital. Zéro prop requise.
 */
export default function HeroCreation({ onCreated }: HeroCreationProps) {
  const hero = useGameStore((state) => state.hero);
  const draft = useDraft();
  const create = useCreate(onCreated);
  if (hero !== null) return <AllocationPanel hero={hero} />;
  return <CreationSheet draft={draft} onCreate={create} />;
}
