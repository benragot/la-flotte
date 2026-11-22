import yaml from "js-yaml";
import { z } from "zod";

/**
 * Table de spawn d'exploration (5B-G).
 * Le schéma valide, il ne résout rien : le tirage pondéré et le repli de zone
 * vivent dans `src/engine/exploration/spawnTable.ts`, la lecture YAML dans le
 * store. Aucun identifiant de monstre ni de map n'est connu ici.
 */
const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

const identifierSchema = z.string().min(1).regex(ID_PATTERN, "identifiant attendu en snake_case");

/** `weight` est un poids relatif entier strictement positif, jamais un pourcentage. */
export const spawnEntrySchema = z
  .object({
    monsterId: identifierSchema,
    weight: z.number().int().positive(),
  })
  .strict();

export const spawnZoneSchema = z
  .object({
    id: identifierSchema,
    mapId: identifierSchema,
    monsters: z.array(spawnEntrySchema).min(1, "une zone doit déclarer au moins un monstre"),
  })
  .strict();

export const spawnsFileSchema = z
  .object({
    zones: z.array(spawnZoneSchema).min(1, "spawns.yaml doit déclarer au moins une zone"),
  })
  .strict();

export type SpawnEntryDef = z.infer<typeof spawnEntrySchema>;
export type SpawnZoneDef = z.infer<typeof spawnZoneSchema>;
export type SpawnsFile = z.infer<typeof spawnsFileSchema>;

export function parseSpawnsYaml(raw: string): SpawnZoneDef[] {
  return spawnsFileSchema.parse(yaml.load(raw)).zones;
}
