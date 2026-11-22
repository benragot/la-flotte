import yaml from "js-yaml";
import { z } from "zod";

/**
 * Table de spawn d'exploration (5B-g).
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

/** Un compte se tire entre deux bornes incluses : jamais zéro, jamais inversées. */
const countSchema = z.number().int().min(1, "un compte de spawn vaut au moins 1");

export const countRangeSchema = z
  .object({ min: countSchema, max: countSchema })
  .strict()
  .refine((range) => range.max >= range.min, { message: "max doit être ≥ min", path: ["max"] });

/**
 * Repli historique : une zone qui ne déclare rien garde **un** groupe d'**un**
 * monstre, exactement le comportement d'avant la donnée `groups`.
 */
export const SINGLE_GROUP = { min: 1, max: 1 } as const;

export const countRangeWithDefaultSchema = countRangeSchema.default(SINGLE_GROUP);

/**
 * `groups` = combien de groupes la zone fait apparaître, `members` = combien de
 * monstres par groupe (1 à 3, règle Dofus 1.29). Les deux sont **des données** :
 * aucune borne métier n'est écrite dans `src/`.
 */
export const spawnZoneSchema = z
  .object({
    id: identifierSchema,
    mapId: identifierSchema,
    monsters: z.array(spawnEntrySchema).min(1, "une zone doit déclarer au moins un monstre"),
    groups: countRangeWithDefaultSchema,
    members: countRangeWithDefaultSchema,
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
