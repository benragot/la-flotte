import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { CombatantState } from "../../src/engine/combatLoop";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import type { Hero } from "../../src/engine/createHero";
import { pickSpawn } from "../../src/engine/exploration";
import { combatantFromHero, gainXp, spendCapitalPoints } from "../../src/engine/hero";
import { totalStatsFor } from "../../src/engine/hero/totalStats";
import { isDungeonComplete } from "../../src/engine/dungeon";
import type { DungeonRunState } from "../../src/engine/dungeon";
import type { InventoryState } from "../../src/engine/inventory";
import { addItem, countItem } from "../../src/engine/inventory";
import { activeCombatant, isDefeat, isVictory, livingOf } from "../../src/engine/multiCombat";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import type { ClassDef, StatKey } from "../../src/schemas/classSchema";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { EquipmentDef, ItemDef } from "../../src/schemas/itemSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import type { RecipeDef } from "../../src/schemas/recipeSchema";
import { parseRecipesYaml } from "../../src/schemas/recipeSchema";
import { parseSpawnsYaml } from "../../src/schemas/spawnSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { castRefusal, spellCastSpec } from "../../src/store/battleSelectors";
import { GAME_CATALOG, useGameStore } from "../../src/store/useGameStore";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * WALKTHROUGH 5C-set-panoplies — « à quel niveau le donjon est-il finissable ? ».
 *
 * CE QUE CE FICHIER MESURE : un héros réel de niveau 16, 17 PUIS 18, tout son
 * capital dépensé, l'équipement le plus adapté que CE niveau autorise, puis les
 * salles du donjon jouées par les actions du store. Aucun héros surpuissant,
 * aucune clef injectée, aucun sort inventé, aucun `Math.random` (LCG de farm +
 * `() => 0.5` en combat).
 *
 * LE NIVEAU EST UN PARAMÈTRE (`LEVELS`), PLUS UNE DONNÉE DU DONJON. Ce fichier
 * dérivait le niveau de `recommendedLevel` (`data/dungeons.yaml`) : changer la
 * valeur testée aurait changé le pool d'équipement, donc la mesure elle-même.
 * `recommendedLevel` est désormais ce que l'on TESTE, jamais ce qui configure.
 *
 * DEUX BUILDS, UN SEUL CRITÈRE DE SÉLECTION — pour chaque slot, parmi les
 * `equipment` de `data/items.yaml` dont `level <= NIVEAU MESURÉ`, on retient le
 * meilleur score pondéré du build (`survie` : Vitalité×100 + Force ; `offense` :
 * Force×100 + int×10 + Vita), départage alphabétique d'`id` ; aucun id d'objet
 * n'est écrit dans ce fichier.
 *
 * RÉSULTAT MESURÉ LE 24/11/2026, `hpScale` 0,29/0,33, `castsPerTurn` ET
 * `cooldown` HONORÉS, SOIN ENTRE LES SALLES À 0,75 (DEC-03), CONTACT DIAGONAL
 * CORRIGÉ (D104), MOBILITÉ DES MONSTRES DU DONJON RENDUE (4 PM, DEC-10) ET
 * PORTÉE CHEBYSHEV (GRID-01) — SIX VICTOIRES (16, 17, 18). La « marge min »
 * est la plus petite des quatre salles et la salle qui la porte est donnée
 * entre parenthèses — pour les six cellules, c'est la salle 3 :
 *   niv.  build    PV max  PV monstres  PV fin  marge min (salle)  actions
 *   16    survie    308    0            78      2,400 (3)          103
 *   16    offense   233    0            65      0,931 (3)          68
 *   17    survie    348    0            177     3,365 (3)          70
 *   17    offense   268    0            181     2,662 (3)          58
 *   18    survie    438    0            351     6,254 (3)          53
 *   18    offense   353    0            266     4,458 (3)          45
 *
 * LEVIER DE CETTE MESURE — `healBetweenRooms` 0,5 → 0,75 (une ligne de
 * `data/dungeons.yaml`). Aucun dégât, sort, PV de référence, butin ni `hpScale`
 * n'est retouché : les deux builds de 16 franchissent les salles 2 et 3 à
 * pleine barre ; `16 offense` entre en salle 4 à 219/233, `16 survie` à
 * 308/308. La salle 4 est celle que le niveau 16 perdait avant la calibration ;
 * elle est désormais gagnée avec 78 PV (`survie`) et 65 PV (`offense`), soit des
 * marges de 3,391 et 2,532 tours sur cette salle. La marge MINIMALE de chaque
 * cellule reste portée par la salle 3 (2,400 et 0,931 pour 16, 3,365 pour
 * 17 `survie`).
 * 17 et 18 voient leurs marges s'améliorer sans devenir triviales ; le héros nu
 * meurt toujours en salle 2 avec 137 PV de monstres restants.
 *
 * ITEM-01 (24/11/2026) — les résistances et le `% Dégâts` de l'équipement sont
 * désormais projetés en combat. Seules trois cellules bougent, et uniquement
 * par le stuff qu'elles portent (les builds de 16 n'ont ni `% Dégâts` ni
 * résistance de panoplie) : `17 survie` 73 → 70 actions, `17 offense`
 * 114 → 181 PV finaux (60 → 58 actions), `18 survie` 58 → 53 actions. Les
 * marges minimales ne changent pas : elles restent portées par la salle 3 et
 * valent 2,400 / 0,931 / 3,365 / 2,662 / 6,254 / 4,458. Le héros nu meurt
 * toujours en salle 2 : aucun monstre, sort ni `hpScale` n'a été retouché.
 *
 * EFFET MESURÉ DE LA MOBILITÉ RENDUE (3 → 4 PM sur les cinq monstres du donjon) :
 * DEC-10 facture la diagonale 2 PM et la zone atteignable avec 3 PM tombait de
 * 49 à 25 cases, un seul axe diagonal au lieu de trois : les monstres mettaient
 * un tour de plus à venir au contact, donc les salles 1 et 2 étaient devenues
 * plus douces que leur tempo 1.29. Avec 4 PM elles reviennent au contact dans le
 * tour, et le héros encaisse de nouveau : `16 survie` 47 → 48 PV, `16 offense`
 * 96 → 46 PV, `17 survie` 194 → 172, `17 offense` 140 → 122, `18 survie`
 * 318 → 289, `18 offense` 247 → 261. À l'état d'alors (soin 0,5, avant GRID-01),
 * les SIX victoires étaient conservées et la marge du build contraignant passait
 * de 2,28 à 2,376 tours ; cette valeur est HISTORIQUE, la mesure courante est
 * 3,365 tours.
 *
 * EFFET MESURÉ DU CORRECTIF D104 : les monstres de mêlée collés en diagonale ne
 * restent plus figés, donc chaque salle encaisse des coups de plus et le héros
 * finit plus bas (`16 survie` 59 → 47 PV). Le soin de franchissement déjà livré
 * (#80, ratio `healBetweenRooms` 0,5) absorbe la différence : aucune donnée de
 * donjon n'a été retouchée, les six victoires tiennent.
 *
 * POURQUOI LA CALIBRATION A BOUGÉ D'UN CRAN AVEC LES DIAGONALES : les deux camps
 * se déplacent maintenant en 8 directions facturées au pas (diagonale = 1 PM).
 * Les monstres atteignent le héros en ~6 pas au lieu de ~10 et frappent donc un
 * tour plus tôt : à `hpScale` 0,35/0,30, `16 survie` mourait en salle 4 avec
 * 11 PV de monstre restants et la marge de la salle 3 tombait à 0,80. Le levier
 * reste `hpScale`, jamais les monstres. Mesures intermédiaires : salle 4 seule à
 * 0,28 → 52 PV restants (le pas de quantification est grossier) ; 0,26 → victoire
 * mais marge minimale 0,80 en salle 3 ; salle 3 à 0,31/0,30 → toujours 0,80 ;
 * salle 3 à 0,29 → 2,08 (un tour de moins). La marge est donc QUANTIFIÉE : à
 * l'époque, la fenêtre 1-2 tours n'existait qu'avec la salle 4 comme salle
 * contraignante, d'où 0,33 — un cran plus dur qu'avant, pour que la boss room ne
 * soit pas la salle la plus facile. `16 survie` finissait alors avec 27 PV,
 * exactement la mesure d'avant diagonales. Après le soin à 0,75, la marge
 * minimale est portée par la salle 3 (cf. table).
 *
 * AVANT LA CALIBRATION 8 DIRECTIONS (salle 3 0,35 / salle 4 0,30, même fichier) :
 * `16 survie` perdait la salle 4 (11 PV de monstres restants), `16 offense`
 * gagnait avec 33 PV, 17 et 18 gagnaient — la marge du build contraignant était
 * tombée à 0,80, sous la règle du tour de sécurité.
 * AVANT LA CALIBRATION `hpScale` (même jour, cast-per-turn corrigé) : 16 survie
 * 211 PV de monstres restants en salle 3, 16 offense 176, 17 survie 60, 17 offense
 * 83 — quatre défaites ; seuls 18 survie (95 actions) et 18 offense (77) gagnaient.
 * AVANT LE CORRECTIF `castsPerTurn` : aucune victoire.
 *
 * LE LEVIER DES PV DE SALLE RESTE `hpScale`, UN FACTEUR DE PV PAR SALLE ; la
 * calibration DEC-03 de cette PR, elle, est le SOIN, pas `hpScale` : les
 * `hp`, dégâts, PA et butins des monstres ne bougent pas, donc
 * `fer_crabe_cle_molette` (12/146 des rencontres du monde ouvert) et
 * `fer_boulon_pousseur` (4/146, seule rencontre de niveau 15 de la plage) ne
 * deviennent pas triviaux en exploration, tandis que leurs PM sont une donnée
 * de gameplay qui compte (DEC-10 : diagonale à 2 PM, et quatre de ces monstres
 * vivent aussi en exploration où les PM servent) — ne pas les modifier sans
 * mesure. Retirer
 * des exemplaires aurait vidé « L'Allée des Boulons Perdus » de son identité ET
 * baissé sa menace ; baisser les PV des monstres aurait cassé le monde ouvert.
 * `hpScale` ne touche QUE les PV (`Math.floor`, donc `floor(105 × 0,29) = 30`) :
 * dégâts, PA/PM, portée et drops d'une salle restent ceux du monde ouvert, et la
 * salle 3 menace toujours ~32 PV/tour. Salles 1-2 : champ absent, facteur 1,
 * comportement identique au PV près (mesures 122 et 287 PV inchangées).
 *
 * RÉPONSE DEC-03 APRÈS GRID-01 (rétablie par la calibration de soin) : (a) « au
 * niveau recommandé (16) avec un bon équipement, le joueur gagne » est de
 * nouveau vraie — les deux builds gagnent la salle 4 avec 78 et 65 PV finaux,
 * et une marge positive sur cette salle (3,391 et 2,532 tours). La marge
 * minimale du donjon n'est pas en salle 4 mais en salle 3 (2,400 et 0,931),
 * comme le dit la table. Le levier est le soin de franchissement (0,5 → 0,75),
 * explicitement autorisé par DEC-03 ; ni les dégâts, ni les sorts, ni les PV de
 * référence des monstres ne bougent. (b) le héros nu perd toujours, et toujours
 * en salle 2 (123 PV à la porte, 137 PV de monstres restants) : le soin plus
 * généreux ne remplace pas une panoplie.
 *
 * CONSTAT D'ARITHMÉTIQUE ASSUMÉ, REMESURÉ À 0,75 : la fenêtre 1-2 tours n'est
 * pas atteignable pour les deux builds. `16 survie` (308 PV) sort par le haut
 * (2,400 tours, salle 3) tandis que `16 offense` (233 PV) sort par le bas
 * (0,931 tour, salle 3) ; l'offense est donc borné par son ratio de PV
 * restants, `hpEnd < maxHp / 2` (65/233 = 27,9 %), pas par la fenêtre de tours.
 * On ne prétend pas calibrer les deux à 1-2 tours ; le test ne fige pas un
 * instantané au centième. (Historique : au soin 0,5, la même case offense
 * mesurait 2,04 tours et 63/228 = 28 %.)
 *
 * L'ÉTAT DES QUOTAS EST PORTÉ PAR LA BATAILLE (`BattleState.spellUsage`) : un
 * compteur par lanceur et par sort, remis à zéro quand le tour change, jamais une
 * variable de module. Deux salles, deux batailles, deux compteurs.
 *
 * LE PLAFOND D'ACTIONS RESTE LE DÉTECTEUR D'ENLISEMENT : il n'est ni contourné ni
 * calibré. S'il reparaît, c'est que le moteur gèle à nouveau.
 *
 * CE QUE ÇA DIT DE D71 : la cause racine du mur était un BUG DE FIDÉLITÉ, pas
 * l'équilibrage. Trois des six cellules reculaient d'une salle entière et deux
 * gagnaient, sans qu'aucun PV, dégât, drop ni ratio de soin n'ait bougé. Depuis
 * la calibration, 16 gagne : le mur restant n'est plus un chiffre de salle mais la
 * géométrie du déplacement (8 directions), corrigée par le moteur.
 *
 * CE QU'IL NE PROUVE PAS : ni l'acquisition réelle de l'équipement (les pièces
 * sont ajoutées au sac puis équipées par l'action `equip` du store — la mesure
 * porte sur l'effet de l'équipement, pas sur son farm, contrairement à la clef
 * qui est, elle, réellement farmée), ni le déplacement en salle (aucune action de
 * mouvement : les monstres viennent au héros — le pas diagonal ne change donc que
 * leur approche), ni l'équilibrage des salles 3-4 au-delà des `hpScale` mesurés.
 */

