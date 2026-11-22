import {
  activeCombatant,
  advanceTurn,
  approachCell,
  castBlock,
  enemiesAct,
  findCombatant,
  isDefeat,
  isVictory,
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
  EnemyStrategy,
  RangeSpec,
  Rng,
} from "../engine/multiCombat";
import type { SpellDef } from "../schemas/spellSchema";

export const VICTORY_LOG = "Victoire : la salle est nettoyée.";
export const DEFEAT_LOG = "Défaite : le héros tombe dans la salle.";
export const STALL_LOG = "La mêlée s'enlise : la main revient au joueur.";
/** Borne dure : aucune boucle de tours ennemis ne peut dépasser ce nombre d'itérations. */
export const MAX_ENEMY_STEPS = 32;
/** Raisons de refus géométrique, telles que le joueur les lit dans le journal. */
export const CAST_BLOCK_LABEL: Record<CastBlock, string> = {
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
 * Pont `SpellDef` → `AttackSpec` pour le 1vN. `baseCrit: 0` : `data/spells.yaml`
 * ne porte pas encore de taux de critique, on n'en invente pas. La géométrie
 * (portée, LoS) est ajoutée par `spellCastSpec`, jamais ici : les attaques nues
 * et les tests historiques gardent exactement cette forme.
 */
export function spellAttackSpec(spell: SpellDef, roll: number): AttackSpec {
  const element = spell.element ?? "neutral";
  return { base: roll, element, baseCrit: 0, apCost: spell.apCost, pushCells: spell.pushCells ?? 0 };
}

/** Même spec, portée YAML comprise : le moteur refuse alors hors bornes et sans LoS. */
export function spellCastSpec(spell: SpellDef, roll: number): AttackSpec {
  const range = { minRange: spell.minRange, maxRange: spell.maxRange, requiresLos: spell.requiresLos };
  return { ...spellAttackSpec(spell, roll), ...range };
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
  rng: Rng;
}

interface StrategyContext {
  state: BattleState;
  enemy: CombatantLike;
  spells: readonly SpellDef[];
  rng: Rng;
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
function cheapestAffordable(enemy: CombatantLike, spells: readonly SpellDef[]): SpellDef | null {
  return cheapest(affordable(damageSpells(spells), enemy.ap));
}

/** Sorts payables dont la portée contient la distance réelle et dont la LoS passe. */
function castableSpells(context: StrategyContext, target: CombatantLike): SpellDef[] {
  const affordableSpells = affordable(damageSpells(context.spells), context.enemy.ap);
  return affordableSpells.filter((spell) => spellReaches(context, target, spell));
}

function spellReaches(context: StrategyContext, target: CombatantLike, spell: SpellDef): boolean {
  const range = { min: spell.minRange, max: spell.maxRange, requiresLos: spell.requiresLos };
  const check = { state: context.state, attacker: context.enemy, target, range };
  return castBlock(check) === null;
}

/** Cible le héros (unique camp adverse en 1vN), jamais une cible morte. */
function attackOn(context: StrategyContext, target: CombatantLike, spell: SpellDef): EnemyAction {
  const base = rollSpellBase(spell, context.rng);
  const attack = { ...spellCastSpec(spell, base), spellName: spell.name };
  return { kind: "attack", targetId: target.id, attack };
}

/** Sans carte, aucune géométrie : comportement historique (le moins cher, sans portée). */
function noMapAction(context: StrategyContext, target: CombatantLike): EnemyAction | null {
  const spell = cheapestAffordable(context.enemy, context.spells);
  return spell === null ? null : attackOn(context, target, spell);
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
  if (spell !== null) return attackOn(context, target, spell);
  return approachAction(context, target);
}

function strategyAction(context: StrategyContext): EnemyAction | null {
  const target = targetsOf(context.state, context.enemy.side)[0];
  if (target === undefined) return null;
  if (context.state.map === undefined) return noMapAction(context, target);
  return mappedAction(context, target);
}

function strategyForEnemy(input: SpellStrategyInput, state: BattleState, enemyId: string): EnemyAction | null {
  const enemy = findCombatant(state, enemyId);
  if (enemy === undefined) return null;
  return strategyAction({ ...input, state, enemy });
}

/**
 * Stratégie ennemie pilotée par les sorts du monstre : elle emprunte **le même
 * chemin** que le héros (`rollSpellBase` + `spellCastSpec`), donc aucune valeur
 * de dégâts n'est écrite à la main dans `src/`. **Distance-aware** : seuls les
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

function heroHasHand(state: BattleState): boolean {
  return activeCombatant(state)?.side === "player";
}

function enemyStep(input: EnemyTurnsInput, state: BattleState): BattleState {
  const enemy = activeCombatant(state);
  if (enemy === null) return state;
  const next = battleEnemyTurn({ state, strategy: input.strategyFor(enemy), rng: input.rng });
  if (isBattleOver(next)) return next;
  return advanceTurn(next);
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
