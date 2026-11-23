import { expect, test } from "@playwright/test";

/**
 * Garde-fou du thème : `src/ui/theme.css` est une feuille **séparée** de
 * `src/styles.css` (hors périmètre), importée depuis `App.tsx`. Ses jetons sont
 * de simples variables CSS, pas un bloc `@theme` : compilé à part, `@theme`
 * n'est pas transformé, le navigateur l'ignore, et le dock tombe sur
 * `rgba(0, 0, 0, 0)` — mesuré, cf. l'en-tête de `theme.css`.
 *
 * Ce test vérifie donc que la feuille est réellement chargée et que le fond de
 * page est passé du bleu ardoise de `styles.css` au bois brûlé `surface-0`.
 */
const SURFACE_0 = "#14100d";
const SURFACE_1 = "#2b241d";
const SURFACE_0_RGB = "rgb(20, 16, 13)";

test.describe("thème du HUD — feuille chargée", () => {
  test("les variables de surface sont servies et le fond de page est en bois brûlé", async ({ page }) => {
    await page.goto("/");
    const probe = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      return {
        surface0: root.getPropertyValue("--color-surface-0").trim(),
        surface1: root.getPropertyValue("--color-surface-1").trim(),
        pageBackground: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(probe.surface0, "jeton surface-0").toBe(SURFACE_0);
    expect(probe.surface1, "jeton surface-1").toBe(SURFACE_1);
    expect(probe.pageBackground, "fond de page surface-0").toBe(SURFACE_0_RGB);
  });
});
