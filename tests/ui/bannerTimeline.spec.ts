import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Matière **calculée** du bandeau haut et de la frise d'initiative.
 *
 * Les valeurs attendues sont celles de `docs/design/specs/ui-visual-direction.md`
 * (§1.2 surfaces, §1.8 variante A « Pont de navire », §2.3 mini-barre 4 px,
 * §3 carte 44 px + `outline` 2 px au lieu d'un halo flou). Elles sont lues par
 * `getComputedStyle` : une classe Tailwind peut être écrite sans être générée,
 * et le composant retomberait alors sur un fond transparent sans que personne
 * ne le voie. Les contrastes sont calculés par la formule WCAG sur la couleur
 * **effectivement composée** par le moteur, pas lus à l'œil.
 */
const HEADER = '[data-zone="header"]';
const TIMELINE = 'aside[aria-label="Ordre de jeu"]';
const FIRST_CARD = `${TIMELINE} article:first-child`;
const LAST_CARD = `${TIMELINE} article:last-child`;
const FIRST_CARD_HP = `${FIRST_CARD} > div:last-child`;

/** Seuil WCAG AA du texte courant. */
const MIN_TEXT_CONTRAST = 4.5;
/** Bois de la carte (variante A) : `--color-wood-face` `#4A3728`. */
const WOOD_BG = "rgb(74, 55, 40)";
/** Encre de la carte (8.85:1 sur le bois) : `--color-wood-ink` `#F0E3C8`. */
const WOOD_INK = "rgb(240, 227, 200)";
/** Or du combattant actif : `--color-line-gold` `#D4A537`. */
const GOLD = "rgb(212, 165, 55)";
/** Hauteur de la carte, marge de la bande comprise dans 62 px (§3). */
const CARD_HEIGHT = "44px";
/** Mini-barre de PV (§2.3, colonne « 4 px (mini-carte) »). */
const HP_BAR_HEIGHT = "4px";

type Channels = readonly [number, number, number];

interface Paint {
  readonly label: string;
  readonly painted: string;
}

interface BannerPaint {
  readonly surface: string;
  readonly texts: readonly Paint[];
}

interface CardPaint {
  readonly background: string;
  readonly color: string;
  readonly height: string;
  readonly outlineWidth: string;
  readonly outlineStyle: string;
  readonly outlineColor: string;
  readonly filter: string;
  readonly boxShadow: string;
}

interface BandFit {
  readonly band: number;
  readonly card: number;
  readonly within: boolean;
}

/** `rgb(r, g, b)` déjà composé par le moteur → canaux 0–1. Refuse le reste. */
function channelsOf(value: string): Channels {
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
  if (match === null) throw new Error(`Couleur non résolue en sRGB opaque : ${value}`);
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}

/** Linéarisation sRGB de la formule WCAG. */
function linear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: Channels): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

/** Ratio de contraste WCAG, arrondi au centième pour rester lisible. */
function contrast(a: Channels, b: Channels): number {
  const la = luminance(a);
  const lb = luminance(b);
  return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
}

/** Rayons de flou d'une pile `box-shadow` : `0` partout = arêtes nettes (I6). */
function blurRadii(boxShadow: string): number[] {
  const withoutColors = boxShadow.replace(/rgba?\([^)]*\)/g, "");
  const radii = withoutColors.split(",").map(shadowBlur);
  return radii.filter((radius): radius is number => radius !== null);
}

/** Troisième longueur d'une ombre : x, y, puis le flou. */
function shadowBlur(shadow: string): number | null {
  const lengths = shadow.match(/-?\d*\.?\d+px/g) ?? [];
  if (lengths.length < 3) return null;
  return Number.parseFloat(lengths[2] ?? "0");
}

async function bannerPaint(page: Page): Promise<BannerPaint | null> {
  return page.evaluate(() => {
    /** Peint le texte sur son fond dans un canvas 1×1 : le moteur compose. */
    const paint = (backdrop: string, color: string, opacity: number): string => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d");
      if (context === null) return color;
      context.fillStyle = backdrop;
      context.fillRect(0, 0, 1, 1);
      context.globalAlpha = opacity;
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return `rgb(${r}, ${g}, ${b})`;
    };
    const header = document.querySelector<HTMLElement>('[data-zone="header"]');
    if (header === null) return null;
    const background = getComputedStyle(header).backgroundColor;
    const surface = paint(getComputedStyle(document.body).backgroundColor, background, 1);
    const nodes = [...header.querySelectorAll<HTMLElement>("h1, h1 small, p")];
    const texts = nodes.map((node) => {
      const style = getComputedStyle(node);
      const alpha = Number(style.opacity);
      const label = `${node.tagName.toLowerCase()} « ${(node.textContent ?? "").trim()} »`;
      return { label, painted: paint(surface, style.color, alpha) };
    });
    return { surface, texts };
  });
}

