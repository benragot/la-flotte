import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { landingFor } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { GridSize } from "../../src/renderer/gridProjection";
import { gridToIso, sceneOrigin } from "../../src/renderer/gridProjection";
import type { MapDef } from "../../src/schemas/mapSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { ARENA, createHero } from "./helpers";

/**
 * PREUVE DU CLIC : ce spec est NOUVEAU (les assertions de `layout.spec.ts`,
 * `newGame.spec.ts` et `helpers.ts` ne sont pas touchées). Les soleils ne sont
 * pas encore dessinés — la sortie se prouve donc au pixel, comme le clic de
 * déplacement existant : on part des VRAIES sorties de `data/maps.yaml` et de
 * la MÊME projection que le jeu pour viser la case.
 */
const JOURNAL = 'aside[aria-label="Journal d’exploration"]';
const maps = parseMapsYaml(readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8"));

function startMap(): MapDef {
  const map = maps[0];
  if (map === undefined) throw new Error("data/maps.yaml ne contient aucune carte");
  return map;
}

function destinationOf(map: MapDef, to: string): MapDef {
  const found = maps.find((entry) => entry.id === to);
  if (found === undefined) throw new Error(`${to} absente de data/maps.yaml`);
  return found;
}

test.describe("sortie de carte — le clic sur un bord change de carte", () => {
  test.beforeEach(async ({ page }) => {
    await createHero(page);
  });

  test("la carte de destination s'affiche, le héros arrive en miroir", async ({ page }) => {
    const map = startMap();
    const exit = map.exits[0];
    if (exit === undefined) throw new Error(`${map.id} ne déclare aucune sortie`);
    const destination = destinationOf(map, exit.to);
    const landing = landingFor({
      size: map,
      pos: exit,
      to: parseAsciiMap(destination.grid),
      at: exit.at,
    });
    const arena = page.locator(ARENA);
    const box = await arena.boundingBox();
    if (box === null) throw new Error("Zone jouable sans rectangle");
    const size: GridSize = { width: map.width, height: map.height };
    const pixel = gridToIso({ ...exit, origin: sceneOrigin(size, { width: box.width, height: box.height }) });
    await page.mouse.click(box.x + pixel.x, box.y + pixel.y);
    await expect(arena).toHaveAttribute("data-hero-cell", `${landing.position.x},${landing.position.y}`);
    await expect(page.getByText(`Carte ${exit.to}`)).toBeVisible();
    await expect(page.locator(JOURNAL)).toContainText(destination.name);
  });
});
