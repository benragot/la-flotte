import { isValidCharacterName } from "../../heroHudHelpers";
import { SECTION_HEADING } from "../hudTheme";

export interface CharacterNameFieldProps {
  name: string;
  onChange: (name: string) => void;
}

const FIELD =
  "rounded border border-[#8c6d46] bg-[#3d342a] px-2 py-1 text-sm text-[#e8dcc8] outline-none focus:border-[#d4a537]";
const HINT = "text-[10px] opacity-80";

function hintFor(name: string): string {
  return isValidCharacterName(name) ? "Nom valide" : "1 à 20 caractères, espaces ignorés";
}

/** Champ contrôlé : la validité affichée sort de `isValidCharacterName`. */
export default function CharacterNameField({ name, onChange }: CharacterNameFieldProps) {
  const valid = isValidCharacterName(name);
  return (
    <label className="flex flex-col gap-1">
      <span className={SECTION_HEADING}>Nom du héros</span>
      <input value={name} onChange={(event) => onChange(event.target.value)} className={FIELD} aria-invalid={!valid} />
      <span className={HINT}>{hintFor(name)}</span>
    </label>
  );
}
