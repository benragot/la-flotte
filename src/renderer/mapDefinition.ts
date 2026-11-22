import mapsYaml from "../../data/maps.yaml";
import type { AsciiMap } from "../engine/grid";
import type { DecorSpec, ExitSpec, MapDef } from "../schemas/mapSchema";
import { mapsFileSchema } from "../schemas/mapSchema";

/**
 * Le moteur ne transporte que des cases : décor et sorties sont résolus ici en
 * comparant la grille rendue à `data/maps.yaml`. Aucune donnée de jeu n'est
 * dupliquée et `AsciiMap` reste inchangée (pathfinding, clic et combat intacts).
 */
const MAP_DEFS = mapsFileSchema.parse(mapsYaml).maps;

function signature(map: AsciiMap): string {
  return map.cells.map((row) => row.join("")).join("\n");
}

function sameGrid(def: MapDef, map: AsciiMap): boolean {
  return def.width === map.width && def.height === map.height && def.grid.join("\n") === signature(map);
}

/** Définition YAML de la carte rendue ; `null` pour une grille sans définition. */
export function mapDefinition(map: AsciiMap): MapDef | null {
  return MAP_DEFS.find((entry) => sameGrid(entry, map)) ?? null;
}

/** Objets de décor de la carte rendue ; `[]` pour une grille sans définition. */
export function mapDecorSpecs(map: AsciiMap): readonly DecorSpec[] {
  return mapDefinition(map)?.decor ?? [];
}

/** Sorties de la carte rendue ; `[]` pour une carte sans sortie ni définition. */
export function mapExitSpecs(map: AsciiMap): readonly ExitSpec[] {
  return mapDefinition(map)?.exits ?? [];
}
