import {
  activeCombatant,
  advanceTurn,
  enemiesAct,
  findCombatant,
  isDefeat,
  isVictory,
  resolveAttack,
  targetsOf,
} from "../engine/multiCombat";
import type { AttackSpec, BattleState, CombatantLike, EnemyAction, EnemyStrategy, Rng } from "../engine/multiCombat";
import type { SpellDef } from "../schemas/spellSchema";

export const VICTORY_LOG = "Victoire : la salle est nettoyée.";
export const DEFEAT_LOG = "Défaite : le héros tombe dans la salle.";
export const STALL_LOG = "La mêlée s'enlise : la main revient au joueur.";
/** Borne dure : aucune boucle de tours ennemis ne peut dépasser ce nombre d'itérations. */
export const MAX_ENEMY_STEPS = 32;

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
 * ne porte pas encore de taux de critique, on n'en invente pas.
 */
export function spellAttackSpec(spell: SpellDef, roll: number): AttackSpec {
  const element = spell.element ?? "neutral";
  return { base: roll, element, baseCrit: 0, apCost: spell.apCost, pushCells: spell.pushCells ?? 0 };
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

function usableSpell(enemy: CombatantLike, spells: readonly SpellDef[]): SpellDef | null {
  return cheapest(affordable(damageSpells(spells), enemy.ap));
}

/** Cible le héros (unique camp adverse en 1vN), jamais une cible morte. */
function attackOn(context: StrategyContext, spell: SpellDef): EnemyAction | null {
  const target = targetsOf(context.state, context.enemy.side)[0];
  if (target === undefined) return null;
  const base = rollSpellBase(spell, context.rng);
  const attack = { ...spellAttackSpec(spell, base), spellName: spell.name };
  return { kind: "attack", targetId: target.id, attack };
}

function strategyAction(context: StrategyContext): EnemyAction | null {
  const spell = usableSpell(context.enemy, context.spells);
  if (spell === null) return null;
  return attackOn(context, spell);
}

function strategyForEnemy(input: SpellStrategyInput, state: BattleState, enemyId: string): EnemyAction | null {
  const enemy = findCombatant(state, enemyId);
  if (enemy === undefined) return null;
  return strategyAction({ ...input, state, enemy });
}

/**
 * Stratégie ennemie pilotée par les sorts du monstre : elle emprunte **le même
 * chemin** que le héros (`rollSpellBase` + `spellAttackSpec`), donc aucune
 * valeur de dégâts n'est écrite à la main dans `src/`.
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
