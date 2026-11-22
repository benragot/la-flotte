import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { GridSize } from "../../src/renderer/gridProjection";
import { gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { ARENA, createHero } from "./helpers";

/**
 * LE test qui manquait : aucun test ne cliquait une carte d'exploration, donc
 * « on peut pas bouger » n'était ni reproduit ni démenti automatiquement.
 * On part du vrai `data/maps.yaml` (taille + case du héros `P`) et on clique le
 * centre pixel d'une case voisine calculé par la **même** projection que le jeu.
 */
const JOURNAL = 'aside[aria-label="Journal d’exploration"]';
/** Case bloquée de `ferraille_plage_01` : l'eau du coin haut-gauche. */
const WATER = { x: 0, y: 0 };
const BLOCKED_HINT = "bloqué";

interface StartMap {
  size: GridSize;
  hero: { x: number; y: number };
  target: { x: number; y: number };
}

function readStartMap(): StartMap {
  const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
  const map = parseMapsYaml(raw)[0];
  if (map === undefined) throw new Error("data/maps.yaml ne contient aucune carte");
  const size = { width: map.width, height: map.height };
  const hero = findCell(map.grid, "P");
  return { size, hero, target: freeCellRight(map.grid, hero) };
}

function findCell(grid: readonly string[], symbol: string): { x: number; y: number } {
  const y = grid.findIndex((row) => row.includes(symbol));
  const x = y < 0 ? -1 : (grid[y] ?? "").indexOf(symbol);
  if (x < 0) throw new Error(`Symbole « ${symbol} » absent de la carte de départ`);
  return { x, y };
}

/** Première case libre 2 ou 3 colonnes à droite du héros : le trajet reste court et sûr. */
function freeCellRight(grid: readonly string[], hero: { x: number; y: number }): { x: number; y: number } {
  const row = grid[hero.y] ?? "";
  const candidates = [hero.x + 2, hero.x + 3].filter((x) => row[x] === ".");
  const x = candidates[0];
  if (x === undefined) throw new Error("Aucune case libre à deux ou trois colonnes du héros");
  return { x, y: hero.y };
}

function cellCenter(cell: { x: number; y: number }, size: GridSize, viewport: GridSize) {
  return gridToIso({ ...cell, origin: sceneOrigin(size, viewport) });
}

function label(cell: { x: number; y: number }): string {
  return `${cell.x},${cell.y}`;
}

test.describe("exploration — le clic déplace réellement le héros", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
  });

  test("un clic sur une case voisine change la case du héros", async ({ page }) => {
    const map = readStartMap();
    const arena = page.locator(ARENA);
    await expect(arena).toHaveAttribute("data-hero-cell", label(map.hero));
    const box = await arena.boundingBox();
    if (box === null) throw new Error("Zone jouable sans rectangle");
    const pixel = cellCenter(map.target, map.size, { width: box.width, height: box.height });
    await page.mouse.click(box.x + pixel.x, box.y + pixel.y);
    await expect(arena).toHaveAttribute("data-hero-cell", label(map.target));
    await expect(page.locator(`${ARENA} canvas`)).toBeVisible();
  });

  test("un clic sur une case bloquée laisse le héros et le dit dans le journal", async ({ page }) => {
    const map = readStartMap();
    const arena = page.locator(ARENA);
    const box = await arena.boundingBox();
    if (box === null) throw new Error("Zone jouable sans rectangle");
    const pixel = cellCenter(WATER, map.size, { width: box.width, height: box.height });
    await page.mouse.click(box.x + pixel.x, box.y + pixel.y);
    await expect(arena).toHaveAttribute("data-hero-cell", label(map.hero));
    await expect(page.locator(JOURNAL)).toContainText(BLOCKED_HINT, { timeout: 2000 });
  });
});