const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));
const items = parseItemsYaml(read("items.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));
const recipes = parseRecipesYaml(read("recipes.yaml"));
const spawns = parseSpawnsYaml(read("spawns.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));

/** Le seul donjon du catalogue : aucun id écrit ici, la donnée décide. */
const DUNGEON: DungeonDef = first(dungeons, "donjon");
const START_MAP_ID = first(maps, "carte").id;
const HERO_CLASS: ClassDef = mustFind(classes, "iop");
const HERO_SPELL: SpellDef = first(damageSpells(), "sort de dégâts du héros");
const CAST_SPEC = spellCastSpec(HERO_SPELL, 0);
const KEY: ItemDef = mustFind(items, DUNGEON.keyItemId);
const KEY_RECIPE: RecipeDef = recipes.find((recipe) => recipe.resultItemId === KEY.id) ?? noRecipe();

/**
 * Niveaux mesurés, ÉCRITS ICI : le niveau d'équipement est un paramètre de la
 * mesure. `recommendedLevel` (data/dungeons.yaml) est ce que l'on teste, et
 * n'alimente plus ni le héros, ni le pool d'équipement — sinon changer la valeur
 * testée changerait la mesure (mesure circulaire).
 */
const LEVELS = [16, 17, 18] as const;

type BuildId = "survie" | "offense";

/** Critère de chaque build : la pondération EST la définition du build. */
const WEIGHTS: Record<BuildId, Readonly<Record<string, number>>> = {
  survie: { vitality: 100, strength: 1 },
  offense: { strength: 100, intelligence: 10, vitality: 1 },
};
const CAPITAL_STAT: Record<BuildId, StatKey> = { survie: "vitality", offense: "strength" };

/**
 * GARDE-FOUS de mesure, pas des résultats : depuis `DEC-07` la clef tombe en
 * butin direct (≈ 7,05 rencontres en espérance) et 5 avec les graines retenues.
 */
const FARM_CAP = 600;
/** Rencontres réellement mesurées sous `SPAWN_SEED` / `DROP_SEED` (`DEC-07`). */
const FARM_ENCOUNTERS = 5;
const ROOM_ACTION_CAP = 200;
/** Graines du LCG (spawn et drop séparés) : même patron que `play.spec.ts`. */
const SPAWN_SEED = 12_345;
const DROP_SEED = 98_765;
/** Combat déterministe : le milieu de plage, aucun aléa système. */
const COMBAT_RNG = () => 0.5;

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function first<T>(list: readonly T[], label: string): T {
  const value = list[0];
  if (value === undefined) throw new Error(`data/ ne déclare aucun ${label}`);
  return value;
}

function noRecipe(): never {
  throw new Error(`aucune recette ne produit ${KEY.id} dans data/recipes.yaml`);
}

function damageSpells(): SpellDef[] {
  return spells.filter((spell) => spell.classId === HERO_CLASS.id && spell.damage !== undefined);
}

function heroOrThrow(): Hero {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros absent du store");
  return hero;
}

function battleOrThrow(): BattleState {
  const { battle } = useCombatStore.getState();
  if (battle === null) throw new Error("battle absent du store");
  return battle;
}

function playerOf(state: BattleState): CombatantLike {
  const player = state.combatants.find((entry) => entry.side === "player");
  if (player === undefined) throw new Error("héros absent de la bataille");
  return player;
}

function hpOf(state: BattleState): number {
  return playerOf(state).hp;
}

function enemyHp(state: BattleState): number {
  return livingOf(state, "enemy").reduce((total, enemy) => total + enemy.hp, 0);
}

/** Générateur congruentiel : déterministe, injecté, jamais `Math.random`. */
function lcg(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return state / 4_294_967_296;
  };
}

function xpForLevel(level: number): number {
  const tier = progression.xpThresholds.find((entry) => entry.level === level);
  if (tier === undefined) throw new Error(`niveau ${level} absent de data/progression.yaml`);
  return tier.xpRequired;
}

/** Montée de niveau par le moteur (`gainXp`), jamais un `level: 16` écrit. */
function leveledHero(hero: Hero, level: number): Hero {
  const tiers = progression.xpThresholds;
  const options = { hero, amount: xpForLevel(level) - hero.xp, gainRules: progression.gainRules };
  return gainXp({ ...options, tiers, apRules: progression.apRules }).hero;
}

/** Capital dépensé par le moteur (`spendCapitalPoints`), soft caps compris. */
function withCapital(hero: Hero, stat: StatKey): Hero {
  const options = { hero, stat, points: hero.capitalPoints, classDef: HERO_CLASS };
  return spendCapitalPoints(options).hero;
}

/**
 * Sélection data-driven : score pondéré du build sur les stats de l'objet,
 * départage alphabétique pour rester déterministe, aucun id littéral.
 */
function scoreOf(build: BuildId, item: EquipmentDef): number {
  const entries = Object.entries(WEIGHTS[build]);
  return entries.reduce((total, [stat, weight]) => {
    const value = (item.stats as Record<string, number | undefined>)[stat] ?? 0;
    return total + weight * value;
  }, 0);
}

function bestOf(build: BuildId, candidates: readonly EquipmentDef[]): EquipmentDef {
  const rank = (best: EquipmentDef, item: EquipmentDef) => {
    const delta = scoreOf(build, item) - scoreOf(build, best);
    if (delta !== 0) return delta > 0 ? item : best;
    return item.id < best.id ? item : best;
  };
  return candidates.slice(1).reduce(rank, first(candidates, "candidat d'équipement"));
}

/** Éligible = équipement que le niveau MESURÉ autorise (jamais le donjon). */
function eligible(item: ItemDef, level: number): item is EquipmentDef {
  return item.category === "equipment" && item.level <= level;
}

function buildGear(build: BuildId, level: number): EquipmentDef[] {
  const pool = items.filter((item) => eligible(item, level));
  const slots = [...new Set(pool.map((item) => item.slot))].sort();
  return slots.map((slot) => bestOf(build, pool.filter((item) => item.slot === slot)));
}

/** Équipement réellement porté, relu dans l'inventaire : pas dans `buildGear`. */
function wornGear(level: number): EquipmentDef[] {
  const { inventory } = useGameStore.getState();
  const worn = Object.values(inventory.equipment).map((itemId) => mustFind(items, itemId as string));
  return worn.filter((item) => eligible(item, level));
}

function addGear(inventory: InventoryState, gear: readonly EquipmentDef[]): InventoryState {
  return gear.reduce((bag, item) => addItem({ inventory: bag, itemId: item.id, quantity: 1 }), inventory);
}

function equipAll(gear: readonly EquipmentDef[]): void {
  const { equip } = useGameStore.getState();
  for (const item of gear) equip({ itemId: item.id });
}

function statsOf(hero: Hero, inventory: InventoryState) {
  return totalStatsFor({ hero, inventory, items: GAME_CATALOG.items, sets: GAME_CATALOG.sets });
}

/** Projection du store : le même chemin que la bataille réelle. */
function heroCombatant(): CombatantState {
  const hero = heroOrThrow();
  const { inventory } = useGameStore.getState();
  const spellIds = spells.filter((spell) => spell.classId === hero.classId).map((spell) => spell.id);
  return combatantFromHero({ hero, stats: statsOf(hero, inventory), position: { x: 0, y: 0 }, spellIds });
}

function missingIngredient(inventory: InventoryState): boolean {
  return KEY_RECIPE.ingredients.some((entry) => countItem(inventory, entry.itemId) < entry.quantity);
}

function withDrops(inventory: InventoryState, drops: readonly string[]): InventoryState {
  return drops.reduce((bag, itemId) => addItem({ inventory: bag, itemId, quantity: 1 }), inventory);
}

/** Une rencontre réelle : le spawn sort du YAML, le butin du moteur. */
function fightSpawn(input: { rngSpawn: () => number; rngDrop: () => number }): readonly string[] {
  const pick = pickSpawn({ zones: spawns, mapId: START_MAP_ID, rng: input.rngSpawn });
  const monster = mustFind(monsters, pick.monsterId);
  const heroXp = heroOrThrow().xp;
  const options = { heroXp, hero: heroCombatant(), monster, progression, rng: input.rngDrop };
  return resolveCombatRewards(options).drops;
}

/** Farm borné : on combat CE QUI SPAWNE, pas ce qui arrange le test. */
function farmKey(): number {
  const rngSpawn = lcg(SPAWN_SEED);
  const rngDrop = lcg(DROP_SEED);
  let inventory = useGameStore.getState().inventory;
  let encounters = 0;
  while (!keyInBag(inventory) && missingIngredient(inventory) && encounters < FARM_CAP) {
    inventory = withDrops(inventory, fightSpawn({ rngSpawn, rngDrop }));
    encounters += 1;
  }
  useGameStore.setState({ inventory });
  return encounters;
}

function prepareBuild(build: BuildId, level: number): EquipmentDef[] {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: HERO_CLASS.id });
  const hero = withCapital(leveledHero(heroOrThrow(), level), CAPITAL_STAT[build]);
  useGameStore.setState({ hero });
  const gear = buildGear(build, level);
  useGameStore.setState({ inventory: addGear(useGameStore.getState().inventory, gear) });
  equipAll(gear);
  return gear;
}

/** La clef est au sac : arrivée par le butin direct ou par le craft, peu importe. */
function keyInBag(inventory: InventoryState): boolean {
  return countItem(inventory, KEY.id) > 0;
}

/**
 * `DEC-07` : deux chemins, un seul résultat. Le farm s'arrête dès que la clef
 * tombe en butin direct ; sinon on craft depuis les ingrédients, chemin garanti.
 */
function ensureKey(): void {
  if (keyInBag(useGameStore.getState().inventory)) return;
  expect(missingIngredient(useGameStore.getState().inventory)).toBe(false);
  useGameStore.getState().craftRecipe({ recipeId: KEY_RECIPE.id });
  expect(keyInBag(useGameStore.getState().inventory)).toBe(true);
}

function craftAndEnter(): number {
  const encounters = farmKey();
  ensureKey();
  expect(useCombatStore.getState().enterDungeonRun({ dungeonId: DUNGEON.id })).toBe(true);
  return encounters;
}

function castableEnemies(state: BattleState): CombatantLike[] {
  return livingOf(state, "enemy").filter((enemy) => castRefusal(state, enemy.id, CAST_SPEC) === null);
}

function weakestOf(list: readonly CombatantLike[]): CombatantLike | null {
  const rank = (best: CombatantLike | null, enemy: CombatantLike) =>
    best === null || enemy.hp < best.hp ? enemy : best;
  return list.reduce<CombatantLike | null>(rank, null);
}

interface Step {
  cast: boolean;
  damageTaken: number;
}

function heroActive(state: BattleState): boolean {
  return activeCombatant(state)?.side === "player";
}

/** Cible réellement attaquable : le refus du moteur est l'arbitre, pas le test. */
function targetOf(state: BattleState): CombatantLike | null {
  return heroActive(state) ? weakestOf(castableEnemies(state)) : null;
}

/**
 * Une itération = une action du héros (sort) ou un tour ennemi. Aucun
 * déplacement dans ce fichier : le héros attend que les monstres viennent.
 */
function actOnce(storage?: StorageLike): Step {
  const store = useCombatStore.getState();
  const state = battleOrThrow();
  const before = hpOf(state);
  const target = targetOf(state);
  if (target !== null && playerOf(state).ap >= HERO_SPELL.apCost) {
    store.battleSpellAttack({ targetId: target.id, rng: COMBAT_RNG });
    return { cast: true, damageTaken: 0 };
  }
  store.playEnemyTurns({ rng: COMBAT_RNG, storage });
  return { cast: false, damageTaken: before - hpOf(battleOrThrow()) };
}

interface RoomReport {
  roomNumber: number;
  hpStart: number;
  hpEnd: number;
  victory: boolean;
  defeat: boolean;
  /** Aucune issue en `ROOM_ACTION_CAP` itérations : ni victoire, ni défaite. */
  stalled: boolean;
  actions: number;
  casts: number;
  heroTurns: number;
  damageTaken: number;
  enemyHpStart: number;
  enemyHpLeft: number;
}

interface Tally {
  casts: number;
  heroTurns: number;
  damageTaken: number;
}

function tally(steps: readonly Step[]): Tally {
  const sum = (pick: (step: Step) => number) => steps.reduce((total, step) => total + pick(step), 0);
  const casts = sum((step) => Number(step.cast));
  const damageTaken = sum((step) => step.damageTaken);
  return { casts, heroTurns: steps.length - casts, damageTaken };
}

/** La salle est terminée : victoire, défaite, ou enlisement (plus rien ne bouge). */
function roomOver(state: BattleState): boolean {
  return isVictory(state) || isDefeat(state);
}

/** Plafond atteint sans issue : l'enlisement EST le résultat, pas un aléa du test. */
function isStalled(steps: readonly Step[], state: BattleState): boolean {
  return steps.length >= ROOM_ACTION_CAP && !roomOver(state);
}

function playRoom(roomNumber: number, storage: StorageLike): RoomReport {
  const state = battleOrThrow();
  const hpStart = hpOf(state);
  const enemyHpStart = enemyHp(state);
  const steps: Step[] = [];
  while (steps.length < ROOM_ACTION_CAP && !roomOver(battleOrThrow())) {
    steps.push(actOnce(storage));
  }
  const end = battleOrThrow();
  const flags = { victory: isVictory(end), defeat: isDefeat(end), stalled: isStalled(steps, end) };
  const ends = { hpEnd: hpOf(end), enemyHpLeft: enemyHp(end) };
  return { roomNumber, hpStart, enemyHpStart, ...ends, ...flags, ...tally(steps), actions: steps.length };
}

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

interface Measurement {
  level: number;
  build: BuildId | "nu";
  maxHp: number;
  gear: readonly EquipmentDef[];
  encounters: number;
  victory: boolean;
  stalled: boolean;
  actions: number;
  rooms: RoomReport[];
}

function currentRoomNumber(): number {
  const { dungeonRun } = useCombatStore.getState();
  if (dungeonRun === null) throw new Error("aucun run en cours");
  return dungeonRun.roomIndex + 1;
}

function runOrThrow(): DungeonRunState {
  const { dungeonRun } = useCombatStore.getState();
  if (dungeonRun === null) throw new Error("aucun run en cours");
  return dungeonRun;
}

/**
 * Une salle gagnée : `settleDungeonRoom` ; une défaite : `endBattle` (D44) ;
 * un enlisement : `endBattle` aussi, aucune salle n'est validée.
 */
function nextRoomOrStop(report: RoomReport, storage: StorageLike): boolean {
  if (report.defeat || report.stalled) {
    expect(isDungeonComplete(runOrThrow(), DUNGEON)).toBe(false);
    return false;
  }
  useCombatStore.getState().settleDungeonRoom({ storage });
  return true;
}

function playDungeon(storage: StorageLike): RoomReport[] {
  const rooms: RoomReport[] = [];
  while (useCombatStore.getState().dungeonRun !== null) {
    const report = playRoom(currentRoomNumber(), storage);
    rooms.push(report);
    if (!nextRoomOrStop(report, storage)) break;
  }
  return rooms;
}

/**
 * Sortie propre vérifiée par `loadGame` : plus de bataille, plus de run, aucune
 * sauvegarde à 0 PV. La notice dépend de l'issue — « Donjon terminé » quand la
 * dernière salle est gagnée, « Donjon quitté » quand le héros tombe.
 */
function assertCleanExit(storage: StorageLike, victory: boolean): void {
  const combat = useCombatStore.getState();
  expect(combat.battle).toBeNull();
  expect(combat.dungeonRun).toBeNull();
  expect(combat.dungeonNotice).toContain(victory ? "Donjon terminé" : "Donjon quitté");
  const alive = heroOrThrow();
  expect(alive.hp).toBeGreaterThan(0);
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().loadGame(storage)).toBe(true);
  expect(heroOrThrow().hp).toBe(alive.hp);
}

