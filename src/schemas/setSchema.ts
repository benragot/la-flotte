import yaml from "js-yaml";
import { z } from "zod";
import { checkUniqueIds, itemIdSchema, itemStatsSchema } from "./itemSchema";

const MIN_PIECE_IDS = 2;
const MIN_TIERS = 3;
const MIN_TIER_PIECES = 2;
const MAX_TIER_PIECES = 4;

type IssueSink = z.RefinementCtx;

function addIssue(ctx: IssueSink, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

export const setBonusSchema = z
  .object({
    pieces: z.number().int().min(MIN_TIER_PIECES).max(MAX_TIER_PIECES),
    stats: itemStatsSchema,
  })
  .superRefine((bonus, ctx) => {
    if (Object.keys(bonus.stats).length === 0) {
      addIssue(ctx, ["stats"], "stats doit contenir au moins une valeur");
    }
  });

export type SetBonus = z.infer<typeof setBonusSchema>;

function bonusesIncrease(bonuses: readonly SetBonus[]): boolean {
  return bonuses.every((bonus, index) => index === 0 || bonus.pieces > (bonuses[index - 1]?.pieces ?? 0));
}

function checkBonuses(bonuses: readonly SetBonus[], ctx: IssueSink): void {
  if (bonusesIncrease(bonuses)) return;
  addIssue(ctx, ["bonuses"], "les paliers de la panoplie doivent être strictement croissants");
}

export const setSchema = z
  .object({
    id: itemIdSchema,
    name: z.string().min(1),
    description: z.string().min(1),
    pieceIds: z.array(itemIdSchema).min(MIN_PIECE_IDS),
    bonuses: z.array(setBonusSchema).min(MIN_TIERS),
  })
  .superRefine((set, ctx) => {
    checkBonuses(set.bonuses, ctx);
    checkUniqueIds(set.pieceIds, ctx, "pieceIds");
  });

export type SetDef = z.infer<typeof setSchema>;

export const setsFileSchema = z
  .object({ sets: z.array(setSchema).min(1) })
  .superRefine((file, ctx) => checkUniqueIds(file.sets.map((set) => set.id), ctx, "sets"));

export function parseSetsYaml(raw: string): SetDef[] {
  return setsFileSchema.parse(yaml.load(raw)).sets;
}
