import { z } from "zod";
import type { HeroSnapshot } from "./types";

const NON_NEGATIVE = "la valeur doit être un entier positif ou nul";

const heroStatsSnapshotSchema = z.object({
  vitality: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
  wisdom: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
  strength: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
  intelligence: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
  chance: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
  agility: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
});

function checkHeroHp(hero: HeroSnapshot, ctx: z.RefinementCtx): void {
  if (hero.hp > hero.maxHp) {
    const path = ["hp"];
    const message = "les PV courants ne peuvent pas dépasser les PV maximum";
    ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
  }
}

const heroSnapshotSchema = z
  .object({
    name: z.string().min(1, "le nom du héros est requis"),
    classId: z.string().min(1, "la classe du héros est requise"),
    level: z.number().int("le niveau doit être un entier").positive("le niveau doit valoir au moins 1"),
    xp: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
    kamas: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
    hp: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
    maxHp: z.number().int(NON_NEGATIVE).positive("les PV maximum doivent valoir au moins 1"),
    ap: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
    mp: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
    capitalPoints: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
    spellPoints: z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE),
    stats: heroStatsSnapshotSchema,
  })
  .superRefine(checkHeroHp);

const itemStackSnapshotSchema = z.object({
  itemId: z.string().min(1, "l'identifiant d'objet est requis"),
  quantity: z.number().int("la quantité doit être un entier").positive("la quantité doit valoir au moins 1"),
});

const inventorySnapshotSchema = z.object({
  stacks: z.array(itemStackSnapshotSchema),
  equipment: z.record(z.string(), z.string().min(1, "un emplacement équipé doit référencer un objet")),
});

export const saveDataSchema = z.object({
  saveVersion: z
    .number()
    .int("la version de sauvegarde doit être un entier")
    .min(1, "la version de sauvegarde doit valoir au moins 1"),
  savedAt: z.string().datetime("savedAt doit être une date ISO 8601"),
  hero: heroSnapshotSchema,
  inventory: inventorySnapshotSchema,
  flags: z.record(
    z.string(),
    z.boolean({ message: "un drapeau de progression doit être un booléen" }),
  ),
});