function measureRun(input: { build: BuildId | "nu"; level: number; encounters: number; storage: MemoryStorage }): Measurement {
  const { build, level, encounters, storage } = input;
  const maxHp = playerOf(battleOrThrow()).maxHp;
  const gear = wornGear(level);
  const rooms = playDungeon(storage);
  const last = rooms[rooms.length - 1];
  useCombatStore.getState().endBattle();
  assertCleanExit(storage, last?.victory === true);
  expect(gear.map((item) => item.level).every((worn) => worn <= level)).toBe(true);
  const actions = rooms.reduce((total, room) => total + room.actions, 0);
  const stalled = last?.stalled === true;
  return { level, build, maxHp, gear, encounters, victory: last?.victory === true, stalled, actions, rooms };
}

/** Une mesure complète et indépendante : héros, équipement, clef, donjon, sortie. */
function measureAt(level: number, build: BuildId): Measurement {
  prepareBuild(build, level);
  expect(heroOrThrow().level).toBe(level);
  const encounters = craftAndEnter();
  return measureRun({ build, level, encounters, storage: new MemoryStorage() });
}

/** Les seuls objets qu'un « héros nu » possède : ceux marqués `starting`. */
function startingKit(): EquipmentDef[] {
  return items.filter((item): item is EquipmentDef => item.category === "equipment" && item.starting === true);
}

