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

/**
 * Budget d'une mesure stabilisée : borne explicite, jamais une boucle infinie.
 * Après ce délai la mesure échoue en nommant la dernière boîte vue et son
 * conteneur, au lieu de laisser une assertion muette sur une taille périmée.
 */
export const LAYOUT_BUDGET_MS = 5000;

/**
 * Intervalle entre deux relevés. Il ne dépend **pas** de `requestAnimationFrame` :
 * en headless sans compositeur, une frame peut coûter ~1 s (mesuré : 30 frames =
 * 31,5 s), ce qui mangeait tout le budget avant même le deuxième relevé. Un
 * `getBoundingClientRect` force le layout de façon synchrone ; 100 ms suffisent
 * à laisser un commit React et un resize Pixi se poser.
 */
export const SAMPLE_INTERVAL_MS = 100;

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

/* ------------------------------------------------------------------------- *
 * Contrat de mesure (D84)
 *
 * Le canvas Pixi vaut 1×1 à son montage puis est redimensionné par un effet
 * React : une lecture unique peut donc tomber sur un état intermédiaire (1×1,
 * 20×20) ou sur un canvas pas encore monté. On ne parie plus sur un seuil de
 * taille magique : on relit jusqu'à obtenir **deux relevés consécutifs
 * identiques** (le layout a cessé de bouger), dans un budget explicite.
 *
 * Et les boîtes d'une même assertion sont lues dans **un seul** `evaluate` :
 * elles décrivent forcément le même instant de layout. C'est plus correct
 * qu'avant, où le canvas et sa section pouvaient appartenir à deux layouts
 * différents (section redimensionnée entre les deux lectures).
 * ------------------------------------------------------------------------- */

/** Deux rectangles identiques : le layout n'a pas bougé d'un sous-pixel. */
export function sameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** `null` = sélecteur absent : deux absences sont égales, une absence et une boîte non. */
function sameSlot(a: Box | null, b: Box | null): boolean {
  if (a === null || b === null) return a === b;
  return sameBox(a, b);
}

/** Deux relevés identiques : même nombre de boîtes, même ordre, mêmes rectangles. */
export function sameRead(a: readonly (Box | null)[], b: readonly (Box | null)[]): boolean {
  return a.length === b.length && a.every((box, index) => sameSlot(box, b[index] ?? null));
}

/** Un relevé exploitable : chaque élément existe et occupe une surface réelle. */
export function hasEveryBox(sample: readonly (Box | null)[]): boolean {
  return sample.every((box) => box !== null && box.width > 0 && box.height > 0);
}

/** Paramètres injectés d'une attente de stabilité : tout est remplaçable en test. */
export interface StablePoll<T> {
  /** Relevé **frais** : lu à l'instant de l'appel, sans attendre de frame. */
  read: () => Promise<T>;
  /** Laisse passer un court délai entre deux relevés (jamais une frame). */
  pause: () => Promise<void>;
  /** Un relevé n'est stable que s'il est complet : un élément absent n'est pas « stable ». */
  isComplete: (sample: T) => boolean;
  equals: (a: T, b: T) => boolean;
  /** Dernière mesure, injectée dans l'erreur de budget (jamais un « timeout » nu). */
  describe: (sample: T) => string;
  budgetMs?: number;
  now?: () => number;
}

/** Erreur de budget : nomme la mesure fautive, la taille mesurée et le conteneur. */
export function budgetMessage<T>(input: StablePoll<T>, last: T, budgetMs: number): string {
  return `La boîte n'a pas stabilisé en ${budgetMs} ms : dernière mesure ${input.describe(last)}.`;
}

function isSettledSample<T>(input: StablePoll<T>, previous: T, next: T): boolean {
  return input.equals(previous, next) && input.isComplete(next);
}

/**
 * Relit jusqu'à deux relevés **consécutifs identiques**, dans un budget borné.
 * Un relevé identique au précédent mais incomplet (élément absent) ne compte
 * pas : on continue d'attendre le montage.
 */
