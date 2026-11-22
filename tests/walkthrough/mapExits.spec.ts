import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { initExploration } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import type { MapDef } from "../../src/schemas/mapSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * WALKTHROUGH — « je traverse l'archipel à pied ».
 *
 * CE QUE CE FICHIER PROUVE : un joueur, sans triche, quitte maps[0] par une
 * sortie réelle et enchaîne deux cartes. Les seules valeurs écrites ici sont
 * MESURÉES sur `data/maps.yaml` : la sortie cliquée, la case d'arrivée et la
 * ligne de journal. Aucun id de destination, aucune coordonnée d'arrivée n'est
 * recopiée : tout vient des sorties de la donnée et du miroir du moteur.
 *
 * CE QU'IL NE PROUVE PAS : le rendu des soleils (PR suivante), la persistance du
 * `mapId` (PR roster), ni le farm sur les nouvelles cartes (elles n'ont pas
 * encore de zone de spawn).
 */
const raw = readFileSync(join(process.cwd(), "data", "maps.yaml"), "utf8");
const maps = parseMapsYaml(raw);

function startMap(): MapDef {
  const first = maps[0];
  if (first === undefined) throw new Error("data/maps.yaml est vide");
  return first;
}

function mapById(id: string): MapDef {
  const found = maps.find((map) => map.id === id);
  if (found === undefined) throw new Error(`${id} absente de data/maps.yaml`);
  return found;
}

function startAtBeach(): void {
  const map = startMap();
  useCombatStore.setState({
    mapId: map.id,
    mode: "exploration",
    exploration: initExploration({
      map: parseAsciiMap(map.grid),
      monsterId: "piou_mazoute",
      monsterName: "Piou Mazouté",
      level: 1,
    }),
    combat: null,
    battle: null,
    dungeonRun: null,
    hoveredCell: null,
  });
}

function click(cell: Position): void {
  useCombatStore.getState().clickCell(cell);
}

describe("walkthrough — sortir de maps[0] par un soleil", () => {
  beforeEach(startAtBeach);

  it("enchaîne plage → quai → cale par les seules sorties de la donnée", () => {
    const beach = startMap();
    const beachExit = beach.exits[0];
    if (beachExit === undefined) throw new Error(`${beach.id} n'a aucune sortie`);
    click(beachExit);
    const quai = useCombatStore.getState();
    expect(quai.mapId).toBe(beachExit.to);
    expect(quai.exploration?.playerPos).toEqual({ x: 0, y: 4 });
    const quaiExit = mapById(quai.mapId).exits.find((exit) => exit.to !== beach.id);
    if (quaiExit === undefined) throw new Error("le quai ne mène nulle part ailleurs");
    click(quaiExit);
    const cale = useCombatStore.getState();
    expect(cale.mapId).toBe(quaiExit.to);
    expect(cale.exploration?.playerPos).toEqual({ x: 0, y: 4 });
    expect(cale.exploration?.log).toHaveLength(1);
  });
});
