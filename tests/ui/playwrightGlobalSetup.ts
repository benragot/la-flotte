import { resolvePort, serverBanner, suiteRoot } from "./playwrightPort";

/**
 * Tête de run : affiche le port et le worktree mesurés. C'est la garde qui a
 * manqué quand une suite a mesuré le serveur d'un autre arbre en silence.
 */
export default function announceServer(): void {
  const root = suiteRoot();
  console.log(serverBanner(resolvePort(process.env, root), root));
}
