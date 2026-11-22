import path from "node:path";

/** Boîte arrondie au pixel : le rapport doit être lisible, pas subpixellique. */
function rounded(box) {
  return {
    x: Math.round(box.x),
    y: Math.round(box.y),
    width: Math.round(box.width),
    height: Math.round(box.height),
  };
}

export async function boxOf(page, selector) {
  const matches = page.locator(selector);
  if ((await matches.count()) === 0) return null;
  const box = await matches.first().boundingBox();
  return box === null ? null : rounded(box);
}

/**
 * Instantané DOM des zones clés : `boxes` si la zone existe et a un rectangle,
 * `missing` sinon. C'est la trace auditable du rapport (pas la capture seule).
 */
export async function snapshot(page, selectors) {
  const boxes = {};
  const missing = [];
  for (const [name, selector] of Object.entries(selectors)) {
    const box = await boxOf(page, selector);
    if (box === null) missing.push(name);
    else boxes[name] = box;
  }
  return { boxes, missing };
}

/** Attente maximale d'une zone clé : un élément absent doit faire échouer vite et clair. */
const SELECTOR_TIMEOUT_MS = 15_000;

export async function requireVisible(page, selector) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: SELECTOR_TIMEOUT_MS });
  return locator;
}

export function firstLine(text) {
  const [line = ""] = text.split("\n").map((value) => value.trim()).filter((value) => value.length > 0);
  return line;
}

export function capturePath(outDir, name) {
  return path.join(outDir, `${name}.png`);
}
