import yaml from "js-yaml";
import { z } from "zod";

export const combatStatsSchema = z.object({
  strength: z.number().int().nonnegative(),
  intelligence: z.number().int().nonnegative(),
  chance: z.number().int().nonnegative(),
  agility: z.number().int().nonnegative(),
  wisdom: z.number().int().nonnegative(),
});

/** Bornes 1.29 : jusqu'à 100 % de résistance, et jusqu'à -100 % de faiblesse. */
const RESISTANCE_MIN = -100;
const RESISTANCE_MAX = 100;

const resistanceValueSchema = z
  .number()
  .int()
  .min(RESISTANCE_MIN, `une résistance doit être ≥ ${RESISTANCE_MIN}`)
  .max(RESISTANCE_MAX, `une résistance doit être ≤ ${RESISTANCE_MAX}`);

const resistanceSchema = z
  .object({
    earth: resistanceValueSchema,
    fire: resistanceValueSchema,
    water: resistanceValueSchema,
    air: resistanceValueSchema,
    neutral: resistanceValueSchema,
  })
  .strict();

export const lootEntrySchema = z
  .object({
    itemId: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "itemId doit être en snake_case"),
    baseDropRate: z.number().gt(0).lte(1),
    ppThreshold: z.number().int().nonnegative(),
  })
  .strict();

/** Distance préférée : numérique en cases, ou indication libre (`3–4`, `contact`). */
const preferredDistanceSchema = z.union([z.number().int().nonnegative(), z.string().min(1)]);

export const monsterAiSchema = z
  .object({
    archetype: z.string().min(1),
    preferredDistance: preferredDistanceSchema.optional(),
    behaviorRules: z.array(z.string().min(1)).optional(),
    bossMechanic: z.string().min(1).optional(),
  })
  .strict();

export type CombatStats = z.infer<typeof combatStatsSchema>;
export type LootEntry = z.infer<typeof lootEntrySchema>;
export type MonsterAi = z.infer<typeof monsterAiSchema>;

type IssueSink = z.RefinementCtx;
type KamasRange = { kamasMin?: number; kamasMax?: number };

function addIssue(ctx: IssueSink, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function checkLoot(loot: readonly LootEntry[], ctx: IssueSink): void {
  loot.forEach((entry, index) => {
    if (entry.baseDropRate <= 0 || entry.baseDropRate > 1) {
      addIssue(ctx, ["loot", index, "baseDropRate"], "baseDropRate doit être dans ]0, 1]");
    }
  });
}

function checkKamasRange(range: KamasRange, ctx: IssueSink): void {
  const { kamasMin, kamasMax } = range;
  if (kamasMin === undefined || kamasMax === undefined) return;
  if (kamasMin <= kamasMax) return;
  addIssue(ctx, ["kamasMax"], "kamasMax doit être supérieur ou égal à kamasMin");
}

export const monsterSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "id doit être en snake_case"),
    name: z.string().min(1),
    description: z.string().min(1),
    level: z.number().int().positive(),
    hp: z.number().int().positive(),
    ap: z.number().int().positive(),
    mp: z.number().int().positive(),
    stats: combatStatsSchema,
    resistances: z.object({ flat: resistanceSchema, percent: resistanceSchema }).strict(),
    baseXp: z.number().int().positive(),
    isBoss: z.boolean().default(false),
    kamasMin: z.number().int().nonnegative().optional(),
    kamasMax: z.number().int().nonnegative().optional(),
    ai: monsterAiSchema.optional(),
    // 6A : les 16 sorts `fer_spell_*` n'existent pas encore. Un monstre sans sort
    // reste jouable (l'IA se contente de se rapprocher), un sort absent ne l'est pas.
    spellIds: z.array(z.string().min(1)).default([]),
    // 7B : les butins de la fiche référencent des items qui n'existent pas encore.
    loot: z.array(lootEntrySchema).default([]),
  })
  .strict()
  .superRefine((monster, ctx) => {
    checkLoot(monster.loot, ctx);
    checkKamasRange(monster, ctx);
  });

export const monstersFileSchema = z.object({
  monsters: z.array(monsterSchema).min(1),
});

export type MonsterDef = z.infer<typeof monsterSchema>;
export type MonsterResistances = MonsterDef["resistances"];

export function parseMonstersYaml(raw: string): MonsterDef[] {
  return monstersFileSchema.parse(yaml.load(raw)).monsters;
}
