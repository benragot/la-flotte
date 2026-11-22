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
  if (!hasCell(map.grid, "M")) addIssue(ctx, ["grid"], "aucun placement monstre (M)");
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
});

export const mapsFileSchema = z.object({
  maps: z.array(mapSchema).min(1),
});

export type CellType = z.infer<typeof cellTypeSchema>;
export type DecorType = z.infer<typeof decorTypeSchema>;
export type DecorLayer = z.infer<typeof decorLayerSchema>;
export type DecorSpec = z.infer<typeof decorSchema>;
export type MapDef = z.infer<typeof mapSchema>;

export function parseMapsYaml(raw: string): MapDef[] {
  const parsed = mapsFileSchema.parse(yaml.load(raw));
  return parsed.maps;
}
