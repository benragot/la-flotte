import {
  activeCombatant,
  advanceTurn,
  aimOf,
  approachCell,
  canCastSpellNow,
  castBlock,
  enemiesAct,
  enemyStrategy,
  findCombatant,
  isDefeat,
  isVictory,
  keepDistanceCell,
  rangeOf,
  resolveAttack,
  targetsOf,
} from "../engine/multiCombat";
import type {
  AttackSpec,
  BattleState,
  CastBlock,
  CombatantLike,
  EnemyAction,
  EnemyAim,
  EnemyPlan,
  EnemyStrategy,
  RangeSpec,
  Rng,
  Side,
} from "../engine/multiCombat";
import { rangeDistance } from "../engine/grid";
import type { SpellDef } from "../schemas/spellSchema";

export const VICTORY_LOG = "Victoire : la salle est nettoyée.";
export const DEFEAT_LOG = "Défaite : le héros tombe dans la salle.";
export const STALL_LOG = "La mêlée s'enlise : la main revient au joueur.";
/** Borne dure : aucune boucle de tours ennemis ne peut dépasser ce nombre d'itérations. */
export const MAX_ENEMY_STEPS = 32;
/** Raisons de refus géométrique, telles que le joueur les lit dans le journal. */
export const CAST_BLOCK_LABEL: Record<CastBlock, string> = {
  "too-close": "trop proche",
  "out-of-range": "hors portée",
  "no-los": "ligne de vue bloquée",
};

interface CombatantPair {
  attacker: CombatantLike;
  target: CombatantLike;
}

interface GeometricPair extends CombatantPair {
  range: RangeSpec;
}

export interface BattleAttackInput {
  state: BattleState;
  targetId: string;
  attack: AttackSpec;
  rng: Rng;
}

export interface BattleEnemyTurnInput {
  state: BattleState;
  strategy: EnemyStrategy;
  rng: Rng;
}

export function appendBattleLog(state: BattleState, entry: string): BattleState {
  return { ...state, log: [...state.log, entry] };
}

function withOutcome(state: BattleState): BattleState {
  if (isDefeat(state)) return appendBattleLog(state, DEFEAT_LOG);
  if (isVictory(state)) return appendBattleLog(state, VICTORY_LOG);
  return state;
}

/** Refus (même référence) : aucune écriture de log, aucun `set` inutile. */
function settled(previous: BattleState, next: BattleState): BattleState {
  if (next === previous) return next;
  return withOutcome(next);
}

/** L'attaquant est l'actif de la timeline : la portée et la LoS restent à 5C. */
export function battleAttack(input: BattleAttackInput): BattleState {
  const attacker = activeCombatant(input.state);
  if (attacker === null) return input.state;
  return settled(input.state, resolveAttack({ ...input, attackerId: attacker.id }));
}

export function battleEnemyTurn(input: BattleEnemyTurnInput): BattleState {
  const next = enemiesAct({ state: input.state, rng: input.rng, strategy: input.strategy });
  return settled(input.state, next);
}

/** Base de dégâts tirée dans la plage YAML du sort, un seul jet consommé. */
export function rollSpellBase(spell: SpellDef, rng: Rng): number {
  const range = spell.damage;
  if (range === undefined) return 0;
  return range.min + Math.floor(rng() * (range.max - range.min + 1));
}

/**
 * Pont `SpellDef` → `AttackSpec` pour le 1vN. Le CC vient **du sort** :
 * `critRate` (dénominateur `1/X`) et `critDamage` (jet max) restent absents
 * tant que la donnée 1.29 n'est pas sourcée — **absent = aucun CC**, donc
 * aucun « 2 % fantôme » inventé (SPELL-03).
 */
export function spellAttackSpec(spell: SpellDef, roll: number): AttackSpec {
  const element = spell.element ?? "neutral";
  const crit = { critRate: spell.critRate, critMax: spell.critDamage };
  return { base: roll, element, ...crit, apCost: spell.apCost, pushCells: spell.pushCells ?? 0 };
}

/** Même spec, portée YAML comprise : le moteur refuse alors hors bornes et sans LoS. */
export function spellCastSpec(spell: SpellDef, roll: number): AttackSpec {
  const range = { minRange: spell.minRange, maxRange: spell.maxRange, requiresLos: spell.requiresLos };
  const quotas = { spellId: spell.id, castsPerTurn: spell.castsPerTurn, cooldown: spell.cooldown };
  return { ...spellAttackSpec(spell, roll), ...range, ...quotas };
}