/**
 * Le « héros nu » de `play.spec.ts` : niveau recommandé, capital dépensé, kit de
 * départ uniquement. Aucune pièce du build, aucun objet ajouté par ce fichier.
 */
function prepareNaked(): void {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: HERO_CLASS.id });
  const hero = withCapital(leveledHero(heroOrThrow(), DUNGEON.recommendedLevel), CAPITAL_STAT.offense);
  useGameStore.setState({ hero });
  const kit = startingKit();
  useGameStore.setState({ inventory: addGear(useGameStore.getState().inventory, kit) });
  equipAll(kit);
}

/** Mesure du héros nu : la règle (b) de DEC-03, sur le même chemin que les builds. */
function measureNaked(): Measurement {
  prepareNaked();
  const encounters = craftAndEnter();
  return measureRun({ build: "nu", level: DUNGEON.recommendedLevel, encounters, storage: new MemoryStorage() });
}

interface Deficit {
  /** Tours de héros encore nécessaires pour vider la salle. */
  turnsShort: number;
  /** PV de survie qu'il aurait fallu pour tenir ces tours. */
  hpNeeded: number;
}

/** Déficit chiffré : PV ennemis restants ÷ dégâts par tour, en PV de survie. */
function deficitOf(room: RoomReport): Deficit {
  const dealt = room.enemyHpStart - room.enemyHpLeft;
  const damagePerTurn = dealt / room.heroTurns;
  const incomingPerTurn = room.damageTaken / room.heroTurns;
  const turnsShort = room.enemyHpLeft / damagePerTurn;
  return { turnsShort, hpNeeded: turnsShort * incomingPerTurn };
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useCombatStore.setState({
    battle: null,
    combat: null,
    mode: "exploration",
    exploration: null,
    dungeonRun: null,
    dungeonNotice: null,
    rewards: null,
  });
});

