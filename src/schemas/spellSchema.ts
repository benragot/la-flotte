import yaml from "js-yaml";
import { z } from "zod";

export const elementSchema = z.enum(["earth", "fire", "water", "air", "neutral"]);

export const spellKindSchema = z.enum(["damage", "teleport"]);

export const spellDamageSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export type Element = z.infer<typeof elementSchema>;
export type SpellKind = z.infer<typeof spellKindSchema>;
export type SpellDamage = z.infer<typeof spellDamageSchema>;

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

type SpellFields = {
  id: string;
  kind: SpellKind;
  minRange: number;
  maxRange: number;
  damage?: SpellDamage | undefined;
};

type IssueSink = z.RefinementCtx;

function addIssue(ctx: IssueSink, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function checkRanges(spell: SpellFields, ctx: IssueSink): void {
  if (spell.minRange < 1 || spell.minRange > spell.maxRange) {
    addIssue(ctx, ["minRange"], "minRange doit vérifier 1 <= minRange <= maxRange");
  }
}

function checkDamage(spell: SpellFields, ctx: IssueSink): void {
  if (spell.kind !== "damage") return;
  if (spell.damage === undefined) {
    addIssue(ctx, ["damage"], "un sort de dégâts doit définir damage");
    return;
  }
  checkDamageOrder(spell.damage, ctx);
}

function checkDamageOrder(damage: SpellDamage, ctx: IssueSink): void {
  if (damage.min > damage.max) {
    addIssue(ctx, ["damage", "min"], "damage.min doit être inférieur ou égal à damage.max");
  }
}

function checkTeleport(spell: SpellFields, ctx: IssueSink): void {
  if (spell.kind === "teleport" && spell.damage !== undefined) {
    addIssue(ctx, ["damage"], "un sort de téléportation ne peut pas infliger de dégâts");
  }
}

export const spellSchema = z
  .object({
    id: z.string().min(1).regex(ID_PATTERN, "id doit être en snake_case"),
    name: z.string().min(1),
    description: z.string().min(1),
    classId: z.string().min(1),
    kind: spellKindSchema,
    element: elementSchema,
    apCost: z.number().int().min(1),
    minRange: z.number().int().nonnegative(),
    maxRange: z.number().int().positive(),
    requiresLos: z.boolean(),
    damage: spellDamageSchema.optional(),
    pushCells: z.number().int().nonnegative().optional(),
  })
  .superRefine((spell, ctx) => {
    checkRanges(spell, ctx);
    checkDamage(spell, ctx);
    checkTeleport(spell, ctx);
  });

export const spellsFileSchema = z.object({
  spells: z.array(spellSchema).min(1),
});

export type SpellDef = z.infer<typeof spellSchema>;

export function parseSpellsYaml(raw: string): SpellDef[] {
  return spellsFileSchema.parse(yaml.load(raw)).spells;
}