function cardStyle(element: Element): CardPaint {
  const style = getComputedStyle(element);
  return {
    background: style.backgroundColor,
    color: style.color,
    height: style.height,
    outlineWidth: style.outlineWidth,
    outlineStyle: style.outlineStyle,
    outlineColor: style.outlineColor,
    filter: style.filter,
    boxShadow: style.boxShadow,
  };
}

async function cardPaint(page: Page, selector: string): Promise<CardPaint> {
  return page.locator(selector).first().evaluate(cardStyle);
}

async function bandFit(page: Page): Promise<BandFit> {
  return page.locator(TIMELINE).evaluate((aside) => {
    const card = aside.querySelector("article");
    if (card === null) return { band: 0, card: 0, within: false };
    const band = aside.getBoundingClientRect();
    const rect = card.getBoundingClientRect();
    const within = rect.top >= band.top && rect.bottom <= band.bottom;
    return { band: band.height, card: rect.height, within };
  });
}

test.describe("bandeau haut — lisibilité du texte courant", () => {
  test("chaque texte du bandeau dépasse 4,5:1 sur son propre fond", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(HEADER)).toBeVisible();
    const paint = await bannerPaint(page);
    if (paint === null) throw new Error("Bandeau introuvable : rien à mesurer.");
    for (const text of paint.texts) {
      const ratio = contrast(channelsOf(text.painted), channelsOf(paint.surface));
      expect(ratio, `${text.label} ${text.painted} sur ${paint.surface} : ${ratio}:1 < ${MIN_TEXT_CONTRAST}:1`).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    }
  });
});

test.describe("frise d'initiative — planche de bois", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(LAST_CARD)).toBeVisible();
  });

  test("les deux cartes sont du bois avec l'encre claire, 44 px de haut", async ({ page }) => {
    for (const selector of [FIRST_CARD, LAST_CARD]) {
      const paint = await cardPaint(page, selector);
      expect(paint.background, `bois #4A3728 (${selector})`).toBe(WOOD_BG);
      expect(paint.color, `encre #F0E3C8 (${selector})`).toBe(WOOD_INK);
      expect(paint.height, `hauteur de carte (${selector})`).toBe(CARD_HEIGHT);
    }
  });

  test("le combattant actif porte un outline 2 px franc, aucun flou", async ({ page }) => {
    const active = await cardPaint(page, FIRST_CARD);
    expect(active.outlineStyle, "outline plein, pas pointillé").toBe("solid");
    expect(active.outlineWidth, "outline de 2 px").toBe("2px");
    expect(active.outlineColor, "outline or #D4A537").toBe(GOLD);
    expect(active.filter, "aucun filtre CSS").toBe("none");
    /** Tailwind compose 4 anneaux neutres à flou nul : seul compte le flou positif. */
    const blur = Math.max(0, ...blurRadii(active.boxShadow));
    expect(blur, `aucun flou dans ${active.boxShadow}`).toBe(0);
  });

  test("la carte inactive n'a pas d'outline : l'état se lit d'un coup d'œil", async ({ page }) => {
    const idle = await cardPaint(page, LAST_CARD);
    expect(idle.outlineStyle, "pas d'outline au repos").toBe("none");
  });

  test("la mini-barre de PV mesure 4 px", async ({ page }) => {
    const height = await page.locator(FIRST_CARD_HP).evaluate((bar) => getComputedStyle(bar).height);
    expect(height, "mini-barre 4 px (§2.3)").toBe(HP_BAR_HEIGHT);
  });

  test("la carte de 44 px tient entièrement dans la bande d'initiative", async ({ page }) => {
    const fit = await bandFit(page);
    expect(fit.within, `carte ${Math.round(fit.card)} px dans une bande de ${Math.round(fit.band)} px`).toBe(true);
  });
});
