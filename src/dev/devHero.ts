import classesYaml from "../../data/classes.yaml";
import itemsYaml from "../../data/items.yaml";
import progressionYaml from "../../data/progression.yaml";
import type { Hero } from "../engine/createHero";
import { createHero } from "../engine/createHero";
import { applyLevelUp } from "../engine/hero";
import type { InventoryState } from "../engine/inventory";
import { addItem } from "../engine/inventory";
import type { ClassDef } from "../schemas/classSchema";
import { classesFileSchema } from "../schemas/classSchema";
import { itemsFileSchema } from "../schemas/itemSchema";
import { progressionFileSchema } from "../schemas/progressionSchema";
import { emptyInventory } from "../store/gameSelectors";

export interface DevHeroOptions {
  classId?: string;
  level?: number;
  strength?: number;
  keyItemId?: string;
  kamas?: number;
}

export interface DevHeroPayload {
  hero: Hero;
  inventory: InventoryState;
}

interface ResolvedOptions {
  classId: string;
  level: number;
  strength: number;
  keyItemId: string;
  kamas: number;
}

/** Réglage de confort dev : ni règle de jeu, ni donnée métier. */
const DEV_DEFAULTS: ResolvedOptions = {
  classId: "iop",
  level: 20,
  strength: 500,
  keyItemId: "cle_donjon_ile_de_la_ferraille",
  kamas: 50000,
};

const DEV_HERO_NAME = "Moussaillon de test";
const classes = classesFileSchema.parse(classesYaml).classes;
const items = itemsFileSchema.parse(itemsYaml).items;
const progression = progressionFileSchema.parse(progressionYaml);

/** Retire les clés explicitement `undefined` : un appelant peut passer `{ level: undefined }`. */
function withoutUndefined<T extends object>(source: T): T {
  const kept = Object.entries(source).filter(([, value]) => value !== undefined);
  return Object.fromEntries(kept) as T;
}

function resolveOptions(options: DevHeroOptions): ResolvedOptions {
  return { ...DEV_DEFAULTS, ...withoutUndefined(options) };
}

function classDefFor(classId: string): ClassDef {
  const found = classes.find((entry) => entry.id === classId);
  if (found === undefined) throw new Error(`classe inconnue : ${classId}`);
  return found;
}

function xpFor(level: number): number {
  const tier = progression.xpThresholds.find((entry) => entry.level === level);
  if (tier === undefined) throw new Error(`niveau ${level} absent de data/progression.yaml`);
  return tier.xpRequired;
}

/** PV, PA et points de sort passent par la même montée de niveau que le jeu. */
function leveledHero(base: Hero, level: number): Hero {
  const gainRules = progression.gainRules;
  return applyLevelUp({ hero: base, targetLevel: level, gainRules, apRules: progression.apRules }).hero;
}

/** Force offerte, points de capital réputés dépensés : réglage de dev assumé. */
function withDevStats(hero: Hero, resolved: ResolvedOptions): Hero {
  const spent = { strength: resolved.strength, capitalPoints: 0 };
  return { ...hero, ...spent, xp: xpFor(resolved.level), kamas: resolved.kamas };
}

/** La clef entre par `addItem`, jamais en écrivant la structure du sac à la main. */
function keyedInventory(keyItemId: string): InventoryState {
  if (!items.some((item) => item.id === keyItemId)) throw new Error(`item inconnu : ${keyItemId}`);
  return addItem({ inventory: emptyInventory(), itemId: keyItemId, quantity: 1 });
}

/** Héros de test prêt à jouer : mêmes formules que le jeu, sans farm. */
export function buildDevHero(options: DevHeroOptions = {}): DevHeroPayload {
  const resolved = resolveOptions(options);
  const base = createHero(DEV_HERO_NAME, classDefFor(resolved.classId));
  const hero = withDevStats(leveledHero(base, resolved.level), resolved);
  return { hero, inventory: keyedInventory(resolved.keyItemId) };
}
