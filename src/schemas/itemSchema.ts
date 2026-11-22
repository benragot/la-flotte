import yaml from "js-yaml";
import { z } from "zod";

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SET_SLOTS = new Set<string>(["hat", "cloak", "amulet", "boots"]);

export const itemIdSchema = z
  .string()
  .min(1)
  .regex(ID_PATTERN, "id doit être en snake_case");

export const EQUIPMENT_SLOTS = [
  "hat",
  "cloak",
  "weapon",
  "amulet",
  "ring1",
  "ring2",
  "belt",
  "boots",
] as const;

export const equipmentSlotSchema = z.enum(EQUIPMENT_SLOTS, {
  errorMap: () => ({ message: "slot inconnu, voir EQUIPMENT_SLOTS" }),
});

export const itemStatsSchema = z.object({
  vitality: z.number().int().optional(),
  wisdom: z.number().int().optional(),
  strength: z.number().int().optional(),
  intelligence: z.number().int().optional(),
  chance: z.number().int().optional(),
  agility: z.number().int().optional(),
  hp: z.number().int().optional(),
  ap: z.number().int().optional(),
  mp: z.number().int().optional(),
  percentDmg: z.number().int().optional(),
  flatRes: z.number().int().optional(),
  percentRes: z.number().int().optional(),
  prospection: z.number().int().optional(),
});

const itemCoreFields = {
  id: itemIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  sellPrice: z.number().int().nonnegative(),
};

const resourceItemSchema = z.object({
  ...itemCoreFields,
  category: z.literal("resource"),
});

const consumableItemSchema = z.object({
  ...itemCoreFields,
  category: z.literal("consumable"),
  heal: z.number().int(),
  price: z.number().int().positive().optional(),
});

const equipmentItemSchema = z.object({
  ...itemCoreFields,
  category: z.literal("equipment"),
  slot: equipmentSlotSchema,
  setId: itemIdSchema.optional(),
  level: z.number().int(),
  stats: itemStatsSchema,
  starting: z.boolean().optional().default(false),
});

const keyItemSchema = z.object({
  ...itemCoreFields,
  category: z.literal("key"),
  targetDungeonId: itemIdSchema,
});

const itemUnionSchema = z.discriminatedUnion("category", [
  resourceItemSchema,
  consumableItemSchema,
  equipmentItemSchema,
  keyItemSchema,
]);

export type ItemDef = z.infer<typeof itemUnionSchema>;
export type ItemStats = z.infer<typeof itemStatsSchema>;
export type EquipmentSlot = z.infer<typeof equipmentSlotSchema>;
export type ResourceDef = z.infer<typeof resourceItemSchema>;
export type ConsumableDef = z.infer<typeof consumableItemSchema>;
export type EquipmentDef = z.infer<typeof equipmentItemSchema>;
export type KeyDef = z.infer<typeof keyItemSchema>;

type IssueSink = z.RefinementCtx;
type IssuePath = (string | number)[];

function addIssue(ctx: IssueSink, path: IssuePath, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function checkConsumable(item: ItemDef, ctx: IssueSink): void {
  if (item.category !== "consumable" || item.heal > 0) return;
  addIssue(ctx, ["heal"], "heal doit être strictement positif");
}

function checkSetSlot(item: EquipmentDef, ctx: IssueSink): void {
  if (item.setId === undefined || SET_SLOTS.has(item.slot)) return;
  addIssue(ctx, ["slot"], "une pièce de panoplie ne peut occuper que hat, cloak, amulet ou boots");
}

function checkEquipment(item: ItemDef, ctx: IssueSink): void {
  if (item.category !== "equipment") return;
  if (item.level < 1) addIssue(ctx, ["level"], "level doit être au moins 1");
  if (Object.keys(item.stats).length === 0) addIssue(ctx, ["stats"], "stats doit contenir au moins une valeur");
  checkSetSlot(item, ctx);
}

function checkItem(item: ItemDef, ctx: IssueSink): void {
  checkConsumable(item, ctx);
  checkEquipment(item, ctx);
}

export const itemSchema = itemUnionSchema.superRefine(checkItem);

function collectIds(items: readonly ItemDef[]): string[] {
  return items.map((item) => item.id);
}

export const itemsFileSchema = z
  .object({ items: z.array(itemSchema).min(1) })
  .superRefine((file, ctx) => checkUniqueIds(collectIds(file.items), ctx, "items"));

export function parseItemsYaml(raw: string): ItemDef[] {
  return itemsFileSchema.parse(yaml.load(raw)).items;
}

export function checkUniqueIds(ids: readonly string[], ctx: IssueSink, label: string): void {
  ids.forEach((id, index) => {
    if (ids.indexOf(id) !== index) addIssue(ctx, [label], `id dupliqué: ${id}`);
  });
}