/**
 * Spec du **jeu réel** : la fourchette part au moteur, qui décide le CC (jet
 * max) **avant** de consommer le dé de dégâts. Un sort sans `damage` garde
 * `base` comme attaque nue.
 */
export function spellRollSpec(spell: SpellDef): AttackSpec {
  const fixed = spellCastSpec(spell, spell.damage?.min ?? 0);
  return spell.damage === undefined ? fixed : { ...fixed, damage: spell.damage };
}

function pairFor(state: BattleState, targetId: string): CombatantPair | null {
  const attacker = activeCombatant(state);
  const target = findCombatant(state, targetId);
  if (attacker === null) return null;
  return target === undefined ? null : { attacker, target };
}

/** Le refus géométrique n'est journalisé que pour un coup par ailleurs valide. */
function isStrikable(pair: CombatantPair, attack: AttackSpec): boolean {
  const opposed = pair.attacker.side !== pair.target.side && pair.target.hp > 0;
  return opposed && attack.apCost <= pair.attacker.ap;
}

function canMeasure(state: BattleState, range: RangeSpec | undefined): range is RangeSpec {
  return range !== undefined && state.map !== undefined;
}

function checkableCast(state: BattleState, targetId: string, attack: AttackSpec): GeometricPair | null {
  const pair = pairFor(state, targetId);
  const range = rangeOf(attack);
  if (pair === null || !canMeasure(state, range)) return null;
  return isStrikable(pair, attack) ? { ...pair, range } : null;
}

/**
 * Raison lisible du refus (portée/LoS), `null` si le coup reste possible.
 * Réservée à l'affichage : le moteur, lui, refuse silencieusement par identité.
 */
export function castRefusal(state: BattleState, targetId: string, attack: AttackSpec): string | null {
  const pair = checkableCast(state, targetId, attack);
  if (pair === null) return null;
  const block = castBlock({ state, attacker: pair.attacker, target: pair.target, range: pair.range });
  return block === null ? null : `${pair.attacker.name} : ${CAST_BLOCK_LABEL[block]}.`;
}

export interface SpellStrategyInput {
  spells: readonly SpellDef[];
}

interface StrategyContext {
  state: BattleState;
  enemy: CombatantLike;
  spells: readonly SpellDef[];
}

function damageSpells(spells: readonly SpellDef[]): SpellDef[] {
  return spells.filter((spell) => spell.kind === "damage" && spell.damage !== undefined);
}

function affordable(spells: readonly SpellDef[], ap: number): SpellDef[] {
  return spells.filter((spell) => spell.apCost <= ap);
}

/** Le moins cher gagne ; à coût égal, l'ordre des `spellIds` tranche (déterministe). */
function cheapest(spells: readonly SpellDef[]): SpellDef | null {
  return spells.reduce<SpellDef | null>((best, spell) => {
    if (best === null || spell.apCost < best.apCost) return spell;
    return best;
  }, null);
}

/** Repli sans carte : le moins cher des sorts payables, sans notion de portée. */
function cheapestAffordable(context: StrategyContext): SpellDef | null {
  const payable = affordable(damageSpells(context.spells), context.enemy.ap);
  const available = payable.filter((spell) => canCastSpellNow(context.state, context.enemy.id, spell));
  return cheapest(available);
}

/**
 * Sorts payables, à portée et **hors recharge** : un sort dont `castsPerTurn`
 * est épuisé ou qui attend son `cooldown` n'est pas proposé, sinon le moteur le
 * refuserait et le monstre perdrait son tour.
 */
function castableSpells(context: StrategyContext, target: CombatantLike): SpellDef[] {
  const payable = affordable(damageSpells(context.spells), context.enemy.ap);
  const reaching = payable.filter((spell) => spellReaches(context, target, spell));
  return reaching.filter((spell) => canCastSpellNow(context.state, context.enemy.id, spell));
}

function spellReaches(context: StrategyContext, target: CombatantLike, spell: SpellDef): boolean {
  const range = { min: spell.minRange, max: spell.maxRange, requiresLos: spell.requiresLos };
  const check = { state: context.state, attacker: context.enemy, target, range };
  return castBlock(check) === null;
}

/**
 * Cible le héros (unique camp adverse en 1vN), jamais une cible morte. Le dé
 * reste au moteur : il décide le CC avant de consommer le tirage de dégâts.
 */
function attackOn(target: CombatantLike, spell: SpellDef): EnemyAction {
  const attack = { ...spellRollSpec(spell), spellName: spell.name };
  return { kind: "attack", targetId: target.id, attack };
}

