import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import { parseSpritesYaml } from "../../src/schemas/spriteSchema";

const ROOT = process.cwd();
const read = (file: string) => readFileSync(join(ROOT, "data", file), "utf8");

const sprites = parseSpritesYaml(read("sprites.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const zones = parseSpawnsYaml(read("spawns.yaml"));

const spriteIds = new Set(sprites.map((sprite) => sprite.entityId));
const monsterIds = monsters.map((monster) => monster.id);
const spawnIds = [...new Set(zones.flatMap((zone) => zone.monsters.map((entry) => entry.monsterId)))];

/** Les trois monstres que le joueur croise sur la plage de la Ferraille. */
const FERRAILLE_SPRITES = ["fer_rat_de_cale", "fer_crabe_cle_molette", "fer_boulon_pousseur"];

/**
 * Dette assumée : monstres qui n'existent que dans une salle de donjon et dont
 * la feuille n'est pas encore dessinée. Toute autre absence est un oubli.
 * Cette liste ne peut que rétrécir : un id qui reçoit une feuille doit en
 * sortir, sinon le test échoue (cf. « ne laisse pas la dette survivre »).
 */
const SPRITE_PENDING = new Set(["fer_marmite_fuyarde", "fer_boss_yvon_rouiller"]);

const spriteOf = (id: string) => sprites.find((sprite) => sprite.entityId === id);
const sheetOf = (id: string) => join(ROOT, "public", "assets", "sprites", `${id}.svg`);

describe("couverture des feuilles de monstres", () => {
  it("livre une feuille pour les trois monstres de la plage", () => {
    FERRAILLE_SPRITES.forEach((id) => {
      expect(spriteOf(id), `entrée absente de data/sprites.yaml : ${id}`).toBeDefined();
    });
  });

  it("couvre chaque monstre de rencontre d'exploration", () => {
    spawnIds.forEach((id) => {
      expect(spriteIds.has(id), `feuille manquante pour le monstre de rencontre ${id}`).toBe(true);
    });
  });

  it("ne déclare de feuille que pour un monstre réellement présent dans monsters.yaml", () => {
    FERRAILLE_SPRITES.forEach((id) => {
      expect(monsterIds, `data/monsters.yaml ne déclare pas ${id}`).toContain(id);
    });
  });
});

describe("dette de feuilles des monstres de donjon", () => {
  it("exige une feuille pour tout monstre hors dette déclarée", () => {
    const orphans = monsterIds.filter((id) => !spriteIds.has(id) && !SPRITE_PENDING.has(id));
    expect(orphans, "ajoute la silhouette au générateur ou déclare la dette SPRITE_PENDING").toEqual([]);
  });

  it("ne laisse pas la dette survivre à la feuille", () => {
    SPRITE_PENDING.forEach((id) => {
      expect(monsterIds, `${id} doit rester un monstre réel`).toContain(id);
      expect(spriteIds.has(id), `${id} a désormais une feuille : retire-le de SPRITE_PENDING`).toBe(false);
    });
  });
});

describe("bornes et fichiers des feuilles de monstres", () => {
  it("garde les bornes des feuilles existantes", () => {
    FERRAILLE_SPRITES.forEach((id) => {
      const sprite = spriteOf(id);
      expect(sprite?.path, id).toBe(`/assets/sprites/${id}.svg`);
      expect(sprite?.frameWidth, id).toBe(128);
      expect(sprite?.frameHeight, id).toBe(128);
      expect(sprite?.animations.idle, id).toMatchObject({ row: 0, frames: 4, fps: 6, loop: true });
      expect(sprite?.animations.walk, id).toMatchObject({ row: 1, frames: 4, fps: 8, loop: true });
      expect(sprite?.animations.attack, id).toMatchObject({ row: 2, frames: 4, fps: 10, loop: false });
      expect(sprite?.animations.hit, id).toMatchObject({ row: 3, frames: 4, fps: 10, loop: false });
    });
  });

  it("publie un SVG 512 × 512 de 16 frames par feuille de rencontre", () => {
    spawnIds.forEach((id) => {
      const file = sheetOf(id);
      expect(existsSync(file), `SVG généré absent : ${file}`).toBe(true);
      const svg = readFileSync(file, "utf8");
      expect(svg, id).toContain('width="512"');
      expect(svg, id).toContain('height="512"');
      expect(svg.match(/class="frame"/g)?.length, id).toBe(16);
    });
  });
});
