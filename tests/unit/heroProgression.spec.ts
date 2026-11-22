import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { Hero } from "../../src/engine/createHero";
import { createHero } from "../../src/engine/createHero";
import { computeLevelFromXp } from "../../src/engine/economy";
import { parseAsciiMap } from "../../src/engine/grid";
import { applyLevelUp } from "../../src/engine/hero/applyLevelUp";
import { heroCombatStats } from "../../src/engine/hero/combatStats";
import { gainXp } from "../../src/engine/hero/gainXp";
import { spendCapitalPoints } from "../../src/engine/hero/spendCapitalPoints";
import type { ClassDef } from "../../src/schemas/classSchema";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml, progressionFileSchema } from "../../src/schemas/progressionSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const progression = parseProgressionYaml(read("progression.yaml"));
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const tiers = progression.xpThresholds;
const AP_RULES = progression.apRules;
const GAIN_RULES = { hp: 5, capitalPoints: 5, spellPoints: 1 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

const findClass = (id: string): ClassDef => mustFind(classes, id);
const findSpell = (id: string): SpellDef => mustFind(spells, id);
const freshHero = (): Hero => createHero("Balthazar", findClass("iop"));

describe("computeLevelFromXp : table 1.29 exacte", () => {
  it("place 649 XP au niveau 2 et 650 XP au niveau 3", () => {
    expect(computeLevelFromXp(649, tiers)).toBe(2);
    expect(computeLevelFromXp(650, tiers)).toBe(3);
  });

  it("atteint le niveau 49 juste avant le palier 50", () => {
    expect(computeLevelFromXp(5_349_999, tiers)).toBe(49);
    expect(computeLevelFromXp(5_350_000, tiers)).toBe(50);
  });

  it("clampe l'XP nulle ou négative au niveau 1", () => {
    expect(computeLevelFromXp(0, tiers)).toBe(1);
    expect(computeLevelFromXp(-1, tiers)).toBe(1);
  });
});

describe("progressionSchema : courbe longue acceptée", () => {
  it("accepte la table réelle de 50 paliers", () => {
    expect(progression.xpThresholds.length).toBe(50);
  });

  it("rejette une XP non strictement croissante", () => {
    const broken = { ...progression, xpThresholds: [{ level: 1, xpRequired: 0 }, { level: 2, xpRequired: 0 }] };
    expect(() => progressionFileSchema.parse(broken)).toThrow();
  });

  it("rejette des niveaux non consécutifs", () => {
    const broken = { ...progression, xpThresholds: [{ level: 1, xpRequired: 0 }, { level: 3, xpRequired: 10 }] };
    expect(() => progressionFileSchema.parse(broken)).toThrow();
  });

  it("rejette une table à un seul palier", () => {
    const broken = { ...progression, xpThresholds: [{ level: 1, xpRequired: 0 }] };
    expect(() => progressionFileSchema.parse(broken)).toThrow();
  });
});

describe("createHero : champs persistants", () => {
  it("initialise XP, kamas, capital et points de sort à zéro", () => {
    expect(freshHero()).toMatchObject({
      xp: 0,
      kamas: 0,
      capitalPoints: 0,
      spellPoints: 0,
    });
  });

  it("initialise les six caractéristiques à zéro", () => {
    const hero = freshHero();
    expect([hero.vitality, hero.wisdom, hero.strength, hero.intelligence, hero.chance, hero.agility]).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
  });

  it("conserve les stats de classe au niveau 1", () => {
    const iop = findClass("iop");
    const hero = freshHero();
    expect(hero.maxHp).toBe(iop.baseHp);
    expect(hero.ap).toBe(iop.basePa);
  });
});

describe("applyLevelUp", () => {
  it("applique les gains du niveau 1 au niveau 2", () => {
    const { hero, applied } = applyLevelUp({ hero: freshHero(), targetLevel: 2, gainRules: GAIN_RULES, apRules: AP_RULES });
    expect(hero.maxHp).toBe(55);
    expect(hero.hp).toBe(55);
    expect(hero.capitalPoints).toBe(5);
    expect(hero.spellPoints).toBe(1);
    expect(applied).toHaveLength(1);
  });

  it("empile les gains jusqu'au niveau 100 et recalcule les PA", () => {
    const { hero } = applyLevelUp({ hero: freshHero(), targetLevel: 100, gainRules: GAIN_RULES, apRules: AP_RULES });
    expect(hero.level).toBe(100);
    expect(hero.ap).toBe(7);
    expect(hero.capitalPoints).toBe(5 * 99);
  });

  it("ne retrograde jamais un héros déjà plus haut", () => {
    const hero = freshHero();
    expect(applyLevelUp({ hero, targetLevel: 1, gainRules: GAIN_RULES, apRules: AP_RULES }).hero).toBe(hero);
  });
});

describe("gainXp", () => {
  it("reste au niveau 1 juste avant le palier et monte au niveau 2 pile dessus", () => {
    expect(gainXp({ hero: freshHero(), amount: 109, tiers, apRules: AP_RULES, gainRules: GAIN_RULES }).hero.level).toBe(1);
    const levelTwo = gainXp({ hero: freshHero(), amount: 110, tiers, apRules: AP_RULES, gainRules: GAIN_RULES });
    expect(levelTwo.hero.level).toBe(2);
    expect(levelTwo.hero.xp).toBe(110);
    expect(levelTwo.levelsGained).toBe(1);
  });

  it("renvoie la même référence pour un gain nul ou négatif", () => {
    const hero = freshHero();
    expect(gainXp({ hero, amount: 0, tiers, apRules: AP_RULES, gainRules: GAIN_RULES }).hero).toBe(hero);
    expect(gainXp({ hero, amount: -5, tiers, apRules: AP_RULES, gainRules: GAIN_RULES }).hero).toBe(hero);
  });

  it("ne mute pas le héros d'entrée", () => {
    const hero = freshHero();
    const before = structuredClone(hero);
    gainXp({ hero, amount: 60_000, tiers, apRules: AP_RULES, gainRules: GAIN_RULES });
    expect(hero).toEqual(before);
  });
});

describe("spendCapitalPoints", () => {
  it("dépense 3 points Iop pour passer de 99 à 101 de Force", () => {
    const iop = findClass("iop");
    const hero = { ...createHero("Balthazar", iop), strength: 99, capitalPoints: 3 };
    const { hero: spent, result } = spendCapitalPoints({ hero, stat: "strength", points: 3, classDef: iop });
    expect(spent.strength).toBe(101);
    expect(spent.capitalPoints).toBe(0);
    expect(result.remaining).toBe(0);
  });

  it("applique le taux Sagesse 3 pour 1", () => {
    const iop = findClass("iop");
    const hero = { ...createHero("Balthazar", iop), capitalPoints: 3 };
    const { hero: spent } = spendCapitalPoints({ hero, stat: "wisdom", points: 3, classDef: iop });
    expect(spent.wisdom).toBe(1);
    expect(spent.capitalPoints).toBe(0);
  });

  it("double le gain de vitalité d'un Sacrieur", () => {
    const sacrieur = findClass("sacrieur");
    const hero = { ...createHero("Sacha", sacrieur), capitalPoints: 3 };
    const { hero: spent } = spendCapitalPoints({ hero, stat: "vitality", points: 1, classDef: sacrieur });
    expect(spent.vitality).toBe(2);
  });

  it("refuse de dépenser des points indisponibles", () => {
    const iop = findClass("iop");
    const hero = createHero("Balthazar", iop);
    const { hero: refused, result } = spendCapitalPoints({ hero, stat: "strength", points: 3, classDef: iop });
    expect(refused).toBe(hero);
    expect(result.spent).toBe(0);
  });
});

describe("heroCombatStats", () => {
  it("projette les caractéristiques du héros vers CombatantState", () => {
    const hero = { ...freshHero(), strength: 12, intelligence: 3, chance: 4, agility: 5, wisdom: 6 };
    expect(heroCombatStats(hero)).toEqual({ strength: 12, intelligence: 3, chance: 4, agility: 5, wisdom: 6 });
  });
});

describe("data/spells.yaml : trois sorts par classe", () => {
  const OTHER_CLASSES = [
    "feca", "osamodas", "enutrof", "sram", "xelor", "ecaflip", "eniripsa", "cra", "sadida", "sacrieur", "pandawa",
  ];

  it("ajoute exactement trois sorts à chacune des 11 classes non-Iop", () => {
    OTHER_CLASSES.forEach((classId) => {
      expect(spells.filter((spell) => spell.classId === classId)).toHaveLength(3);
    });
  });

  it("garde des identifiants et des descriptions uniques", () => {
    expect(new Set(spells.map((spell) => spell.id)).size).toBe(spells.length);
    expect(new Set(spells.map((spell) => spell.description)).size).toBe(spells.length);
  });

  it("modélise les effets utilitaires sans les jouer", () => {
    expect(findSpell("picole").effect?.type).toBe("state");
    expect(findSpell("gueule_de_bois").requiresState).toBe("drunk");
    expect(findSpell("attirance").effect?.value).toBe(-2);
    expect(findSpell("mot_curatif").effect?.amount).toEqual({ min: 5, max: 11 });
    expect(findSpell("fleche_de_recul").pushCells).toBe(3);
  });

  it("accepte les sorts sur soi-même à portée 0", () => {
    expect(findSpell("armure_terrestre")).toMatchObject({ minRange: 0, maxRange: 0 });
    expect(findSpell("mot_curatif").effect?.target).toBe("self");
  });
});

describe("garde kind other du moteur", () => {
  const buildState = () =>
    initCombat({
      map: parseAsciiMap(["P.M.", "...."]),
      hero: freshHero(),
      monster: mustFind(monsters, "piou_mazoute"),
      spells,
    });

  it("ne propose aucune case castable pour un sort utilitaire", () => {
    expect(getCastableCells(buildState(), "picole")).toEqual([]);
  });

  it("renvoie l'état d'entrée par identité", () => {
    const state = buildState();
    expect(castSpell({ state, spellId: "picole", target: { x: 1, y: 0 }, rng: () => 0 })).toBe(state);
  });
});
