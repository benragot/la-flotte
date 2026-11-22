import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { monsterSchema, parseMonstersYaml } from "../../src/schemas/monsterSchema";

const DATA_DIR = join(process.cwd(), "data");
const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");
const monsters = parseMonstersYaml(read("monsters.yaml"));

const baseMonster = {
  id: "monstre_de_test",
  name: "Monstre de test",
  description: "Un monstre qui ne sert qu'à vérifier les bornes du schéma.",
  level: 1,
  hp: 10,
  ap: 3,
  mp: 3,
  stats: { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 },
  resistances: {
    flat: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 },
    percent: { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 },
  },
  baseXp: 10,
};

const FERRAILLE = [
  { id: "fer_rat_de_cale", level: 6, hp: 52, ap: 5, mp: 3, baseXp: 55, kamasMin: 8, kamasMax: 18 },
  { id: "fer_crabe_cle_molette", level: 9, hp: 75, ap: 5, mp: 3, baseXp: 90, kamasMin: 12, kamasMax: 26 },
  { id: "fer_marmite_fuyarde", level: 12, hp: 85, ap: 6, mp: 3, baseXp: 130, kamasMin: 18, kamasMax: 35 },
  { id: "fer_boulon_pousseur", level: 15, hp: 105, ap: 6, mp: 3, baseXp: 185, kamasMin: 24, kamasMax: 45 },
  { id: "fer_boss_yvon_rouiller", level: 20, hp: 140, ap: 6, mp: 4, baseXp: 480, kamasMin: 85, kamasMax: 140 },
];

const monsterById = (id: string) => monsters.find((entry) => entry.id === id);

describe("bestiaire de la Ferraille", () => {
  it("ajoute les cinq monstres de la fiche", () => {
    FERRAILLE.forEach((expected) => expect(monsterById(expected.id), expected.id).toBeDefined());
  });

  it("respecte les valeurs exactes de niveau, PV, PA/PM, XP et kamas", () => {
    FERRAILLE.forEach((expected) => {
      expect(monsterById(expected.id), expected.id).toMatchObject(expected);
    });
  });

  it("conserve piou_mazoute tel quel", () => {
    expect(monsterById("piou_mazoute")).toMatchObject({
      level: 1,
      hp: 35,
      ap: 6,
      mp: 3,
      baseXp: 120,
      spellIds: ["bec_mazoute"],
    });
    expect(monsterById("piou_mazoute")?.loot).toHaveLength(1);
  });
});

describe("bestiaire — faiblesses, boss et IA", () => {
  it("accepte les résistances négatives de la fiche", () => {
    expect(monsterById("fer_rat_de_cale")?.resistances.percent).toMatchObject({ fire: -5, air: -5 });
    expect(monsterById("fer_crabe_cle_molette")?.resistances.percent.fire).toBe(-10);
    expect(monsterById("fer_marmite_fuyarde")?.resistances.percent.water).toBe(-10);
    expect(monsterById("fer_boulon_pousseur")?.resistances.percent.water).toBe(-5);
    expect(monsterById("fer_boss_yvon_rouiller")?.resistances.percent.water).toBe(-10);
  });

  it("déclare Yvon comme unique boss, avec sa mécanique", () => {
    const bosses = monsters.filter((monster) => monster.isBoss).map((monster) => monster.id);
    expect(bosses).toEqual(["fer_boss_yvon_rouiller"]);
    expect(monsterById("fer_boss_yvon_rouiller")?.ai?.bossMechanic).toMatch(/Carapace Oxydée/);
  });

  it("documente l'archétype IA et trois règles par monstre", () => {
    const aiOf = (id: string) => monsterById(id)?.ai;
    expect(aiOf("fer_rat_de_cale")?.archetype).toBe("melee_rusher");
    expect(aiOf("fer_crabe_cle_molette")?.archetype).toBe("tank_tackler");
    expect(aiOf("fer_marmite_fuyarde")?.archetype).toBe("support_healer");
    expect(aiOf("fer_boulon_pousseur")?.archetype).toBe("pusher_control");
    expect(aiOf("fer_boss_yvon_rouiller")?.archetype).toBe("boss_custom");
    FERRAILLE.forEach((expected) => expect(aiOf(expected.id)?.behaviorRules).toHaveLength(3));
  });
});

describe("bornes du monsterSchema", () => {
  const withPercent = (water: number) => ({
    ...baseMonster,
    resistances: { ...baseMonster.resistances, percent: { ...baseMonster.resistances.percent, water } },
  });

  it("accepte une faiblesse et une résistance extrêmes dans ±100", () => {
    expect(monsterSchema.parse(withPercent(-100)).resistances.percent.water).toBe(-100);
    expect(monsterSchema.parse(withPercent(100)).resistances.percent.water).toBe(100);
  });

  it("refuse une résistance sous -100 et au-dessus de 100", () => {
    expect(() => monsterSchema.parse(withPercent(-101))).toThrow(/résistance/);
    expect(() => monsterSchema.parse(withPercent(101))).toThrow(/résistance/);
  });

  it("accepte un monstre sans spellIds ni loot, en attendant la vague 6A", () => {
    const parsed = monsterSchema.parse(baseMonster);
    expect(parsed.spellIds).toEqual([]);
    expect(parsed.loot).toEqual([]);
    expect(parsed.isBoss).toBe(false);
  });

  it("refuse un intervalle de kamas inversé", () => {
    const greedy = { ...baseMonster, kamasMin: 20, kamasMax: 5 };
    expect(() => monsterSchema.parse(greedy)).toThrow(/kamasMax/);
  });
});