/** Sans carte, aucune géométrie : comportement historique (le moins cher, sans portée). */
function noMapAction(context: StrategyContext, target: CombatantLike): EnemyAction | null {
  const spell = cheapestAffordable(context);
  return spell === null ? null : attackOn(target, spell);
}

function blockedReason(context: StrategyContext): string {
  return context.enemy.mp > 0 ? "chemin bloqué" : "PM épuisés";
}

/** Aucun sort à portée : on approche d'au plus les PM restants, sinon on journalise. */
function approachAction(context: StrategyContext, target: CombatantLike): EnemyAction {
  const options = { state: context.state, enemy: context.enemy, target, cells: context.enemy.mp };
  const cell = approachCell(options);
  if (cell !== null) return { kind: "move", to: cell };
  return { kind: "blocked", reason: blockedReason(context) };
}

function mappedAction(context: StrategyContext, target: CombatantLike): EnemyAction {
  const spell = cheapest(castableSpells(context, target));
  if (spell !== null) return attackOn(target, spell);
  return approachAction(context, target);
}

interface Placement {
  context: StrategyContext;
  target: CombatantLike;
  plan: EnemyPlan;
  aim: EnemyAim;
}

function shouldStrike(plan: EnemyPlan, placed: boolean, spell: SpellDef | null): spell is SpellDef {
  if (spell === null) return false;
  return plan.aggressive || placed;
}

function moveAway(input: Placement): EnemyAction | null {
  const { context, target, aim } = input;
  const cells = context.enemy.mp;
  const options = { state: context.state, enemy: context.enemy, target, distance: aim.distance, cells, requiresLos: aim.requiresLos };
  const cell = keepDistanceCell(options);
  return cell === null ? null : { kind: "move", to: cell };
}

function fallbackAction(input: Placement, spell: SpellDef | null): EnemyAction {
  if (spell !== null) return attackOn(input.target, spell);
  return approachAction(input.context, input.target);
}

/** `ai.preferredDistance > 1` : se placer à portée, attaquer, ne pas coller. */
function distanceAction(input: Placement): EnemyAction | null {
  const { context, target, plan, aim } = input;
  const spell = cheapest(castableSpells(context, target));
  const placed = rangeDistance(context.enemy.position, target.position) === aim.distance;
  if (shouldStrike(plan, placed, spell)) return attackOn(target, spell);
  if (placed) return null;
  return moveAway(input) ?? fallbackAction(input, spell);
}

/** Une distance ramenée à 1 reste le contact historique : aucune régression. */
function plannedAction(context: StrategyContext, target: CombatantLike): EnemyAction | null {
  const plan = enemyStrategy(context.enemy);
  const aim = aimOf(plan, damageSpells(context.spells));
  if (plan.rushes || aim.distance <= 1) return mappedAction(context, target);
  return distanceAction({ context, target, plan, aim });
}

function strategyAction(context: StrategyContext): EnemyAction | null {
  const target = targetsOf(context.state, context.enemy.side)[0];
  if (target === undefined) return null;
  if (context.state.map === undefined) return noMapAction(context, target);
  return plannedAction(context, target);
}

function strategyForEnemy(input: SpellStrategyInput, state: BattleState, enemyId: string): EnemyAction | null {
  const enemy = findCombatant(state, enemyId);
  if (enemy === undefined) return null;
  return strategyAction({ ...input, state, enemy });
}

/**
 * Stratégie ennemie pilotée par les sorts du monstre : elle emprunte **le même
 * chemin** que le héros (`spellRollSpec`), donc aucune valeur de dégâts n'est
 * écrite à la main dans `src/`, et le dé reste au moteur (SPELL-03). **Distance-aware** : seuls les
 * sorts dont la portée contient la distance et dont la LoS passe sont joués ;
 * sinon le monstre **approche** avec ses PM (`kind: "move"`) et attaque dès
 * qu'il est à portée, dans le même tour. Sans carte, aucune géométrie : le
 * moins cher des sorts payables, comme avant.
 */
export function spellStrategy(input: SpellStrategyInput): EnemyStrategy {
  return (state, enemyId) => strategyForEnemy(input, state, enemyId);
}

export interface EnemyTurnsInput {
  state: BattleState;
  strategyFor: (enemy: CombatantLike) => EnemyStrategy;
  rng: Rng;
  maxSteps?: number;
}

function isBattleOver(state: BattleState): boolean {
  return isDefeat(state) || isVictory(state);
}

