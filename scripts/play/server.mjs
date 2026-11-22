import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PLAY_IDENTITY } from "./identity.mjs";

/** Le serveur de dev démarre vite + React : on laisse une marge confortable. */
const STARTUP_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;
/** Marqueurs du vrai `src/main.tsx` de La Flotte, pas d'une page quelconque. */
const MAIN_MARKERS = ["createRoot", "/src/ui/App.tsx"];
const IDENTITY_PATH = fileURLToPath(new URL("./identity.mjs", import.meta.url));

/**
 * `--host 127.0.0.1` : sans lui, vite écoute sur `localhost`, qui résout en
 * `::1` sur macOS — le script et la garde de port parlent pourtant IPv4.
 */
function viteArgs(port) {
  return ["run", "dev", "--", "--port", String(port), "--strictPort", "--host", "127.0.0.1"];
}

function capture(stream, lines) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => { lines.push(chunk.trimEnd()); });
}

/**
 * `detached` crée un groupe de processus : tuer `npm` ne suffit pas, vite est
 * son enfant et survivrait en tenant le port.
 */
export function startVite({ port, cwd, lines }) {
  const child = spawn("npm", viteArgs(port), { cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
  capture(child.stdout, lines);
  capture(child.stderr, lines);
  return child;
}

export function stopVite(child) {
  if (child === undefined || child === null || child.exitCode !== null || child.pid === undefined) return;
  killGroup(child.pid);
}

function killGroup(pid) {
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    // Processus déjà sorti : rien à nettoyer.
  }
}

async function reachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForServer(url) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await reachable(url)) return;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Aucune réponse de ${url} après ${STARTUP_TIMEOUT_MS} ms (vite n'a pas démarré).`);
}

async function textOf(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${url} répond ${response.status}.`);
  return response.text();
}

async function identityServed(baseUrl) {
  try {
    const source = await textOf(`${baseUrl}/@fs${IDENTITY_PATH}`);
    return source.includes(PLAY_IDENTITY);
  } catch {
    return false;
  }
}

/**
 * Identité de l'application : un serveur tiers répondrait 200 lui aussi. On
 * exige le `#root` de l'index, le `main.tsx` de La Flotte, et surtout le jeton
 * de CE worktree servi via `/@fs` — un autre dossier ne peut pas le produire.
 */
export async function assertOwnApp(baseUrl) {
  const html = await textOf(`${baseUrl}/`);
  const main = await textOf(`${baseUrl}/src/main.tsx`);
  const markers = MAIN_MARKERS.every((marker) => main.includes(marker));
  if (!html.includes('id="root"') || !markers || !(await identityServed(baseUrl))) {
    throw new Error(`${baseUrl} répond mais ne sert pas CE worktree de La Flotte (autre application ou autre worktree ?).`);
  }
}