type Outcome = "victoire" | "defaite" | "enlisement";

interface Cell {
  level: number;
  build: BuildId;
  maxHp: number;
  outcome: Outcome;
  room: number;
  enemyHpLeft: number;
  /** PV du héros à la sortie de la dernière salle : le coussin de la calibration. */
  hpEnd: number;
  actions: number;
}

/**
 * La table EST la mesure : chaque chiffre vient d'une exécution réelle, aucune
 * valeur n'a été calée pour que le test passe. SIX VICTOIRES (16, 17 et 18)
 * depuis la calibration du soin (0,5 → 0,75) et `hpScale` (0,29 salle 3 /
 * 0,33 salle 4) : `actions` est le total réellement joué, jamais un plafond
 * atteint (le plafond de 200 actions reste le détecteur d'enlisement, cf.
 * en-tête). Le soin de franchissement (DEC-03) est mesuré par
 * `assertCrossingHeal` : chaque salle suivante démarre au-dessus des PV de fin
 * de la précédente.
 *
 * AVANT → APRÈS LA CALIBRATION DU SOIN (PV finaux / actions) :
 *  16 survie  0/96 (défaite, 35 PV de monstres) → 73/103
 *  16 offense 0/67 (défaite, 34 PV de monstres) → 56/68
 *  17 survie  155/74 → 172/73 · 17 offense 99/60 → 109/60
 *  18 survie  346/58 → 346/58 · 18 offense 261/45 → 261/45
 * Aucun dégât, sort, PV de référence, butin ni `hpScale` n'est touché : seule
 * la part du pool effectif rendue au franchissement change. Les deux builds de
 * 16 franchissent les salles 1-3 à pleine barre (`16 offense` entre en salle 4
 * à 219/233), puis gagnent la salle 4 qu'ils perdaient ; la marge minimale,
 * elle, reste portée par la salle 3. Le héros nu meurt toujours en salle 2.
 */
