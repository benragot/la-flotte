/**
 * Port de la suite navigateur Playwright.
 *
 * Plusieurs worktrees tournent en parallèle : un port figé à 4173 fait qu'une
 * suite mesure le serveur d'une autre branche (vert sur du mauvais code) ou
 * refuse de mesurer. Le port se dérive donc du chemin du worktree, et
 * `--strictPort` fait échouer bruyamment une collision au lieu de glisser en
 * silence sur un port libre.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

/** Sous-ensemble de `process.env` suffisant : testable sans toucher au process. */
export type Env = Record<string, string | undefined>;

const MIN_PORT = 1;
const MAX_PORT = 65535;

/** Plage des ports dérivés : ni 4173 ni 5173, les deux ports partagés connus. */
export const DERIVED_PORT_MIN = 4300;
export const DERIVED_PORT_MAX = 4799;

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

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

/** FNV-1a 32 bits : déterministe d'une machine et d'un run à l'autre. */
function hashPath(value: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash;
}

/** Port propre au worktree : deux racines distinctes, deux ports distincts. */
function derivePort(rootDir: string): number {
  const normalized = path.resolve(rootDir);
  const span = DERIVED_PORT_MAX - DERIVED_PORT_MIN + 1;
  return DERIVED_PORT_MIN + (hashPath(normalized) % span);
}

/** Port d'écoute : `PLAYWRIGHT_PORT` s'il est demandé, sinon celui du worktree. */
export function resolvePort(env: Env, rootDir: string): number {
  const raw = requestedPort(env);
  return raw === undefined ? derivePort(rootDir) : parsePort(raw);
}

/** Racine du worktree : ce module vit dans `<racine>/tests/ui/`. */
export function suiteRoot(): string {
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), "..", "..");
}

/** Commande du serveur : `--strictPort` interdit à Vite de glisser ailleurs. */
export function devCommand(port: number): string {
  return `npm run dev -- --port ${port} --strictPort`;
}

/** Phrase de tête de run : sans elle, un serveur voisin reste invisible. */
export function serverBanner(port: number, rootDir: string): string {
  const root = path.resolve(rootDir);
  return `Playwright : http://localhost:${port} — worktree ${root} (serveur dédié, jamais réutilisé)`;
}
