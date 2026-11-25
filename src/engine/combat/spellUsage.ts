/**
 * Quotas de lancement lus dans `data/spells.yaml` : `castsPerTurn` (nombre
 * maximum de lancements de CE sort par tour et par lanceur), `castsPerTarget`
 * (lancers sur une **même** cible pendant ce tour) et `cooldown` (nombre de
 * tours d'indisponibilité après un lancement). En 1.29, `0` est la sentinelle
 * « aucune limite » (toujours présente dans le record de sort) : elle vaut
 * absence ici — cf. `normalizeLimit`.
 *
 * L'état vit dans la bataille (`BattleState.spellUsage`), jamais dans une
 * variable de module : deux salles, deux batailles, deux compteurs. Le tour qui
 * a compté les lancements est mémorisé (`SpellUsage.turn`) : dès que le tour
 * change, **les deux** quotas repartent de zéro sans remise à zéro explicite à
 * oublier — `casts` et `castsByTarget` partagent la même estampille de tour.
 */
export interface SpellLimit {
  castsPerTurn?: number | undefined;
  castsPerTarget?: number | undefined;
  cooldown?: number | undefined;
}

export interface SpellUsage {
  /** Lancements de ce sort pendant `turn`. */
  casts: number;
  /** Tour du dernier lancement compté. */
  turn: number;
  /** Premier tour où le sort redevient lançable (0 = aucune recharge). */
  readyAt: number;
  /** Lancements par identité de cible pendant `turn` (même remise à zéro que `casts`). */
  castsByTarget?: Readonly<Record<string, number>> | undefined;
}

export type SpellUsageMap = Readonly<Record<string, SpellUsage>>;

export interface SpellUsageInput {
  usage: SpellUsageMap;
  /** Clé `lanceur:sort`, cf. `spellUsageKey`. */
  key: string;
  limit: SpellLimit;
  turn: number;
  /** Cible visée : sans elle, seul `castsPerTurn` est vérifié. */
  targetId?: string | undefined;
}

export function spellUsageKey(casterId: string, spellId: string): string {
  return `${casterId}:${spellId}`;
}

/** `0` est la sentinelle 1.29 de « aucune limite » (Pression #141 = `0,0`). */
function capOf(max: number | undefined): number | undefined {
  return max === 0 ? undefined : max;
}

/**
 * **Une seule** normalisation décide de la sentinelle : `0` vaut absence, donc
 * « illimité », pour le quota du tour, le quota par cible et l'armement de la
 * recharge. Aucun consommateur ne compare jamais un compteur à `0`.
 */
function normalizeLimit(limit: SpellLimit): SpellLimit {
  return {
    castsPerTurn: capOf(limit.castsPerTurn),
    castsPerTarget: capOf(limit.castsPerTarget),
    cooldown: limit.cooldown,
  };
}

/** Aucun quota déclaré : le sort n'est limité que par les PA du lanceur. */
function hasLimit(limit: SpellLimit): boolean {
  const { castsPerTurn, castsPerTarget, cooldown } = limit;
  return castsPerTurn !== undefined || castsPerTarget !== undefined || cooldown !== undefined;
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

function sameTurn(usage: SpellUsage | undefined, turn: number): boolean {
  return usage !== undefined && usage.turn === turn;
}

function countOn(counts: Readonly<Record<string, number>> | undefined, targetId: string): number {
  return counts?.[targetId] ?? 0;
}

/** Lancements sur cette cible pendant `turn` ; 0 dès que le tour a changé. */
function targetCastsOn(usage: SpellUsage | undefined, turn: number, targetId: string): number {
  if (!sameTurn(usage, turn)) return 0;
  return countOn(usage?.castsByTarget, targetId);
}

function withinTargetQuota(usage: SpellUsage | undefined, input: SpellUsageInput): boolean {
  const max = input.limit.castsPerTarget;
  if (max === undefined || input.targetId === undefined) return true;
  return targetCastsOn(usage, input.turn, input.targetId) < max;
}

/** `true` si le sort peut encore être lancé à ce tour par ce lanceur. */
export function isSpellAvailable(input: SpellUsageInput): boolean {
  const quota = { ...input, limit: normalizeLimit(input.limit) };
  if (!hasLimit(quota.limit)) return true;
  const usage = quota.usage[quota.key];
  if (!isReady(usage, quota.turn)) return false;
  return withinQuota(usage, quota.limit, quota.turn) && withinTargetQuota(usage, quota);
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

/** Cible à compter : aucune si le sort ne déclare pas `castsPerTarget`. */
function targetIdOf(input: SpellUsageInput): string | undefined {
  return input.limit.castsPerTarget === undefined ? undefined : input.targetId;
}

/** Carte par cible du tour courant ; vide dès que le tour a changé. */
function countsOn(previous: SpellUsage | undefined, turn: number): Readonly<Record<string, number>> {
  if (previous === undefined || previous.turn !== turn) return {};
  return previous.castsByTarget ?? {};
}

/**
 * Compteur par cible du lancer enregistré. Sans `castsPerTarget` (ou sans
 * cible connue), la carte précédente est rendue telle quelle : aucun état
 * inutile pour les sorts qui ne déclarent pas la règle.
 */
function nextTargetCasts(input: SpellUsageInput, previous: SpellUsage | undefined): Readonly<Record<string, number>> | undefined {
  const targetId = targetIdOf(input);
  if (targetId === undefined) return previous?.castsByTarget;
  const base = countsOn(previous, input.turn);
  return { ...base, [targetId]: (base[targetId] ?? 0) + 1 };
}

/**
 * Enregistre un lancement. Sans quota déclaré, la carte est rendue **par
 * identité** : aucun état inutile dans les batailles qui n'en ont pas besoin.
 * `0` est normalisé en « illimité » avant toute décision, comme pour la
 * disponibilité : une sentinelle 1.29 ne crée donc jamais de compteur.
 */
export function recordSpellCast(input: SpellUsageInput): SpellUsageMap {
  const quota = { ...input, limit: normalizeLimit(input.limit) };
  if (!hasLimit(quota.limit)) return input.usage;
  const previous = input.usage[input.key];
  const casts = castsOn(previous, input.turn) + 1;
  const readyAt = nextReadyAt({ limit: quota.limit, turn: input.turn, previous, casts });
  const castsByTarget = nextTargetCasts(quota, previous);
  return { ...input.usage, [input.key]: { casts, turn: input.turn, readyAt, castsByTarget } };
}