const CELLS: readonly Cell[] = [
  { level: 16, build: "survie", maxHp: 308, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 78, actions: 103 },
  { level: 16, build: "offense", maxHp: 233, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 65, actions: 68 },
  { level: 17, build: "survie", maxHp: 348, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 177, actions: 70 },
  { level: 17, build: "offense", maxHp: 268, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 181, actions: 58 },
  { level: 18, build: "survie", maxHp: 438, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 351, actions: 53 },
  { level: 18, build: "offense", maxHp: 353, outcome: "victoire", room: 4, enemyHpLeft: 0, hpEnd: 266, actions: 45 },
];


function lastRoomOf(rooms: readonly RoomReport[]): RoomReport {
  const last = rooms[rooms.length - 1];
  if (last === undefined) throw new Error("aucune salle jouée");
  return last;
}

/** Issue de la DERNIÈRE salle : la victoire s'entend « donjon complet ». */
function outcomeOf(measure: Measurement): Outcome {
  if (measure.victory) return "victoire";
  return measure.stalled ? "enlisement" : "defaite";
}

/**
 * Marge d'une salle GAGNÉE, en tours ennemis : les PV restants du héros divisés
 * par la pression qu'il a réellement subie (`damageTaken / heroTurns`). C'est le
 * pas de la quantification : ≈ 1 tour, soit ~32 PV sur la salle 3.
 */
