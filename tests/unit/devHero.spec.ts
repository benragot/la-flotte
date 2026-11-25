import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DevHeroPayload } from "../../src/dev/devHero";
import { buildDevHero } from "../../src/dev/devHero";
import { countItem } from "../../src/engine/inventory";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";

const KEY_ID = "cle_donjon_ile_de_la_ferraille";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

const iop = (): ClassDef => mustFind(classes, "iop");

function xpOf(level: number): number {
  const tier = progression.xpThresholds.find((entry) => entry.level === level);
  if (tier === undefined) throw new Error(`niveau ${level} absent de data/progression.yaml`);
  return tier.xpRequired;
}

function expectedMaxHp(classDef: ClassDef, level: number): number {
  return classDef.baseHp + progression.gainRules.hp * (level - 1);
}

function stackOf(payload: DevHeroPayload, itemId: string) {
  return payload.inventory.stacks.find((stack) => stack.itemId === itemId);
}

describe("buildDevHero — réglages par défaut", () => {
  it("crée par défaut un héros de niveau 20, force 500, 50 000 kamas", () => {
    const { hero } = buildDevHero();
    expect(hero.level).toBe(20);
    expect(hero.strength).toBe(500);
    expect(hero.kamas).toBe(50000);
    expect(hero.capitalPoints).toBe(0);
  });

  it("respecte l'identité de classe par défaut (Iop)", () => {
    const { hero } = buildDevHero();
    expect(hero.classId).toBe("iop");
    expect(hero.className).toBe("Iop");
    expect(hero.name.length).toBeGreaterThan(0);
  });
});

describe("buildDevHero — formules du jeu", () => {
  it("applique la formule de PV et les ressources de la classe", () => {
    const { hero } = buildDevHero();
    const classDef = iop();
    expect(hero.maxHp).toBe(expectedMaxHp(classDef, 20));
    expect(hero.hp).toBe(hero.maxHp);
    expect(hero.ap).toBe(classDef.basePa);
    expect(hero.mp).toBe(classDef.basePm);
    expect(hero.pp).toBe(classDef.basePp);
  });

  it("cale l'XP sur le seuil du niveau atteint", () => {
    expect(buildDevHero().hero.xp).toBe(xpOf(20));
    expect(buildDevHero({ level: 30 }).hero.xp).toBe(xpOf(30));
  });

  it("accepte des options de niveau, force, kamas et classe", () => {
    const { hero } = buildDevHero({ classId: "enutrof", level: 30, strength: 300, kamas: 1000 });
    const classDef = mustFind(classes, "enutrof");
    expect(hero.classId).toBe("enutrof");
    expect(hero.level).toBe(30);
    expect(hero.strength).toBe(300);
    expect(hero.maxHp).toBe(expectedMaxHp(classDef, 30));
    expect(hero.kamas).toBe(1000);
  });
});

describe("buildDevHero — inventaire", () => {
  it("glisse la clef du donjon dans l'inventaire, en un exemplaire", () => {
    const payload = buildDevHero();
    expect(countItem(payload.inventory, KEY_ID)).toBe(1);
    expect(stackOf(payload, KEY_ID)?.quantity).toBe(1);
  });

  it("rend un inventaire légal pour le niveau : aucun objet hors catalogue", () => {
    const payload = buildDevHero();
    const known = new Set(items.map((item) => item.id));
    const unknown = payload.inventory.stacks.filter((stack) => !known.has(stack.itemId));
    expect(unknown).toEqual([]);
    expect(payload.inventory.equipment).toEqual({});
  });

  it("la clef est bien l'objet `key` du donjon de la Ferraille", () => {
    const key = items.find((entry) => entry.id === KEY_ID);
    if (key === undefined || key.category !== "key") throw new Error(`${KEY_ID} n'est pas une clef`);
    expect(key.targetDungeonId).toBe("fer_donjon_casse_vis_sans_fin");
  });
});

describe("buildDevHero — pureté et refus", () => {
  it("rend des objets neufs à chaque appel (aucun état partagé)", () => {
    const first = buildDevHero();
    const second = buildDevHero();
    expect(first.hero).not.toBe(second.hero);
    expect(first.inventory).not.toBe(second.inventory);
    expect(second.hero.strength).toBe(500);
  });

  it("refuse une classe absente de data/classes.yaml", () => {
    expect(() => buildDevHero({ classId: "necromancien" })).toThrow(/classe inconnue/);
  });

  it("refuse une clef absente de data/items.yaml", () => {
    expect(() => buildDevHero({ keyItemId: "clef_imaginaire" })).toThrow(/item inconnu/);
  });

  it("refuse un niveau absent de la table d'XP", () => {
    expect(() => buildDevHero({ level: 99 })).toThrow(/niveau 99/);
  });
});
