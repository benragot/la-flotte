import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatantState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { heroBattleCombatant, setupDungeonBattle } from "../../src/engine/dungeon/combatants";
import type { AsciiMap } from "../../src/engine/grid";
import { parseAsciiMap } from "../../src/engine/grid";
import type { CombatantLike } from "../../src/engine/multiCombat";
import { buildViewModel } from "../../src/renderer/combatSceneModel";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";
import { sceneOrigin } from "../../src/renderer/gridProjection";
import { SPRITE_SHEETS, knownSpriteId } from "../../src/renderer/spriteManifest";
import type { TokenSprite, TokenView } from "../../src/renderer/tokens";
import { tokensNeedingCircle, tokenView } from "../../src/renderer/tokens";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef, DungeonRoomDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import type { MonsterDef } from "../../src/schemas/monsterSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const zones = parseSpawnsYaml(read("spawns.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const VIEWPORT = { width: 1024, height: 768 };
const INDEX: ReadonlySet<string> = new Set(SPRITE_SHEETS.map((sheet) => sheet.entityId));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

const mustMonster = (id: string): MonsterDef => mustFind(monsters, id);

function mapOf(id: string): AsciiMap {
  return parseAsciiMap(mustFind(maps, id).grid);
}

function heroCombatant(): CombatantLike {
  const combat = initCombat({ map: mapOf("ferraille_plage_01"), hero: createHero("Balthazar", mustFind(classes, "iop")), monster: mustMonster("piou_mazoute"), spells });
  return heroBattleCombatant({ combatant: combat.player });
}

function monsterIds(groups: readonly { monsters: readonly { monsterId: string }[] }[]): string[] {
  const ids = groups.flatMap((group) => group.monsters.map((entry) => entry.monsterId));
  return [...new Set(ids)].sort();
}

const SPAWN_IDS = monsterIds(zones);
const DUNGEON_IDS = monsterIds(dungeons.flatMap((dungeon) => dungeon.rooms));
const ALL_IDS = [...new Set([...SPAWN_IDS, ...DUNGEON_IDS])].sort();
const ROOMS: { dungeon: DungeonDef; room: DungeonRoomDef }[] = dungeons.flatMap((dungeon) =>
  dungeon.rooms.map((room) => ({ dungeon, room })),
);

/** Visible = feuille du manifeste, ou cercle de repli pris en charge par la couche. */
function isDrawn(token: TokenView): boolean {
  const sheetBacked = token.spriteId !== null && INDEX.has(token.spriteId);
  return sheetBacked || tokensNeedingCircle([token], INDEX).includes(token);
}

function explorationToken(monsterId: string): TokenView {
  const spriteId = knownSpriteId(monsterId);
  const exploration = { playerPos: { x: 2, y: 3 }, groups: [{ pos: { x: 5, y: 5 }, label: monsterId, totalLevel: 1, spriteId }] };
  const token = buildExplorationViewModel({ exploration, viewport: VIEWPORT }).tokens[1];
  if (token === undefined) throw new Error(`jeton absent: ${monsterId}`);
  return token;
}

function roomToken(combatant: CombatantLike): TokenView {
  const spriteId = knownSpriteId(combatant.id);
  const sprite: TokenSprite = { spriteId, facing: "left", animation: "idle", animationKey: "static" };
  const state: CombatantState = {
    ...combatant,
    kind: "enemy",
    accuracyPct: 0,
    pp: 0,
    percentDmg: 0,
    spellIds: [...(combatant.spellIds ?? [])],
  };
  return tokenView(state, sceneOrigin({ width: 1, height: 1 }, VIEWPORT), sprite);
}

function roomTokens(room: DungeonRoomDef): TokenView[] {
  const monsterGroups = room.monsters.map((entry) => ({ monster: mustMonster(entry.monsterId), count: entry.count }));
  const setup = setupDungeonBattle({ hero: { combatant: heroCombatant() }, monsters: monsterGroups, map: mapOf(room.mapId) });
  return setup.combatants.filter((combatant) => combatant.side === "enemy").map(roomToken);
}

describe("exploration — chaque monstre de data/spawns.yaml produit un jeton visible", () => {
  it.each(SPAWN_IDS)("%s : feuille connue ou cercle de repli, jamais rien", (monsterId) => {
    const token = explorationToken(monsterId);
    expect(token.spriteId === null || INDEX.has(token.spriteId)).toBe(true);
    expect(isDrawn(token)).toBe(true);
  });
});

describe("combat — chaque monstre des spawns et des donjons produit un jeton visible", () => {
  it.each(ALL_IDS)("%s : les deux jetons sont peints, aucun id de feuille fantôme", (monsterId) => {
    const monster = mustMonster(monsterId);
    const combat = initCombat({ map: mapOf("ferraille_plage_01"), hero: createHero("Balthazar", mustFind(classes, "iop")), monster, spells });
    const view = buildViewModel({ combat, selectedSpellId: null, hoveredCell: null, viewport: VIEWPORT });
    expect(view.tokens).toHaveLength(2);
    const enemy = view.tokens[1];
    expect(enemy?.spriteId === null || INDEX.has(enemy?.spriteId ?? "")).toBe(true);
    view.tokens.forEach((token) => expect(isDrawn(token)).toBe(true));
  });
});

describe("donjon — chaque salle réelle rend un jeton par ennemi", () => {
  it.each(ROOMS.map(({ dungeon, room }) => [`${dungeon.id}#${room.roomNumber}`, room] as const))(
    "salle %s : N ennemis → N jetons visibles",
    (_label, room) => {
      const tokens = roomTokens(room);
      const total = room.monsters.reduce((sum, entry) => sum + entry.count, 0);
      expect(tokens).toHaveLength(total);
      tokens.forEach((token) => expect(isDrawn(token)).toBe(true));
    },
  );
});