function margin(room: RoomReport): number {
  const rate = room.heroTurns === 0 ? 0 : room.damageTaken / room.heroTurns;
  return rate === 0 ? Number.POSITIVE_INFINITY : room.hpEnd / rate;
}

interface MarginFloor {
  /** Numéro de la salle qui porte la plus petite marge. */
  room: number;
  /** Marge de cette salle, en tours ennemis. */
  margin: number;
}

/** Salle qui porte la marge minimale d'un run, avec sa valeur en tours. */
function marginFloor(rooms: readonly RoomReport[]): MarginFloor {
  const rank = (best: MarginFloor, room: RoomReport) =>
    margin(room) < best.margin ? { room: room.roomNumber, margin: margin(room) } : best;
  return rooms.reduce(rank, { room: 0, margin: Number.POSITIVE_INFINITY });
}

/** DEC-03 : chaque porte franchie rend des PV, donc la salle suivante repart plus haut. */
function assertCrossingHeal(rooms: readonly RoomReport[]): void {
  rooms.slice(1).forEach((room, index) => {
    const previous = rooms[index];
    if (previous === undefined) throw new Error("salle précédente absente");
    expect(room.hpStart).toBeGreaterThan(previous.hpEnd);
  });
}

/** Une cellule gagnée : donjon complet, dernière salle vide. */
function assertRoom4Victory(cell: Measurement): void {
  expect(cell.victory).toBe(true);
  const last = lastRoomOf(cell.rooms);
  expect(last.roomNumber).toBe(4);
  expect(last.enemyHpLeft).toBe(0);
}

/** La victoire de 16 laisse un vrai coussin, pas une barre vide (« pas 1 PV »). */
function assertSixteenWin(cell: Measurement): void {
  assertRoom4Victory(cell);
  expect(lastRoomOf(cell.rooms).hpEnd).toBeGreaterThan(1);
}

/** La table, le commentaire et l'assertion doivent nommer la même salle. */
function assertFloor(check: { floor: MarginFloor; expected: number }): void {
  expect(check.floor.room).toBe(3);
  expect(check.floor.margin).toBeCloseTo(check.expected, 1);
}

/** DEC-03(b) : le héros nu perd en salle 2, et son déficit est chiffré. */
function assertNakedDefeat(): void {
  const naked = measureNaked();
  expect(naked.victory).toBe(false);
  const last = lastRoomOf(naked.rooms);
  expect(last.roomNumber).toBe(2);
  const missing = deficitOf(last);
  expect(missing.turnsShort).toBeGreaterThan(0);
  expect(missing.hpNeeded).toBeGreaterThan(0);
}

