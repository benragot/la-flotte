import type { MonsterDef } from "../../schemas/monsterSchema";
import { computeInitiative } from "../combat";
import type { CombatantState, CombatState } from "../combatLoop/types";
import type { BattleState, CombatantLike, CombatStats } from "../multiCombat/types";
import { buildTimeline } from "../multiCombat/timeline";

/**
 * Pont exploration → moteur unique (DEC-12, étape 2).
 *
 * Un combat d'exploration est un `multiCombat` à **un seul monstre**. Cet
 * adaptateur ne change aucune règle : il recopie l'état vivant (`hp`, `ap`,
 * `mp`, `position`) et les données canoniques (`stats`, `resistances`,
 * `spellIds`) dans un `CombatantLike` par camp, puis laisse `buildTimeline`
 * fixer l'ordre d'ouverture. `combatLoop` reste le moteur en production tant
 * que `VITE_COMBAT_ENGINE` n'est pas branché (étape 3).
 */

/**
 * Id du héros dans la timeline unifiée. À initiative égale, `multiCombat`
 * départage par id croissant : un chiffre trie avant la première lettre des
 * ids de `data/`, donc **le héros ouvre** (convention DEC-12), comme le 1v1.
 * L'UI, elle, peut continuer d'appeler le jeton `player` : c'est l'adaptateur
 * qui renomme, jamais le rendu.
 */
export const PLAYER_BATTLE_ID = "0_player";

export interface BattleFromCombatInput {
  combat: CombatState;
  /** Donnée canonique du monstre : id, nom, niveau, stats, résistances, sorts. */
  monster: MonsterDef;
}

/** Signature de `computeInitiative` réduite aux champs que lit le pont. */
export interface InitiativeSource {
  hp: number;
  maxHp: number;
  stats: CombatStats;
}

function copyStats(stats: CombatStats): CombatStats {
  const { strength, intelligence, chance, agility, wisdom } = stats;
  return { strength, intelligence, chance, agility, wisdom };
}

function copyResistances(resistances: CombatantLike["resistances"]): CombatantLike["resistances"] {
  return { flat: { ...resistances.flat }, percent: { ...resistances.percent } };
}

/**
 * Initiative 1.29 : la valeur stockée par grade (`stored`) prime sur la
 * formule `statTotal × (PV / PV max)`, via le moteur partagé.
 */
export function initiativeOf(source: InitiativeSource, stored?: number): number {
  const { strength, intelligence, chance, agility } = source.stats;
  const input = { strength, intelligence, chance, agility, currentHp: source.hp, maxHp: source.maxHp };
  return computeInitiative({ ...input, storedInitiative: stored });
}

interface Vitals {
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  mp: number;
  maxMp: number;
  position: { x: number; y: number };
}

/** Valeurs vivantes : elles bougent en combat, elles viennent de l'état 1v1. */
function vitalsOf(source: CombatantState): Vitals {
  const { hp, maxHp, ap, maxAp, mp, maxMp, position } = source;
  return { hp, maxHp, ap, maxAp, mp, maxMp, position };
}

/** Le héros reçoit `0_player`, ses PV/PA/PM/position et son `% Dégâts` réels. */
export function heroToCombatant(hero: CombatantState): CombatantLike {
  const identity = { id: PLAYER_BATTLE_ID, side: "player" as const, name: hero.name, level: hero.level };
  const data = { stats: copyStats(hero.stats), resistances: copyResistances(hero.resistances) };
  const damage = { percentDmg: hero.percentDmg, armor: 0, spellIds: [...hero.spellIds] };
  return { ...identity, ...vitalsOf(hero), ...data, ...damage, initiative: initiativeOf(hero) };
}

/**
 * Le monstre garde son id de donnée (aucun suffixe d'index en 1v1, aucun id de
 * jeton). Tout le reste est la projection fidèle de l'état vivant `enemy` :
 * PV/PA/PM/position, niveau, stats, résistances et sorts déjà résolus par
 * `initCombat`. `monster` nomme l'identité de timeline et porte l'initiative
 * stockée par grade (1.29), qui ne se lit jamais sur les stats vivantes.
 */
export function monsterToCombatant(monster: MonsterDef, enemy: CombatantState): CombatantLike {
  const identity = { id: monster.id, side: "enemy" as const, name: enemy.name, level: enemy.level };
  const data = { stats: copyStats(enemy.stats), resistances: copyResistances(enemy.resistances) };
  const damage = { percentDmg: enemy.percentDmg, armor: 0, spellIds: [...enemy.spellIds], ai: monster.ai };
  const initiative = initiativeOf(enemy, monster.initiative);
  return { ...identity, ...vitalsOf(enemy), ...data, ...damage, initiative };
}

/**
 * Compose le `BattleState` d'ouverture : deux combattants, la timeline
 * `buildTimeline` (initiative décroissante, égalité par id), le tour, la carte
 * et le journal déjà écrits par `initCombat`. Aucun `spellUsage` : la bataille
 * démarre vierge, comme un combat d'exploration neuf.
 */
export function battleFromCombat(input: BattleFromCombatInput): BattleState {
  const hero = heroToCombatant(input.combat.player);
  const enemy = monsterToCombatant(input.monster, input.combat.enemy);
  const { order, activeIndex } = buildTimeline([hero, enemy]);
  const opening = { turn: input.combat.turn, order, activeIndex, combatants: [hero, enemy] };
  return { ...opening, log: [...input.combat.log], map: input.combat.map };
}
