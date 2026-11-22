/**
 * Quotas de lancement lus dans `data/spells.yaml` : `castsPerTurn` (nombre
 * maximum de lancements de CE sort par tour et par lanceur) et `cooldown`
 * (nombre de tours d'indisponibilité après un lancement).
 *
 * L'état vit dans la bataille (`BattleState.spellUsage`), jamais dans une
 * variable de module : deux salles, deux batailles, deux compteurs. Le tour qui
 * a compté les lancements est mémorisé (`SpellUsage.turn`) : dès que le tour
 * change, le quota repart de zéro sans remise à zéro explicite à oublier.
 */
export interface SpellLimit {
  castsPerTurn?: number | undefined;
  cooldown?: number | undefined;
}

export interface SpellUsage {
  /** Lancements de ce sort pendant `turn`. */
  casts: number;
  /** Tour du dernier lancement compté. */
  turn: number;
  /** Premier tour où le sort redevient lançable (0 = aucune recharge). */
  readyAt: number;
}

export type SpellUsageMap = Readonly<Record<string, SpellUsage>>;

export interface SpellUsageInput {
  usage: SpellUsageMap;
  /** Clé `lanceur:sort`, cf. `spellUsageKey`. */
  key: string;
  limit: SpellLimit;
  turn: number;
}

export function spellUsageKey(casterId: string, spellId: string): string {
  return `${casterId}:${spellId}`;
}

/** Aucun quota déclaré : le sort n'est limité que par les PA du lanceur. */
function hasLimit(limit: SpellLimit): boolean {
  return limit.castsPerTurn !== undefined || limit.cooldown !== undefined;
}

function castsOn(usage: SpellUsage | undefined, turn: number): number {
  return usage !== undefined && usage.turn === turn ? usage.casts : 0;
}

function isReady(usage: SpellUsage | undefined, turn: number): boolean {
  return usage === undefined || usage.readyAt <= turn;
}

function withinQuota(usage: SpellUsage | undefined, limit: SpellLimit, turn: number): boolean {
  const max = limit.castsPerTurn;
  return max === undefined || castsOn(usage, turn) < max;
}

/** `true` si le sort peut encore être lancé à ce tour par ce lanceur. */
export function isSpellAvailable(input: SpellUsageInput): boolean {
  if (!hasLimit(input.limit)) return true;
  const usage = input.usage[input.key];
  if (!isReady(usage, input.turn)) return false;
  return withinQuota(usage, input.limit, input.turn);
}

/** Recharge : `cooldown: 2` lancé au tour 1 => indisponible en 2 et 3, prêt en 4. */
function nextReadyAt(limit: SpellLimit, turn: number, previous: SpellUsage | undefined): number {
  if (limit.cooldown === undefined) return previous?.readyAt ?? 0;
  return turn + limit.cooldown + 1;
}

/**
 * Enregistre un lancement. Sans quota déclaré, la carte est rendue **par
 * identité** : aucun état inutile dans les batailles qui n'en ont pas besoin.
 */
export function recordSpellCast(input: SpellUsageInput): SpellUsageMap {
  if (!hasLimit(input.limit)) return input.usage;
  const previous = input.usage[input.key];
  const casts = castsOn(previous, input.turn) + 1;
  const readyAt = nextReadyAt(input.limit, input.turn, previous);
  return { ...input.usage, [input.key]: { casts, turn: input.turn, readyAt } };
}
