import yaml from "js-yaml";
import { z } from "zod";

export const combatStatsSchema = z.object({
  strength: z.number().int().nonnegative(),
  intelligence: z.number().int().nonnegative(),
  chance: z.number().int().nonnegative(),
  agility: z.number().int().nonnegative(),
  wisdom: z.number().int().nonnegative(),
});

const resistanceSchema = z.object({
  earth: z.number().int().nonnegative(),
  fire: z.number().int().nonnegative(),
  water: z.number().int().nonnegative(),
  air: z.number().int().nonnegative(),
  neutral: z.number().int().nonnegative(),
});

export const lootEntrySchema = z.object({
  itemId: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, "itemId doit être en snake_case"),
  baseDropRate: z.number().gt(0).lte(1),
  ppThreshold: z.number().int().nonnegative(),
});

export type CombatStats = z.infer<typeof combatStatsSchema>;
export type LootEntry = z.infer<typeof lootEntrySchema>;

type IssueSink = z.RefinementCtx;

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
    resistances: z.object({ flat: resistanceSchema, percent: resistanceSchema }),
    baseXp: z.number().int().positive(),
    spellIds: z.array(z.string().min(1)).min(1),
    loot: z.array(lootEntrySchema).min(1),
  })
  .superRefine((monster, ctx) => {
    checkLoot(monster.loot, ctx);
  });

export const monstersFileSchema = z.object({
  monsters: z.array(monsterSchema).min(1),
});

export type MonsterDef = z.infer<typeof monsterSchema>;
export type MonsterResistances = MonsterDef["resistances"];

export function parseMonstersYaml(raw: string): MonsterDef[] {
  return monstersFileSchema.parse(yaml.load(raw)).monsters;
}