export async function pollUntilStable<T>(input: StablePoll<T>): Promise<T> {
  const budgetMs = input.budgetMs ?? LAYOUT_BUDGET_MS;
  const now = input.now ?? Date.now;
  const deadline = now() + budgetMs;
  let previous = await input.read();
  for (;;) {
    await input.pause();
    const next = await input.read();
    if (isSettledSample(input, previous, next)) return next;
    if (now() >= deadline) throw new Error(budgetMessage(input, next, budgetMs));
    previous = next;
  }
}

/* ------------------------------------------------------------------------- *
 * Lecture atomique (exécutée dans la page)
 *
 * `:has-text("…")` est un moteur Playwright, absent de `querySelectorAll` : on
 * le traduit ici (sous-chaîne insensible à la casse sur `textContent`, premier
 * nœud en ordre de document, comme `locator.first()`). Tout autre pseudo-classe
 * exotique ferait lever `querySelectorAll` : l'erreur est explicite, jamais
 * silencieuse.
 * ------------------------------------------------------------------------- */

/**
 * Exécuté DANS la page : N rectangles lus à l'instant de l'appel. Aucune attente
 * de frame (throttlée en headless) : c'est le contrat de stabilité qui cadence.
 * Les helpers sont **imbriqués** : Playwright ne sérialise que le corps de la
 * fonction passée à `evaluate`, pas la portée du module.
 */