/** Côté qui a la main : la scène l'expose (`data-turn-side`), le panneau s'y soumet. */
export function turnSide(state: BattleState | null): Side | null {
  if (state === null) return null;
  return activeCombatant(state)?.side ?? null;
}

/** Verdict de fin de salle : la mort du héros prime sur l'annihilation mutuelle. */
export type BattleOutcome = "victory" | "defeat";

export function battleOutcome(state: BattleState | null): BattleOutcome | null {
  if (state === null) return null;
  if (isDefeat(state)) return "defeat";
  if (isVictory(state)) return "victory";
  return null;
}

/** La main est au héros : partagé par la cadence et la barre de sorts unifiée. */
export function heroHasHand(state: BattleState): boolean {
  return turnSide(state) === "player";
}

function enemyStep(input: EnemyTurnsInput, state: BattleState): BattleState {
  const enemy = activeCombatant(state);
  if (enemy === null) return state;
  const next = battleEnemyTurn({ state, strategy: input.strategyFor(enemy), rng: input.rng });
  if (isBattleOver(next)) return next;
  return advanceTurn(next);
}

/**
 * Un **seul** pas ennemi, sans changer le comportement de la boucle : c'est
 * exactement l'itération de `playEnemyTurns`, exposée pour que l'UI puisse
 * espacer les actions (une action = un pas, jamais N tours dans le même tick).
 */
export function enemyStepOnce(input: EnemyTurnsInput, state: BattleState): BattleState {
  return enemyStep(input, state);
}

/**
 * Un pas de la cadence, préfixe héros compris : la main du héros passe d'abord
 * (`advanceTurn`), puis chaque appel ne joue qu'un tour ennemi.
 */
export function playStepOnce(input: EnemyTurnsInput): BattleState {
  if (heroHasHand(input.state)) return advanceTurn(input.state);
  return enemyStepOnce(input, input.state);
}

/**
 * Reste-t-il un pas à jouer ? `started === false` couvre le **premier** pas,
 * même quand le héros a la main : c'est son tour qui passe, comme dans
 * `playEnemyTurns`. Bataille finie ou absente : plus rien n'est dû.
 */
export function needsEnemyStep(state: BattleState | null, started: boolean): boolean {
  if (state === null || isBattleOver(state)) return false;
  return started ? !heroHasHand(state) : true;
}

/**
 * Ouverture de combat : l'ennemi a la main au montage du panneau, donc la
 * cadence doit démarrer **sans clic**. `started: true` est essentiel : il ne
 * couvre pas le passage du tour du héros, contrairement au premier pas.
 */
export function openingBeatNeeded(state: BattleState | null): boolean {
  return needsEnemyStep(state, true);
}

/** Ce que la chaîne planifiée sait d'elle-même au moment où le minuteur tire. */
export interface OpeningStepInput {
  /** `true` : chaîne née de l'ouverture ; `false` : chaîne née d'un « terminer le tour ». */
  openingOnly: boolean;
  battle: BattleState | null;
}

/**
 * Verdict **au tir** : une chaîne d'ouverture ne joue que si l'ennemi a encore
 * la main. Un héros qui l'a reprise entre la planification et le timer garde
 * son tour. Une chaîne `endTurn` doit toujours pouvoir passer la main du héros.
 */
export function openingStepAllowed(input: OpeningStepInput): boolean {
  if (input.battle === null || isBattleOver(input.battle)) return false;
  if (!input.openingOnly) return true;
  return openingBeatNeeded(input.battle);
}

function stepLimit(input: EnemyTurnsInput): number {
  return input.maxSteps ?? MAX_ENEMY_STEPS;
}

function enemyLoop(input: EnemyTurnsInput, state: BattleState, steps: number): BattleState {
  if (steps >= stepLimit(input)) return appendBattleLog(state, STALL_LOG);
  if (isBattleOver(state) || heroHasHand(state)) return state;
  return enemyLoop(input, enemyStep(input, state), steps + 1);
}

/**
 * Joue les tours ennemis jusqu'à ce que la main revienne au héros ou que la
 * bataille soit finie. Un héros actif voit d'abord son tour passer. **Borne
 * dure** (`maxSteps`) : une timeline qui ne rendrait jamais la main est
 * interrompue et journalisée, jamais bouclée à l'infini.
 */
export function playEnemyTurns(input: EnemyTurnsInput): BattleState {
  if (isBattleOver(input.state) || !heroHasHand(input.state)) return enemyLoop(input, input.state, 0);
  return enemyLoop(input, advanceTurn(input.state), 0);
}
