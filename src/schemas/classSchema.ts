import yaml from "js-yaml";
import { z } from "zod";

export const classSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  basePa: z.number().int().positive(),
  basePm: z.number().int().positive(),
  baseHp: z.number().int().positive(),
  basePp: z.number().int().positive(),
});

export const classesFileSchema = z.object({
  classes: z.array(classSchema).min(1),
});

export type ClassDef = z.infer<typeof classSchema>;

export function parseClassesYaml(raw: string): ClassDef[] {
  const parsed = classesFileSchema.parse(yaml.load(raw));
  return parsed.classes;
}
