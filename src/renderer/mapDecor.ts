import mapsYaml from "../../data/maps.yaml";
import type { AsciiMap } from "../engine/grid";
import type { DecorSpec } from "../schemas/mapSchema";
import { mapsFileSchema } from "../schemas/mapSchema";

/**
 * Le moteur ne transporte que des cases : le décor est résolu ici en comparant
 * la grille rendue à `data/maps.yaml`. Aucune donnée de jeu n'est dupliquée et
 * `AsciiMap` reste inchangée (pathfinding, clic et combat intacts).
 */
const MAP_DEFS = mapsFileSchema.parse(mapsYaml).maps;

function signature(map: AsciiMap): string {
  return map.cells.map((row) => row.join("")).join("\n");
}

function sameGrid(def: { width: number; height: number; grid: string[] }, map: AsciiMap): boolean {
  return def.width === map.width && def.height === map.height && def.grid.join("\n") === signature(map);
}

/** Objets de décor de la carte rendue ; `[]` pour une grille sans définition. */
export function mapDecorSpecs(map: AsciiMap): readonly DecorSpec[] {
  const def = MAP_DEFS.find((entry) => sameGrid(entry, map));
  return def?.decor ?? [];
}
