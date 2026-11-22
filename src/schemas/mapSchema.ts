import yaml from "js-yaml";
import { z } from "zod";

export const cellTypeSchema = z.enum([".", "#", "~", "P", "M"]);

/**
 * Décor purement visuel : aucune incidence sur le pathfinding, la ligne de vue
 * ni les règles de combat. `ponton` ne dessine pas d'objet : il marque les
 * cases qui reçoivent le matériau « bois de ponton ».
 */
export const decorTypeSchema = z.enum([
  "epave",
  "mat",
  "cordages",
  "baril",
  "caisse",
  "ancre",
  "chaine",
  "rocher",
  "algue",
  "debris",
  "ponton",
]);

/** `below` : sous les jetons ; `above` : par-dessus (voile, cordage haut). */
export const decorLayerSchema = z.enum(["below", "above"]);

export const decorSchema = z
  .object({
    type: decorTypeSchema,
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    layer: decorLayerSchema.default("below"),
  })
  .strict();

/** Case d'arrivée écrite en donnée (sinon le miroir du bord décide). */
export const exitTargetSchema = z
  .object({ x: z.number().int().nonnegative(), y: z.number().int().nonnegative() })
  .strict();

/**
 * « Soleil » d'une carte d'extérieur : `x`/`y` = case de sortie sur CETTE
 * carte, `to` = id de la carte de destination, `at` = case d'arrivée
 * facultative (sans elle, la position est le miroir du bord traversé).
 */
export const mapExitSchema = z
  .object({
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    to: z.string().min(1),
    at: exitTargetSchema.optional(),
  })
  .strict();

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const LEGEND = new Set<string>(cellTypeSchema.options);

const mapFieldsSchema = z.object({
  id: z.string().min(1).regex(ID_PATTERN, "id doit être en snake_case"),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  grid: z.array(z.string().min(1)).min(1),
  /** Objets de décor posés en données ; optionnel pour ne casser aucune carte. */
  decor: z.array(decorSchema).default([]),
  /** Sorties de carte ; vide par défaut, donc aucune carte existante ne casse. */
  exits: z.array(mapExitSchema).default([]),
});

type MapFields = z.infer<typeof mapFieldsSchema>;
type IssueSink = z.RefinementCtx;
type IssuePath = (string | number)[];

