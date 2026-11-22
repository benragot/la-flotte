/**
 * Port de la suite navigateur Playwright.
 *
 * Plusieurs worktrees tournent en parallèle : un port figé à 4173 fait qu'une
 * suite mesure le serveur d'une autre branche (vert sur du mauvais code) ou
 * refuse de mesurer. Le port est donc paramétrable, et un port explicite
 * interdit la réutilisation d'un serveur qu'on n'a pas démarré.
 */

export const DEFAULT_PORT = 4173;

/** Sous-ensemble de `process.env` suffisant : testable sans toucher au process. */
export type Env = Record<string, string | undefined>;

const MIN_PORT = 1;
const MAX_PORT = 65535;

/** Lit le port demandé, ou `undefined` si absent/vide. */
function requestedPort(env: Env): string | undefined {
  const raw = env.PLAYWRIGHT_PORT?.trim();
  return raw === "" ? undefined : raw;
}

/** Refuse bruyamment une valeur illisible : retomber sur 4173 rejouerait le bug. */
function parsePort(raw: string): number {
  const port = Number(raw);
  const valid = Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
  if (!valid) {
    throw new Error(`PLAYWRIGHT_PORT invalide : « ${raw} » (attendu un entier 1-65535)`);
  }
  return port;
}

/** Port d'écoute de la suite : `PLAYWRIGHT_PORT` sinon 4173. */
export function resolvePort(env: Env): number {
  const raw = requestedPort(env);
  return raw === undefined ? DEFAULT_PORT : parsePort(raw);
}

/**
 * `false` dès qu'un port explicite est demandé : réutiliser un serveur qu'on
 * n'a pas démarré, c'est accepter de mesurer du code inconnu.
 */
export function shouldReuseServer(env: Env): boolean {
  if (requestedPort(env) !== undefined) return false;
  return env.CI === undefined;
}
