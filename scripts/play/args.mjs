/**
 * Options de `npm run play`. Aucune valeur par défaut n'est partagée avec
 * `playwright.config.ts` : ce dernier code le port 4173 en dur et réutilise un
 * serveur existant, ce qui peut jouer le code d'un AUTRE worktree.
 */

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_OUT = "play-report";
const VIEWPORT_PATTERN = /^(\d+)x(\d+)$/i;

export const USAGE = "npm run play -- [--viewport 1280x720] [--out play-report] [--port 5199] [--headed]";

/** `--viewport 1920x1080` ⇒ `{ width: 1920, height: 1080 }`. */
export function parseViewport(raw) {
  const match = VIEWPORT_PATTERN.exec(String(raw).trim());
  if (match === null) throw new Error(`Viewport invalide « ${raw} » : attendu LARGExHAUTEUR, ex. 1280x720.`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseNumber(name, raw) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} attendu : entier positif, reçu « ${raw} ».`);
  return value;
}

function requireValue(flag, value) {
  if (value === undefined || value.startsWith("--")) throw new Error(`Option « ${flag} » sans valeur.\n${USAGE}`);
  return value;
}

const FLAGS = {
  "--viewport": { value: true, apply: (args, value) => { args.viewport = parseViewport(requireValue("--viewport", value)); } },
  "--out": { value: true, apply: (args, value) => { args.out = requireValue("--out", value); } },
  "--port": { value: true, apply: (args, value) => { args.port = parseNumber("--port", requireValue("--port", value)); } },
  "--headed": { value: false, apply: (args) => { args.headless = false; } },
};

function defaults(env) {
  const width = env.PLAY_VIEWPORT ?? `${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}`;
  return {
    viewport: parseViewport(width),
    out: env.PLAY_OUT ?? DEFAULT_OUT,
    port: env.PLAY_PORT === undefined ? null : parseNumber("PLAY_PORT", env.PLAY_PORT),
    headless: env.PLAY_HEADED !== "1",
  };
}

function applyFlag(argv, index, args) {
  const spec = FLAGS[argv[index]];
  if (spec === undefined) throw new Error(`Option inconnue « ${argv[index]} ».\n${USAGE}`);
  spec.apply(args, spec.value ? argv[index + 1] : undefined);
  return spec.value ? index + 1 : index;
}

export function parseArgs(argv, env = {}) {
  const args = defaults(env);
  let index = 0;
  while (index < argv.length) index = applyFlag(argv, index, args) + 1;
  return args;
}