async function readRectsInPage(selectors: string[]): Promise<(Box | null)[]> {
  const rectOf = (selector: string): Box | null => {
    const texts = [...selector.matchAll(/:has-text\("([^"]*)"\)/g)].map((match) => (match[1] ?? "").toLowerCase());
    const base = selector.replace(/:has-text\("[^"]*"\)/g, "");
    const matches = [...document.querySelectorAll(base)];
    const found = matches.find((el) => texts.every((text) => (el.textContent ?? "").toLowerCase().includes(text)));
    if (found === undefined) return null;
    const { x, y, width, height } = found.getBoundingClientRect();
    return { x, y, width, height };
  };
  await document.fonts.ready;
  return selectors.map(rectOf);
}

/** Un seul aller-retour : attente d'une frame ET mesure atomique des N boîtes. */
async function readSlots(page: Page, selectors: readonly string[]): Promise<(Box | null)[]> {
  return page.evaluate(readRectsInPage, [...selectors]);
}

function boxLabel(box: Box | null | undefined): string {
  if (box === null || box === undefined) return "introuvable";
  return `${Math.round(box.width)}×${Math.round(box.height)}`;
}

/** « 800×600, conteneur 800×600 (canvas, section) » : la mesure et son contenant. */
export function pairSummary(sample: readonly (Box | null)[], pair: SelectorPair): string {
  return `${boxLabel(sample[0])}, conteneur ${boxLabel(sample[1])} (« ${pair[0]} », « ${pair[1]} »)`;
}

function layoutPoll(
  page: Page,
  selectors: readonly string[],
  describe: (sample: readonly (Box | null)[]) => string,
): StablePoll<(Box | null)[]> {
  return {
    read: () => readSlots(page, selectors),
    pause: () => page.waitForTimeout(SAMPLE_INTERVAL_MS),
    isComplete: hasEveryBox,
    equals: sameRead,
    describe,
  };
}

function pairPoll(page: Page, pair: SelectorPair): StablePoll<(Box | null)[]> {
  return layoutPoll(page, pair, (sample) => pairSummary(sample, pair));
}

function singlePoll(page: Page, selector: string): StablePoll<(Box | null)[]> {
  return layoutPoll(page, [selector], (sample) => `${boxLabel(sample[0])} (« ${selector} »)`);
}

/** Boîte intérieure et contenant lues **ensemble**, stabilisées ensemble. */
export interface MeasuredPair {
  inner: Box;
  outer: Box;
}

function requireBoxes(sample: readonly (Box | null)[], pair: SelectorPair): MeasuredPair {
  const [inner, outer] = sample;
  if (inner === null || inner === undefined || outer === null || outer === undefined) {
    throw new Error(`Élément introuvable après ${LAYOUT_BUDGET_MS} ms : ${pairSummary(sample, pair)}`);
  }
  return { inner, outer };
}

export async function measurePair(page: Page, pair: SelectorPair): Promise<MeasuredPair> {
  const sample = await pollUntilStable(pairPoll(page, pair));
  return requireBoxes(sample, pair);
}

/** Boîte d'un sélecteur, stabilisée avant lecture (canvas Pixi, polices, resize). */
export async function boxOf(page: Page, selector: string): Promise<Box> {
  const sample = await pollUntilStable(singlePoll(page, selector));
  const [box] = sample;
  if (box === null || box === undefined) throw new Error(`Élément introuvable après ${LAYOUT_BUDGET_MS} ms : « ${selector} »`);
  return box;
}

/** Échoue sur chaque paire qui se recouvre de plus de `TOLERANCE_PX` sur les deux axes. */
export async function expectNoOverlap(page: Page, pairs: readonly SelectorPair[]): Promise<void> {
  const viewport = page.viewportSize();
  for (const [first, second] of pairs) {
    const { inner: a, outer: b } = await measurePair(page, [first, second]);
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

/** Marges signées entre deux boîtes : positif = l'intérieur est plus petit. */
export interface Gaps {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function gapsBetween(inner: Box, outer: Box): Gaps {
  return {
    left: inner.x - outer.x,
    right: outer.x + outer.width - (inner.x + inner.width),
    top: inner.y - outer.y,
    bottom: outer.y + outer.height - (inner.y + inner.height),
  };
}

/** Centrage optique : les marges opposées diffèrent de moins de `TOLERANCE_PX`. */
export async function expectCenteredIn(page: Page, inner: string, outer: string): Promise<void> {
  const { inner: a, outer: b } = await measurePair(page, [inner, outer]);
  const gaps = gapsBetween(a, b);
  const centered = Math.abs(gaps.left - gaps.right) <= TOLERANCE_PX && Math.abs(gaps.top - gaps.bottom) <= TOLERANCE_PX;
  const margins = `marges [g=${Math.round(gaps.left)} d=${Math.round(gaps.right)} h=${Math.round(gaps.top)} b=${Math.round(gaps.bottom)}]`;
  expect(centered, `« ${inner} » ${rect(a)} n'est pas centré dans « ${outer} » ${rect(b)} : ${margins}.`).toBe(true);
}

/** Part de la surface du conteneur couverte par l'élément (1 = pleine surface). */
export function coverageRatio(inner: Box, outer: Box): number {
  return (inner.width * inner.height) / (outer.width * outer.height);
}

export async function expectCoverage(page: Page, inner: string, outer: string, minimum: number): Promise<void> {
  const { inner: a, outer: b } = await measurePair(page, [inner, outer]);
  const ratio = coverageRatio(a, b);
  const percent = Math.round(ratio * 100);
  const message = `« ${inner} » ${rect(a)} ne couvre que ${percent} % de « ${outer} » ${rect(b)} (minimum ${Math.round(minimum * 100)} %).`;
  expect(ratio, message).toBeGreaterThanOrEqual(minimum);
}

/** Échoue si une bande vide sépare le bas du bloc supérieur du haut du bloc inférieur. */
export async function expectVerticallyAdjacent(page: Page, upper: string, lower: string): Promise<void> {
  const { inner: a, outer: b } = await measurePair(page, [upper, lower]);
  const band = b.y - (a.y + a.height);
  const message = `Bande morte de ${Math.round(band)} px entre « ${upper} » ${rect(a)} et « ${lower} » ${rect(b)} (tolérance ${TOLERANCE_PX}px).`;
  expect(Math.abs(band) <= TOLERANCE_PX, message).toBe(true);
}

/** Échoue si le bloc ne touche pas le bas du viewport (bande morte sous le HUD). */
export async function expectFlushWithViewportBottom(page: Page, selector: string): Promise<void> {
  const box = await boxOf(page, selector);
  const viewport = page.viewportSize();
  if (viewport === null) throw new Error("Viewport inconnu : impossible de vérifier le bas du HUD.");
  const band = viewport.height - (box.y + box.height);
  const message = `Bande morte de ${Math.round(band)} px sous « ${selector} » ${rect(box)} : le viewport finit à ${viewport.height} (tolérance ${TOLERANCE_PX}px).`;
  expect(Math.abs(band) <= TOLERANCE_PX, message).toBe(true);
}
