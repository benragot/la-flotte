import yaml from "js-yaml";
import { z } from "zod";

export const softCapTuple = z.tuple([
  z.number().int().positive().nullable(),
  z.number().int().positive(),
]);

const FLAT_RATE_STATS = ["vitality", "wisdom"] as const;
const SOFT_CAP_STATS = ["strength", "intelligence", "chance", "agility"] as const;

function addIssue(ctx: z.RefinementCtx, stat: StatKey, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [stat], message });
}

function checkFlatRate(caps: SoftCaps, ctx: z.RefinementCtx): void {
  for (const stat of FLAT_RATE_STATS) {
    if (caps[stat].length !== 1) {
      addIssue(ctx, stat, `${stat} doit définir exactement un palier [capitalPerPoint, gain]`);
    }
  }
}

function isAboveThreshold(
  threshold: number | null,
  previous: number | null | undefined,
): boolean {
  if (threshold === null) return true;
  if (previous === undefined) return true;
  if (previous === null) return false;
  return threshold > previous;
}

function thresholdsIncrease(tiers: readonly SoftCap[]): boolean {
  return tiers.every(([threshold], index) => isAboveThreshold(threshold, tiers[index - 1]?.[0]));
}

function lastThreshold(tiers: readonly SoftCap[]): number | null | undefined {
  return tiers[tiers.length - 1]?.[0];
}

function checkTiers(tiers: readonly SoftCap[], stat: StatKey, ctx: z.RefinementCtx): void {
  if (!thresholdsIncrease(tiers)) {
    addIssue(ctx, stat, `les seuils de ${stat} doivent être strictement croissants`);
  }
  if (lastThreshold(tiers) !== null) {
    addIssue(ctx, stat, `le dernier palier de ${stat} doit avoir un seuil null`);
  }
}

function checkSoftCaps(caps: SoftCaps, ctx: z.RefinementCtx): void {
  checkFlatRate(caps, ctx);
  for (const stat of SOFT_CAP_STATS) {
    if (caps[stat].length < 2) {
      addIssue(ctx, stat, `${stat} doit définir au moins deux paliers [valeurMaxDuPalier, capitalPerPoint]`);
    } else {
      checkTiers(caps[stat], stat, ctx);
    }
  }
}

export const softCapsSchema = z
  .object({
    vitality: z.array(softCapTuple).min(1),
    wisdom: z.array(softCapTuple).min(1),
    strength: z.array(softCapTuple).min(1),
    intelligence: z.array(softCapTuple).min(1),
    chance: z.array(softCapTuple).min(1),
    agility: z.array(softCapTuple).min(1),
  })
  .superRefine((caps, ctx) => {
    checkSoftCaps(caps, ctx);
  });

export const classSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  basePa: z.number().int().positive(),
  basePm: z.number().int().positive(),
  baseHp: z.number().int().positive(),
  basePp: z.number().int().positive(),
  vitalityGainPerPoint: z.number().int().positive().default(1),
  softCaps: softCapsSchema,
});

export const classesFileSchema = z.object({
  classes: z.array(classSchema).min(1),
});

export type ClassDef = z.infer<typeof classSchema>;
export type SoftCap = z.infer<typeof softCapTuple>;
export type SoftCaps = z.infer<typeof softCapsSchema>;
export type StatKey = keyof SoftCaps;

export function parseClassesYaml(raw: string): ClassDef[] {
  const parsed = classesFileSchema.parse(yaml.load(raw));
  return parsed.classes;
}
