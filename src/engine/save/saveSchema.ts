import { z } from "zod";
import { MAX_CHARACTERS } from "./types";
import type { HeroSnapshot } from "./types";

const NON_NEGATIVE = "la valeur doit être un entier positif ou nul";
const TOO_MANY_CHARACTERS = `un compte compte au plus ${MAX_CHARACTERS} personnages`;

const nonNegativeInt = () => z.number().int(NON_NEGATIVE).nonnegative(NON_NEGATIVE);

const heroStatsSnapshotSchema = z
  .object({
    vitality: nonNegativeInt(),
    wisdom: nonNegativeInt(),
    strength: nonNegativeInt(),
    intelligence: nonNegativeInt(),
    chance: nonNegativeInt(),
    agility: nonNegativeInt(),
  })
  .strict();

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
    xp: nonNegativeInt(),
    kamas: nonNegativeInt(),
    hp: nonNegativeInt(),
    maxHp: z.number().int(NON_NEGATIVE).positive("les PV maximum doivent valoir au moins 1"),
    ap: nonNegativeInt(),
    mp: nonNegativeInt(),
    capitalPoints: nonNegativeInt(),
    spellPoints: nonNegativeInt(),
    stats: heroStatsSnapshotSchema,
  })
  .strict()
  .superRefine(checkHeroHp);

const itemStackSnapshotSchema = z
  .object({
    itemId: z.string().min(1, "l'identifiant d'objet est requis"),
    quantity: z.number().int("la quantité doit être un entier").positive("la quantité doit valoir au moins 1"),
  })
  .strict();

const inventorySnapshotSchema = z
  .object({
    stacks: z.array(itemStackSnapshotSchema),
    equipment: z.record(z.string(), z.string().min(1, "un emplacement équipé doit référencer un objet")),
  })
  .strict();

const characterPositionSchema = z
  .object({
    mapId: z.string().min(1, "la carte de la dernière position est requise"),
    x: nonNegativeInt(),
    y: nonNegativeInt(),
  })
  .strict();

const characterSnapshotSchema = z
  .object({
    id: z.string().min(1, "l'identifiant du personnage est requis"),
    hero: heroSnapshotSchema,
    inventory: inventorySnapshotSchema,
    position: characterPositionSchema.nullable(),
  })
  .strict();

export const saveDataSchema = z
  .object({
    saveVersion: z
      .number()
      .int("la version de sauvegarde doit être un entier")
      .min(1, "la version de sauvegarde doit valoir au moins 1"),
    savedAt: z.string().datetime("savedAt doit être une date ISO 8601"),
    characters: z.array(characterSnapshotSchema).max(MAX_CHARACTERS, TOO_MANY_CHARACTERS),
    bank: inventorySnapshotSchema,
    flags: z.record(
      z.string(),
      z.boolean({ message: "un drapeau de progression doit être un booléen" }),
    ),
    lastPlayedCharacterId: z.string().min(1, "un identifiant de personnage doit référencer un personnage").nullable(),
  })
  .strict();
