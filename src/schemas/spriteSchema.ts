import yaml from "js-yaml";
import { z } from "zod";
import { checkUniqueIds } from "./itemSchema";

/** Format imposé des feuilles générées : 512 × 512, cellules 4 × 4 de 128 × 128 (2×). */
export const SPRITE_FRAME_SIZE = 128;
/** Les quatre animations d'une feuille, dans l'ordre des lignes. */
export const SPRITE_ANIMATIONS = ["idle", "walk", "attack", "hit"] as const;

const SPRITE_ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SPRITE_PATH_PREFIX = "/assets/sprites/";
const SPRITE_PATH_SUFFIX = ".svg";

const animationRowSchema = z.number().int().min(0).max(3);

const animationSchema = z.object({
  row: animationRowSchema,
  frames: z.number().int().min(1),
  fps: z.number().positive(),
  loop: z.boolean(),
});

const animationsSchema = z
  .object({
    idle: animationSchema,
    walk: animationSchema,
    attack: animationSchema,
    hit: animationSchema,
  })
  .strict();

const spriteIdSchema = z
  .string()
  .min(1)
  .regex(SPRITE_ID_PATTERN, "entityId doit être en snake_case");

const spriteCoreSchema = z.object({
  entityId: spriteIdSchema,
  path: z.string().min(1),
  frameWidth: z.number().int().positive(),
  frameHeight: z.number().int().positive(),
  animations: animationsSchema,
});

export type SpriteDef = z.infer<typeof spriteCoreSchema>;
export type SpriteAnimation = z.infer<typeof animationSchema>;

type IssueSink = z.RefinementCtx;

function addIssue(ctx: IssueSink, path: (string | number)[], message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
}

function checkFrameSize(sprite: SpriteDef, ctx: IssueSink): void {
  const expected = String(SPRITE_FRAME_SIZE);
  if (sprite.frameWidth !== SPRITE_FRAME_SIZE) addIssue(ctx, ["frameWidth"], `frameWidth doit valoir ${expected}`);
  if (sprite.frameHeight !== SPRITE_FRAME_SIZE) addIssue(ctx, ["frameHeight"], `frameHeight doit valoir ${expected}`);
}

function checkPath(sprite: SpriteDef, ctx: IssueSink): void {
  const valid = sprite.path.startsWith(SPRITE_PATH_PREFIX) && sprite.path.endsWith(SPRITE_PATH_SUFFIX);
  if (!valid) addIssue(ctx, ["path"], "path doit commencer par /assets/sprites/ et finir par .svg");
}

function animationRows(sprite: SpriteDef): number[] {
  return SPRITE_ANIMATIONS.map((name) => sprite.animations[name].row);
}

function checkRows(sprite: SpriteDef, ctx: IssueSink): void {
  const rows = animationRows(sprite);
  const unique = rows.every((row, index) => rows.indexOf(row) === index);
  if (!unique) addIssue(ctx, ["animations"], "chaque animation doit occuper une ligne distincte (0..3)");
}

function checkSprite(sprite: SpriteDef, ctx: IssueSink): void {
  checkFrameSize(sprite, ctx);
  checkPath(sprite, ctx);
  checkRows(sprite, ctx);
}

export const spriteSchema = spriteCoreSchema.superRefine(checkSprite);

function spriteIds(sprites: readonly SpriteDef[]): string[] {
  return sprites.map((sprite) => sprite.entityId);
}

export const spritesFileSchema = z
  .object({ sprites: z.array(spriteSchema).min(1) })
  .superRefine((file, ctx) => checkUniqueIds(spriteIds(file.sprites), ctx, "sprites"));

export function parseSpritesYaml(raw: string): SpriteDef[] {
  return spritesFileSchema.parse(yaml.load(raw)).sprites;
}
