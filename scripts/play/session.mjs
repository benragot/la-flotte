import { capturePath } from "./probe.mjs";

/** Délai laissé à Pixi pour dessiner une frame après une action (capture seulement). */
export const SCENE_SETTLE_MS = 600;
/** Délai après « Passer » : le tour adverse s'ouvre, la timeline se met à jour. */
export const TURN_SETTLE_MS = 800;

/** Contexte commun aux étapes : page + base URL + écriture des captures. */
export function createSession({ page, baseUrl, outDir, recorder }) {
  const shot = (name) => capture(page, outDir, name);
  return { page, baseUrl, outDir, recorder, shot };
}

export async function capture(page, outDir, name) {
  await page.screenshot({ path: capturePath(outDir, name), fullPage: false });
  return `${name}.png`;
}

export function messageOf(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split("\n")[0];
}