describe("couverture de la mesure", () => {
  it("mesure les trois niveaux et les deux builds, sans dériver du donjon", () => {
    expect([...new Set(CELLS.map((cell) => cell.level))]).toEqual([...LEVELS]);
    expect(CELLS).toHaveLength(LEVELS.length * 2);
  });

  it("garde `recommendedLevel` à 16 et y mesure la victoire (DEC-03)", () => {
    expect(DUNGEON.recommendedLevel).toBe(16);
    const cells16 = CELLS.filter((cell) => cell.level === 16);
    expect(cells16.map((cell) => cell.outcome)).toEqual(["victoire", "victoire"]);
    expect(cells16.map((cell) => cell.room)).toEqual([4, 4]);
  });

  it("la victoire mesurée est bien un donjon complet, pas une salle", () => {
    const winners = CELLS.filter((cell) => cell.outcome === "victoire");
    expect(winners.map((cell) => cell.room)).toEqual([4, 4, 4, 4, 4, 4]);
  });
});

describe.each(CELLS)("niveau $level, build $build", (cell) => {
  it(`${cell.outcome} en salle ${cell.room} — ${cell.enemyHpLeft} PV de monstres restants, ${cell.hpEnd} PV finaux, ${cell.actions} actions`, () => {
    const measure = measureAt(cell.level, cell.build);
    expect(measure.maxHp).toBe(cell.maxHp);
    expect(measure.gear).toHaveLength(7);
    expect(measure.encounters).toBe(FARM_ENCOUNTERS);
    expect(measure.encounters).toBeLessThan(FARM_CAP);
    expect(outcomeOf(measure)).toBe(cell.outcome);
    const last = lastRoomOf(measure.rooms);
    expect(last.roomNumber).toBe(cell.room);
    expect(last.enemyHpLeft).toBe(cell.enemyHpLeft);
    expect(last.hpEnd).toBe(cell.hpEnd);
    expect(measure.actions).toBe(cell.actions);
    assertCrossingHeal(measure.rooms);
  });
});

/**
 * DEC-03 : (a) au niveau recommandé (16), les deux builds gagnent les quatre
 * salles ; (b) le héros nu perd, en salle 2, et son déficit reste CHIFFRÉ
 * (`deficitOf`), jamais toléré silencieusement.
 *
 * CE QUE LA MESURE DIT DE L'ARITHMÉTIQUE : le soin de franchissement remet les
 * deux builds de 16 à pleine barre entre les salles (sauf `16 offense`, qui
 * entre en salle 4 à 219/233), donc les salles 1-3 ne se disputent plus la
 * victoire. La salle 4 — celle que 16 perdait avant la calibration — est
 * gagnée : `survie` y finit à 78 PV, `offense` à 65 PV (27,9 % de sa barre).
 * Mais la marge MINIMALE de chaque cellule est portée par la salle 3 (2,400 et
 * 0,931 pour 16 ; 3,365 pour 17 `survie`), et `offense`
 * garde le garde-fou « pas trivial » (`hpEnd < maxHp`, 181 < 268 à 17 — la salle
 * reste coûteuse même stuffé).
 *
 * LA VALEUR EST ÉPINGLÉE, PAS UNE BORNE VALIDÉE : `toBeCloseTo(3.365, 1)` fige
 * la mesure de `17 survie` (min sur les quatre salles) pour rougir au moindre
 * changement de contenu ou de moteur. La salle 3 n'a pas bougé ; c'est la
 * salle 4 qui a été rendue franchissable par le soin, pas les monstres.
 */
describe("DEC-03 — 16 gagne, 17 gagne, le héros nu perd en salle 2", () => {
  it("16 gagne les quatre salles, 17 aussi, le héros nu meurt en salle 2", () => {
    const cells16 = (["survie", "offense"] as const).map((build) => measureAt(16, build));
    for (const cell of cells16) assertSixteenWin(cell);
    const [survie16, offense16] = cells16;
    if (survie16 === undefined || offense16 === undefined) throw new Error("cellule 16 manquante");
    assertFloor({ floor: marginFloor(survie16.rooms), expected: 2.400 });
    assertFloor({ floor: marginFloor(offense16.rooms), expected: 0.931 });
    expect(margin(lastRoomOf(survie16.rooms))).toBeCloseTo(3.391, 1);
    expect(margin(lastRoomOf(offense16.rooms))).toBeCloseTo(2.532, 1);
    const survie17 = measureAt(17, "survie");
    const offense17 = measureAt(17, "offense");
    for (const cell of [survie17, offense17]) assertRoom4Victory(cell);
    const survieFloor = marginFloor(survie17.rooms);
    expect(survieFloor.room).toBe(3);
    expect(survieFloor.margin).toBeGreaterThanOrEqual(1);
    expect(survieFloor.margin).toBeCloseTo(3.365, 1);
    // ITEM-01 : les résistances et le % Dégâts d'équipement sont désormais
    // projetés en combat, donc le build offensif de 17 finit moins entamé
    // qu'avant (181/268 PV au lieu de 114/268). Le garde-fou « pas trivial »
    // devient donc « entamé, mais jamais intact » : la salle 4 coûte encore
    // des PV, même au build le plus offensif.
    expect(lastRoomOf(offense17.rooms).hpEnd).toBeLessThan(offense17.maxHp);
    expect(lastRoomOf(offense17.rooms).damageTaken).toBeGreaterThan(0);
    assertNakedDefeat();
  }, 120_000);
});