function addIssue(ctx: IssueSink, path: IssuePath, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function hasCell(grid: string[], cell: string): boolean {
  return grid.some((row) => row.includes(cell));
}

function checkHeight(map: MapFields, ctx: IssueSink): void {
  if (map.grid.length !== map.height) {
    addIssue(ctx, ["grid"], `la grille doit contenir ${map.height} lignes`);
  }
}

function checkWidths(map: MapFields, ctx: IssueSink): void {
  map.grid.forEach((row, index) => {
    if (row.length !== map.width) {
      addIssue(ctx, ["grid", index], `la ligne ${index + 1} doit contenir ${map.width} cases`);
    }
  });
}

function checkCells(map: MapFields, ctx: IssueSink): void {
  map.grid.forEach((row, index) => {
    const unknown = [...row].find((cell) => !LEGEND.has(cell));
    if (unknown !== undefined) addIssue(ctx, ["grid", index], `caractère inconnu: ${unknown}`);
  });
}

function checkSpawns(map: MapFields, ctx: IssueSink): void {
  if (!hasCell(map.grid, "P")) addIssue(ctx, ["grid"], "aucun placement joueur (P)");
}

function isExitInside(map: MapFields, exit: MapFields["exits"][number]): boolean {
  return exit.x < map.width && exit.y < map.height;
}

function checkExits(map: MapFields, ctx: IssueSink): void {
  map.exits.forEach((exit, index) => {
    if (!isExitInside(map, exit)) addIssue(ctx, ["exits", index], "sortie hors de la grille");
  });
}

function isInside(map: MapFields, entry: MapFields["decor"][number]): boolean {
  return entry.x < map.width && entry.y < map.height;
}

/** Case de la grille sous un objet ; `undefined` hors grille. */
function decorCell(map: MapFields, entry: MapFields["decor"][number]): string | undefined {
  return map.grid[entry.y]?.[entry.x];
}

function isOutOfBounds(map: MapFields, entry: MapFields["decor"][number]): boolean {
  return !isInside(map, entry);
}

function checkDecorCell(map: MapFields, ctx: IssueSink, index: number): void {
  const entry = map.decor[index];
  const cell = entry === undefined ? undefined : decorCell(map, entry);
  if (cell === "#") addIssue(ctx, ["decor", index], "décor posé sur un mur");
  if (cell === "P") addIssue(ctx, ["decor", index], "décor posé sur le départ du héros");
}

function checkOneDecor(map: MapFields, ctx: IssueSink, index: number): void {
  const entry = map.decor[index];
  if (entry === undefined || isOutOfBounds(map, entry)) return addIssue(ctx, ["decor", index], "décor hors de la grille");
  checkDecorCell(map, ctx, index);
}

function checkDecor(map: MapFields, ctx: IssueSink): void {
  map.decor.forEach((_entry, index) => checkOneDecor(map, ctx, index));
}

export const mapSchema = mapFieldsSchema.superRefine((map, ctx) => {
  checkHeight(map, ctx);
  checkWidths(map, ctx);
  checkCells(map, ctx);
  checkSpawns(map, ctx);
  checkDecor(map, ctx);
  checkExits(map, ctx);
});

const mapsFileSchemaBase = z.object({ maps: z.array(mapSchema).min(1) });

type MapsFile = z.infer<typeof mapsFileSchemaBase>;

/** `to` doit désigner une carte déclarée : une sortie morte est une donnée morte. */
function checkExitTargets(file: MapsFile, ctx: IssueSink): void {
  const ids = new Set(file.maps.map((map) => map.id));
  file.maps.forEach((map, mapIndex) => {
    map.exits.forEach((exit, exitIndex) => {
      if (ids.has(exit.to)) return;
      addIssue(ctx, ["maps", mapIndex, "exits", exitIndex], `carte inconnue: ${exit.to}`);
    });
  });
}

function checkMapsFile(file: MapsFile, ctx: IssueSink): void {
  checkExitTargets(file, ctx);
  checkArrivals(file, ctx);
}

/**
 * `at` vit sur la carte d'ARRIVÉE : c'est sa grille qui le borne, pas celle de
 * départ. Sans ce contrôle, une arrivée fausse ne lève pas — elle téléporte.
 */
function arrivalOutside(destination: MapFields | undefined, at: ExitTargetSpec | undefined): boolean {
  if (destination === undefined || at === undefined) return false;
  return at.x >= destination.width || at.y >= destination.height;
}

function checkArrivals(file: MapsFile, ctx: IssueSink): void {
  const byId = new Map(file.maps.map((map) => [map.id, map]));
  file.maps.forEach((map, mapIndex) => {
    map.exits.forEach((exit, exitIndex) => {
      if (!arrivalOutside(byId.get(exit.to), exit.at)) return;
      addIssue(ctx, ["maps", mapIndex, "exits", exitIndex], `arrivée hors de ${exit.to}`);
    });
  });
}

export const mapsFileSchema = mapsFileSchemaBase.superRefine(checkMapsFile);

export type CellType = z.infer<typeof cellTypeSchema>;
export type DecorType = z.infer<typeof decorTypeSchema>;
export type DecorLayer = z.infer<typeof decorLayerSchema>;
export type DecorSpec = z.infer<typeof decorSchema>;
export type ExitTargetSpec = z.infer<typeof exitTargetSchema>;
export type ExitSpec = z.infer<typeof mapExitSchema>;
export type MapDef = z.infer<typeof mapSchema>;

export function parseMapsYaml(raw: string): MapDef[] {
  const parsed = mapsFileSchema.parse(yaml.load(raw));
  return parsed.maps;
}
