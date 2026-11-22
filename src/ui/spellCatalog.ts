import spellsYaml from "../../data/spells.yaml";
import type { SpellDef } from "../schemas/spellSchema";
import { spellsFileSchema } from "../schemas/spellSchema";

/**
 * Catalogue complet des sorts, parsé depuis `data/spells.yaml` (même source que
 * le store de combat, qui garde sa copie interne) : aucune donnée métier en dur.
 */
export const SPELL_CATALOG: readonly SpellDef[] = spellsFileSchema.parse(spellsYaml).spells;
