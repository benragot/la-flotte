import { isValidCharacterName } from "../../heroHudHelpers";
import { SECTION_HEADING } from "../hudTheme";
import { NAME_FIELD, NAME_HINT } from "./heroTheme";

export interface CharacterNameFieldProps {
  name: string;
  onChange: (name: string) => void;
}

function hintFor(name: string): string {
  return isValidCharacterName(name) ? "Nom valide" : "1 à 20 caractères, espaces ignorés";
}

/** Champ contrôlé : la validité affichée sort de `isValidCharacterName`. */
export default function CharacterNameField({ name, onChange }: CharacterNameFieldProps) {
  const valid = isValidCharacterName(name);
  return (
    <label className="flex flex-col gap-1">
      <span className={SECTION_HEADING}>Nom du héros</span>
      <input value={name} onChange={(event) => onChange(event.target.value)} className={NAME_FIELD} aria-invalid={!valid} placeholder="Nom porté sur le registre" />
      <span className={NAME_HINT}>{hintFor(name)}</span>
    </label>
  );
}
