import yaml from "js-yaml";
import { z } from "zod";

export const xpTierSchema = z.object({
  level: z.number().int().positive(),
  xpRequired: z.number().int().nonnegative(),
});

export const apRuleSchema = z.object({
  minLevel: z.number().int().positive(),
  ap: z.number().int().positive(),
});

export const levelUpGainSchema = z.object({
  hp: z.number().int().nonnegative(),
  capitalPoints: z.number().int().nonnegative(),
  spellPoints: z.number().int().nonnegative(),
});

/**
 * Une règle d'écart de niveau : `mode` porte le calcul (neutre, `M / P`,
 * `(P + 10) / M`), `factor` l'échelle de la règle. Un facteur constant seul ne
 * peut pas exprimer le rendement décroissant 1.29.
 */
export const levelGapRuleSchema = z
  .object({
    minGap: z.number().int(),
    maxGap: z.number().int(),
    factor: z.number().gte(0).lte(1),
    mode: z.enum(["flat", "over", "under"]),
  })
  .strict()
  .refine((rule) => rule.minGap <= rule.maxGap, {
    message: "minGap doit être ≤ maxGap",
    path: ["minGap"],
  });

export const antiFarmSchema = z
  .object({ maxMonsterLevelRatio: z.number().positive() })
  .strict();

export const experienceRulesSchema = z
  .object({
    levelGapRules: z.array(levelGapRuleSchema).min(1),
    antiFarm: antiFarmSchema,
  })
  .strict();

export type XpTierDef = z.infer<typeof xpTierSchema>;
export type ApRuleDef = z.infer<typeof apRuleSchema>;
export type LevelGapRuleDef = z.infer<typeof levelGapRuleSchema>;
export type ExperienceRulesDef = z.infer<typeof experienceRulesSchema>;

const MIN_TIER_COUNT = 2;
const FIRST_LEVEL = 1;

type IssueSink = z.RefinementCtx;
type IssuePath = (string | number)[];

function addIssue(ctx: IssueSink, path: IssuePath, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function isConsecutiveFromOne(levels: readonly number[]): boolean {
  return levels.every((level, index) => level === index + FIRST_LEVEL);
}

function isAscending(values: readonly number[]): boolean {
  const pairs = values.slice(1).map((value, index) => [values[index], value] as const);
  return pairs.every(([previous, current]) => previous === undefined || current > previous);
}

function checkTierCount(thresholds: readonly XpTierDef[], ctx: IssueSink): void {
  if (thresholds.length < MIN_TIER_COUNT) {
    addIssue(ctx, ["xpThresholds"], `${MIN_TIER_COUNT} paliers de niveau minimum sont requis`);
  }
}

function checkTierLevels(thresholds: readonly XpTierDef[], ctx: IssueSink): void {
  const levels = thresholds.map((tier) => tier.level);
  if (!isConsecutiveFromOne(levels)) {
    addIssue(ctx, ["xpThresholds"], "les niveaux doivent être consécutifs à partir de 1");
  }
}

function checkTierXp(thresholds: readonly XpTierDef[], ctx: IssueSink): void {
  const xp = thresholds.map((tier) => tier.xpRequired);
  if (!isAscending(xp)) {
    addIssue(ctx, ["xpThresholds"], "xpRequired doit être strictement croissant");
  }
}

function checkApRules(rules: readonly ApRuleDef[], ctx: IssueSink): void {
  const levels = rules.map((rule) => rule.minLevel);
  if (new Set(levels).size !== levels.length) {
    addIssue(ctx, ["apRules"], "les minLevel doivent être uniques");
  }
}

export const progressionFileSchema = z
  .object({
    xpThresholds: z.array(xpTierSchema).min(1),
    apRules: z.array(apRuleSchema).min(1),
    gainRules: levelUpGainSchema,
    experience: experienceRulesSchema,
  })
  .superRefine((def, ctx) => {
    checkTierCount(def.xpThresholds, ctx);
    checkTierLevels(def.xpThresholds, ctx);
    checkTierXp(def.xpThresholds, ctx);
    checkApRules(def.apRules, ctx);
  });

export type ProgressionDef = z.infer<typeof progressionFileSchema>;

export function parseProgressionYaml(raw: string): ProgressionDef {
  return progressionFileSchema.parse(yaml.load(raw));
}
