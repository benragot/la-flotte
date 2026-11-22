import yaml from "js-yaml";
import { z } from "zod";

export const elementSchema = z.enum(["earth", "fire", "water", "air", "neutral"]);

export const spellKindSchema = z.enum(["damage", "teleport", "other"]);

export const spellDamageSchema = z.object({
  min: z.number().int().nonnegative(),
  max: z.number().int().nonnegative(),
});

export const spellEffectTypeSchema = z.enum([
  "heal",
  "buff",
  "debuff",
  "summon",
  "trap",
  "glyph",
  "state",
  "push",
  "steal",
  "reflect",
]);

export const spellEffectSchema = z.object({
  type: spellEffectTypeSchema,
  amount: spellDamageSchema.optional(),
  value: z.number().int().optional(),
  duration: z.number().int().nonnegative().optional(),
  target: z.enum(["self", "ally", "enemy", "cell", "area"]).optional(),
});

export type Element = z.infer<typeof elementSchema>;
export type SpellKind = z.infer<typeof spellKindSchema>;
export type SpellDamage = z.infer<typeof spellDamageSchema>;
export type SpellEffect = z.infer<typeof spellEffectSchema>;

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;

type SpellFields = {
  id: string;
  kind: SpellKind;
  minRange: number;
  maxRange: number;
  element?: Element | undefined;
  damage?: SpellDamage | undefined;
  effect?: SpellEffect | undefined;
};

type IssueSink = z.RefinementCtx;

function addIssue(ctx: IssueSink, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function checkRanges(spell: SpellFields, ctx: IssueSink): void {
  if (spell.minRange < 0 || spell.minRange > spell.maxRange) {
    addIssue(ctx, ["minRange"], "minRange doit vérifier 0 <= minRange <= maxRange");
  }
}

function checkElement(spell: SpellFields, ctx: IssueSink): void {
  if (spell.kind !== "other" && spell.element === undefined) {
    addIssue(ctx, ["element"], "element est requis sauf pour un sort utilitaire");
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

function needsEffect(spell: SpellFields): boolean {
  return spell.kind === "other" && spell.effect === undefined;
}

function forbidsEffect(spell: SpellFields): boolean {
  return spell.kind === "damage" && spell.effect !== undefined;
}

function checkEffect(spell: SpellFields, ctx: IssueSink): void {
  if (needsEffect(spell)) addIssue(ctx, ["effect"], "un sort utilitaire doit définir effect");
  if (forbidsEffect(spell)) addIssue(ctx, ["effect"], "un sort de dégâts ne peut pas définir effect");
}

export const spellSchema = z
  .object({
    id: z.string().min(1).regex(ID_PATTERN, "id doit être en snake_case"),
    name: z.string().min(1),
    description: z.string().min(1),
    classId: z.string().min(1),
    kind: spellKindSchema,
    element: elementSchema.optional(),
    apCost: z.number().int().min(1),
    minRange: z.number().int().nonnegative(),
    maxRange: z.number().int().nonnegative(),
    requiresLos: z.boolean(),
    damage: spellDamageSchema.optional(),
    pushCells: z.number().int().nonnegative().optional(),
    cooldown: z.number().int().nonnegative().optional(),
    castsPerTurn: z.number().int().min(1).optional(),
    castsPerTarget: z.number().int().min(1).optional(),
    requiresState: z.enum(["drunk"]).optional(),
    effect: spellEffectSchema.optional(),
  })
  .superRefine((spell, ctx) => {
    checkRanges(spell, ctx);
    checkElement(spell, ctx);
    checkDamage(spell, ctx);
    checkTeleport(spell, ctx);
    checkEffect(spell, ctx);
  });

export const spellsFileSchema = z.object({
  spells: z.array(spellSchema).min(1),
});

export type SpellDef = z.infer<typeof spellSchema>;

export function parseSpellsYaml(raw: string): SpellDef[] {
  return spellsFileSchema.parse(yaml.load(raw)).spells;
}
