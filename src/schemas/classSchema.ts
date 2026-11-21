import yaml from "js-yaml";
import { z } from "zod";

export const softCapTuple = z.tuple([
  z.number().int().positive().nullable(),
  z.number().int().positive(),
]);

export const softCapsSchema = z.object({
  vitality: z.array(softCapTuple).min(1),
  wisdom: z.array(softCapTuple).min(1),
  strength: z.array(softCapTuple).min(1),
  intelligence: z.array(softCapTuple).min(1),
  chance: z.array(softCapTuple).min(1),
  agility: z.array(softCapTuple).min(1),
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
