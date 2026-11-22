import yaml from "js-yaml";
import { z } from "zod";
import { checkUniqueIds } from "./itemSchema";

const ID_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const SNAKE_CASE_MESSAGE = "doit être en snake_case";

const idSchema = z.string().min(1).regex(ID_PATTERN, SNAKE_CASE_MESSAGE);

const roomMonsterSchema = z
  .object({
    monsterId: idSchema,
    count: z.number().int().positive(),
  })
  .strict();

const dungeonRoomSchema = z
  .object({
    roomNumber: z.number().int().positive(),
    name: z.string().min(1),
    mapId: idSchema,
    isBossRoom: z.boolean().default(false),
    /**
     * DEC-03 : facteur appliqué aux PV **de référence** (`data/monsters.yaml`)
     * de tous les monstres de la salle, via `Math.floor` dans
     * `engine/dungeon/combatants`. Il ne touche ni dégâts, ni PA/PM, ni portée,
     * ni drop : la menace de la salle reste celle du monde ouvert.
     * Bornes : 0,05 = 5 % — en dessous, `floor` rapproche les PV de zéro et la
     * salle n'est plus un combat ; 3 = plafond de sécurité, une salle ne doit
     * pas peser plus du triple de son monde ouvert. `default(1)` = neutre.
     */
    hpScale: z.number().min(0.05).max(3).default(1),
    monsters: z.array(roomMonsterSchema).min(1),
  })
  .strict();

type Rooms = readonly z.infer<typeof dungeonRoomSchema>[];
type IssueSink = z.RefinementCtx;
type IssuePath = (string | number)[];

function addIssue(ctx: IssueSink, path: IssuePath, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });
}

function checkRoomNumbers(rooms: Rooms, ctx: IssueSink): void {
  rooms.forEach((room, index) => {
    if (room.roomNumber === index + 1) return;
    addIssue(ctx, ["rooms", index, "roomNumber"], "roomNumber doit être consécutif à partir de 1");
  });
}

function hasSingleBoss(rooms: Rooms, ctx: IssueSink): boolean {
  const bosses = rooms.filter((room) => room.isBossRoom);
  if (bosses.length === 1) return true;
  addIssue(ctx, ["rooms"], "exactement une boss room est attendue");
  return false;
}

function checkBossRoom(rooms: Rooms, ctx: IssueSink): void {
  if (!hasSingleBoss(rooms, ctx)) return;
  const last = rooms[rooms.length - 1];
  if (last?.isBossRoom === true) return;
  addIssue(ctx, ["rooms"], "la dernière salle doit être la boss room");
}

const dungeonFieldsSchema = z
  .object({
    id: idSchema,
    name: z.string().min(1),
    recommendedLevel: z.number().int().positive(),
    keyItemId: z.string().min(1, "keyItemId doit être non vide").regex(ID_PATTERN, SNAKE_CASE_MESSAGE),
    /**
     * DEC-03 : part du pool EFFECTIF rendue au franchissement d'une salle
     * (0 = aucun soin, 1 = retour au maximum). Le `default(0)` n'est pas un
     * réglage métier : c'est le neutre pour un donjon qui omet le champ. Le ratio
     * réellement joué vit dans `data/dungeons.yaml`.
     */
    healBetweenRooms: z.number().min(0).max(1).default(0),
    rooms: z.array(dungeonRoomSchema).min(1),
  })
  .strict();

export const dungeonSchema = dungeonFieldsSchema.superRefine((dungeon, ctx) => {
  checkRoomNumbers(dungeon.rooms, ctx);
  checkBossRoom(dungeon.rooms, ctx);
});

function collectIds(dungeons: readonly DungeonDef[]): string[] {
  return dungeons.map((dungeon) => dungeon.id);
}

export const dungeonsFileSchema = z
  .object({ dungeons: z.array(dungeonSchema).min(1) })
  .superRefine((file, ctx) => checkUniqueIds(collectIds(file.dungeons), ctx, "dungeons"));

export type DungeonRoomDef = z.infer<typeof dungeonRoomSchema>;
export type DungeonMonsterGroup = z.infer<typeof roomMonsterSchema>;
export type DungeonDef = z.infer<typeof dungeonSchema>;

export function parseDungeonsYaml(raw: string): DungeonDef[] {
  return dungeonsFileSchema.parse(yaml.load(raw)).dungeons;
}
