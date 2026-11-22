/**
 * Jeton d'identité du worktree. `scripts/play/server.mjs` le réclame via
 * `GET /@fs/<chemin absolu>` : si vite répond autre chose, le serveur qui
 * écoute appartient à un AUTRE dossier (le piège du port 4173 partagé).
 */
export const PLAY_IDENTITY = "la-flotte-play-identity-7f3c1a";
