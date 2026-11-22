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

/** Reste-t-il un lancement autorisé CE tour ? (quota non encore atteint) */
function quotaLeft(limit: SpellLimit, casts: number): boolean {
  return limit.castsPerTurn !== undefined && casts < limit.castsPerTurn;
}

function previousReadyAt(previous: SpellUsage | undefined): number {
  return previous?.readyAt ?? 0;
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

/** Contexte de calcul de la recharge armée par un lancement. */
interface ReadyInput {
  limit: SpellLimit;
  turn: number;
  previous: SpellUsage | undefined;
  /** Lancements comptés CE tour, celui qui vient d'être enregistré inclus. */
  casts: number;
}

/**
 * Recharge : `cooldown: 2` lancé au tour 1 => indisponible en 2 et 3, prêt en 4.
 *
 * La recharge n'est armée que lorsque le **quota du tour est épuisé**. Un sort
 * `castsPerTurn: 2, cooldown: 2` reste donc lançable DEUX fois au même tour :
 * le `cooldown` ne commence qu'après le dernier lancement autorisé. Sans
 * `castsPerTurn` (pas de quota déclaré), tout lancement arme la recharge —
 * sinon un `cooldown` seul ne ferait rien.
 */
function nextReadyAt(input: ReadyInput): number {
  if (input.limit.cooldown === undefined || quotaLeft(input.limit, input.casts)) {
    return previousReadyAt(input.previous);
  }
  return input.turn + input.limit.cooldown + 1;
}

/**
 * Enregistre un lancement. Sans quota déclaré, la carte est rendue **par
 * identité** : aucun état inutile dans les batailles qui n'en ont pas besoin.
 */
export function recordSpellCast(input: SpellUsageInput): SpellUsageMap {
  if (!hasLimit(input.limit)) return input.usage;
  const previous = input.usage[input.key];
  const casts = castsOn(previous, input.turn) + 1;
  const readyAt = nextReadyAt({ limit: input.limit, turn: input.turn, previous, casts });
  return { ...input.usage, [input.key]: { casts, turn: input.turn, readyAt } };
}
