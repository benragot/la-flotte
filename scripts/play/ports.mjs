import net from "node:net";

/** Vrai si le port est libre : on tente de le réserver puis on relâche aussitôt. */
export function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once("error", () => resolve(false));
    probe.once("listening", () => probe.close(() => resolve(true)));
    probe.listen(port, "127.0.0.1");
  });
}

/** Port éphémère attribué par le noyau : jamais celui d'un autre worktree. */
export function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.once("listening", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
    probe.listen(0, "127.0.0.1");
  });
}

/**
 * Échoue bruyamment si quelque chose écoute déjà : sans cette garde, un serveur
 * d'un autre worktree (ou une autre app) répondrait à notre place.
 */
export async function assertPortFree(port) {
  if (await isPortFree(port)) return;
  throw new Error(`Le port ${port} est déjà occupé : refuse de jouer une application inconnue. Relance sans --port ou choisis un autre port.`);
}
