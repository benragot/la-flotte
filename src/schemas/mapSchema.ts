import yaml from "js-yaml";
import { z } from "zod";

export const cellTypeSchema = z.enum([".", "#", "~", "P", "M"]);

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const LEGEND = new Set<string>(cellTypeSchema.options);

const mapFieldsSchema = z.object({
  id: z.string().min(1).regex(ID_PATTERN, "id doit être en snake_case"),
  name: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  grid: z.array(z.string().min(1)).min(1),
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

export const mapSchema = mapFieldsSchema.superRefine((map, ctx) => {
  checkHeight(map, ctx);
  checkWidths(map, ctx);
  checkCells(map, ctx);
  checkSpawns(map, ctx);
});

export const mapsFileSchema = z.object({
  maps: z.array(mapSchema).min(1),
});

export type CellType = z.infer<typeof cellTypeSchema>;
export type MapDef = z.infer<typeof mapSchema>;

export function parseMapsYaml(raw: string): MapDef[] {
  const parsed = mapsFileSchema.parse(yaml.load(raw));
  return parsed.maps;
}
