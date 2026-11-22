import { beforeEach, describe, expect, it } from "vitest";
import { initExploration } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * La transition de carte par un « soleil » : cliquer une case de sortie change
 * de carte, reconstruit la scène sur la destination et y place le héros.
 * `ferraille_plage_01` est recopiée ici comme dans les autres tests
 * d'exploration : ce module ne lit aucun YAML pour se construire, mais le store
 * lit les VRAIES sorties de `data/maps.yaml`.
 */
const PLAGE_ROWS = [
  "~~~~~~~~....",
  "~~~~....###.",
  "~~~...##..#.",
  "~~.P.......#",
  "~~....##....",
  "~~....##....",
  "...###......",
  "......~~~~..",
  "..#.....#...",
  "..#..M..#...",
  "..#.....#...",
  "............",
];
const SPAWN = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };
const PLAGE_ID = "ferraille_plage_01";
/** Sortie est de la plage, lue dans le YAML au moment du test (jamais recopiée). */
const PLAGE_EXIT = { x: 11, y: 4 };

function beachState() {
  return initExploration({ map: parseAsciiMap(PLAGE_ROWS), ...SPAWN });
}

function atBeach(): void {
  useCombatStore.setState({
    mapId: PLAGE_ID,
    mode: "exploration",
    exploration: beachState(),
    combat: null,
    battle: null,
    dungeonRun: null,
    hoveredCell: null,
  });
}

function click(cell: Position): void {
  useCombatStore.getState().clickCell(cell);
}

function position(): Position | undefined {
  return useCombatStore.getState().exploration?.playerPos;
}

function log(): readonly string[] {
  return useCombatStore.getState().exploration?.log ?? [];
}

describe("sortie de carte — le clic change de carte", () => {
  beforeEach(atBeach);

  it("passe sur la carte voisine et y place le héros en miroir (est → ouest)", () => {
    click(PLAGE_EXIT);
    const store = useCombatStore.getState();
    expect(store.mapId).not.toBe(PLAGE_ID);
    expect(store.exploration?.map.width).toBe(10);
    expect(position()).toEqual({ x: 0, y: 4 });
  });

  it("écrit une seule ligne de journal, sans vocabulaire technique", () => {
    click(PLAGE_EXIT);
    expect(log()).toHaveLength(1);
    expect(log()[0]).not.toMatch(/carte|mapId|chargement/i);
    expect(log()[0]).toMatch(/ressac/);
  });
});

describe("sortie de carte — aller-retour stable", () => {
  beforeEach(atBeach);

  it("plage → voisine → plage → voisine donne toujours la même arrivée", () => {
    click(PLAGE_EXIT);
    const firstLanding = position();
    const neighbour = useCombatStore.getState().mapId;
    click({ x: 0, y: 4 });
    expect(useCombatStore.getState().mapId).toBe(PLAGE_ID);
    expect(position()).toEqual(PLAGE_EXIT);
    click(PLAGE_EXIT);
    expect(useCombatStore.getState().mapId).toBe(neighbour);
    expect(position()).toEqual(firstLanding);
  });

  it("les deux cartes voisines se répondent, sans oscillation", () => {
    click(PLAGE_EXIT);
    const first = useCombatStore.getState().mapId;
    click({ x: 9, y: 4 });
    const second = useCombatStore.getState().mapId;
    expect(second).not.toBe(first);
    click({ x: 0, y: 4 });
    expect(useCombatStore.getState().mapId).toBe(first);
    expect(position()).toEqual({ x: 9, y: 4 });
  });
});

describe("sortie de carte — un combat en cours interdit la transition", () => {
  beforeEach(atBeach);

  it("laisse le héros sur place et écrit UNE ligne de journal qui explique le refus", () => {
    useCombatStore.getState().startDemoCombat();
    useCombatStore.setState({ mode: "exploration" });
    const before = useCombatStore.getState().exploration;
    click(PLAGE_EXIT);
    click(PLAGE_EXIT);
    const after = useCombatStore.getState();
    expect(after.mapId).toBe(PLAGE_ID);
    expect(after.exploration?.playerPos).toEqual(before?.playerPos);
    expect(after.exploration?.map).toBe(before?.map);
    const refusals = (after.exploration?.log ?? []).filter((line) => /combat/i.test(line));
    expect(refusals).toHaveLength(1);
    expect(after.exploration?.log.at(-1)).toBe(refusals[0]);
  });

  it("refuse aussi pendant une salle de donjon ouverte", () => {
    useCombatStore.setState({ battle: { turn: 1 } as never });
    const before = useCombatStore.getState().exploration;
    click(PLAGE_EXIT);
    const after = useCombatStore.getState();
    expect(after.exploration?.map).toBe(before?.map);
    expect(after.mapId).toBe(PLAGE_ID);
    expect(after.exploration?.log.at(-1)).toMatch(/donjon|combat/i);
  });
});
