import { useState } from "react";
import classesYaml from "../../../../data/classes.yaml";
import type { Hero } from "../../../engine/createHero";
import { classesFileSchema } from "../../../schemas/classSchema";
import type { ClassDef } from "../../../schemas/classSchema";
import { useGameStore } from "../../../store/useGameStore";
import { isValidCharacterName } from "../../heroHudHelpers";
import { SECTION_HEADING } from "../hudTheme";
import CharacterNameField from "./CharacterNameField";
import ClassCard from "./ClassCard";
import StatAllocation from "./StatAllocation";

/** Catalogue validé une fois (12 classes) : aucune donnée métier en dur ici. */
const classes = classesFileSchema.parse(classesYaml).classes;

const SHEET =
  "pointer-events-auto flex w-full max-w-3xl flex-col gap-3 rounded border-2 border-[#8c6d46] bg-[#2b241d] p-3 text-[#e8dcc8]";
const GRID = "grid grid-cols-2 gap-2 sm:grid-cols-4";
const CREATE_BUTTON =
  "rounded border-2 border-[#8c6d46] bg-[#d4a537] px-4 py-2 text-sm font-bold text-[#2b241d] transition hover:bg-[#e8dcc8] disabled:opacity-40";

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
        <ClassCard key={entry.id} classDef={entry} selected={entry.id === classId} onSelect={onSelect} />
      ))}
    </div>
  );
}

function CreateButton({ draft, onCreate }: { draft: Draft; onCreate: (payload: Payload) => void }) {
  const payload = draftPayload(draft);
  const click = payload === null ? undefined : () => onCreate(payload);
  return (
    <button type="button" onClick={click} disabled={payload === null} className={CREATE_BUTTON}>
      Créer
    </button>
  );
}

function CreationSheet({ draft, onCreate }: { draft: Draft; onCreate: (payload: Payload) => void }) {
  return (
    <section aria-label="Création de personnage" className={SHEET}>
      <h1 className={SECTION_HEADING}>Crée ton héros</h1>
      <CharacterNameField name={draft.name} onChange={draft.setName} />
      <ClassGrid classId={draft.classId} onSelect={draft.setClassId} />
      <CreateButton draft={draft} onCreate={onCreate} />
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
