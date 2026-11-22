import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/** Paire de sélecteurs dont on vérifie qu'ils ne se chevauchent pas. */
export type SelectorPair = readonly [string, string];

/** Rectangle CSS d'un élément, tel que le voit le moteur de rendu. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tolérance anti-arrondi : en dessous de 2 px, deux boîtes contiguës se
 * touchent sans se recouvrir (les sous-pixels ne sont pas un bug de HUD).
 */
export const TOLERANCE_PX = 2;

export const CLASS_CARDS = 'section[aria-label="Création de personnage"] button[aria-pressed]';
export const ARENA = 'main[aria-label="Terrain de combat"]';

/** Recouvrement signé sur chaque axe : positif = les boîtes se croisent. */
export function overlapSize(a: Box, b: Box): { dx: number; dy: number } {
  const dx = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return { dx, dy };
}

/** Une superposition réelle exige un recouvrement strict sur les DEUX axes. */
export function isOverlapping(a: Box, b: Box): boolean {
  const { dx, dy } = overlapSize(a, b);
  return dx > TOLERANCE_PX && dy > TOLERANCE_PX;
}

function rect(box: Box): string {
  const round = (value: number) => Math.round(value);
  return `[x=${round(box.x)} y=${round(box.y)} w=${round(box.width)} h=${round(box.height)}]`;
}

interface OverlapContext {
  viewport: { width: number; height: number } | null;
  first: string;
  second: string;
  a: Box;
  b: Box;
}

/** Message d'échec autoportant : noms, rectangles et viewport (pas de « expect failed »). */
export function overlapMessage(context: OverlapContext): string {
  const { dx, dy } = overlapSize(context.a, context.b);
  const width = context.viewport?.width ?? "?";
  const height = context.viewport?.height ?? "?";
  const cross = `${Math.round(dx)}px × ${Math.round(dy)}px`;
  return `Superposition en ${width}×${height} : « ${context.first} » ${rect(context.a)} recouvre « ${context.second} » ${rect(context.b)} sur ${cross} (tolérance ${TOLERANCE_PX}px).`;
}

/** Boîte d'un sélecteur, ou échec explicite s'il est absent / invisible. */
export async function boxOf(page: Page, selector: string): Promise<Box> {
  const matches = page.locator(selector);
  expect(await matches.count(), `Élément introuvable : « ${selector} »`).toBeGreaterThan(0);
  const locator = matches.first();
  await expect(locator, `Élément non visible : « ${selector} »`).toBeVisible();
  const box = await locator.boundingBox();
  if (box === null) throw new Error(`Élément sans rectangle : « ${selector} »`);
  return box;
}

/** Échoue sur chaque paire qui se recouvre de plus de `TOLERANCE_PX` sur les deux axes. */
export async function expectNoOverlap(page: Page, pairs: readonly SelectorPair[]): Promise<void> {
  const viewport = page.viewportSize();
  for (const [first, second] of pairs) {
    const a = await boxOf(page, first);
    const b = await boxOf(page, second);
    expect(isOverlapping(a, b), overlapMessage({ viewport, first, second, a, b })).toBe(false);
  }
}

/** Échoue si l'élément sort du viewport (HUD rogné en bas ou à droite). */
export async function expectInsideViewport(page: Page, selector: string): Promise<void> {
  const box = await boxOf(page, selector);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Viewport inconnu : impossible de borner le HUD.");
  const right = box.x + box.width <= viewport.width + TOLERANCE_PX;
  const bottom = box.y + box.height <= viewport.height + TOLERANCE_PX;
  const left = box.x >= -TOLERANCE_PX;
  const top = box.y >= -TOLERANCE_PX;
  const message = `« ${selector} » ${rect(box)} sort du viewport ${viewport.width}×${viewport.height}.`;
  expect(left && top && right && bottom, message).toBe(true);
}

/** Crée un héros par le formulaire : seule route déterministe vers l'arène. */
export async function createHero(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("textbox").fill("Balthazar");
  await page.locator(CLASS_CARDS).first().click();
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.locator(ARENA)).toBeVisible();
}
