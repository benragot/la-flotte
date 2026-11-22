import type { AsciiMap } from "../engine/grid";
import type { DecorSpec } from "../schemas/mapSchema";
import { mapDefinition } from "./mapDefinition";

/** Objets de décor de la carte rendue ; `[]` pour une grille sans définition. */
export function mapDecorSpecs(map: AsciiMap): readonly DecorSpec[] {
  return mapDefinition(map)?.decor ?? [];
}
