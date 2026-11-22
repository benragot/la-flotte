import { describe, expect, it } from "vitest";
import {
  arrivalLine,
  borderSide,
  exitAt,
  landingFor,
  mirrorArrival,
  nearestWalkable,
} from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";

/**
 * Le miroir des soleils : entrer par un bord fait ressortir par le bord
 * OPPOSÉ de la carte d'arrivée. Ce sont des fonctions pures : aucun YAML, aucun
 * store. Les coordonnées sont assertées en dur pour qu'une constante déguisée
 * (genre « arrivée toujours en 0,0 ») casse immédiatement.
 */
const SQUARE = { width: 10, height: 10 };
const OPEN = Array.from({ length: 10 }, () => "..........");
const openMap = () => parseAsciiMap(OPEN);

/** Marais : la colonne ouest de la ligne 2 est un mur, le reste est praticable. */
const MARSH = ["#####", "#.~.#", "#.#.#", "#...#", "#####"];
const marshMap = () => parseAsciiMap(MARSH);

describe("borderSide", () => {
  it("nomme le bord d'une case de bord et rien pour une case intérieure", () => {
    expect(borderSide(SQUARE, { x: 9, y: 4 })).toBe("east");
    expect(borderSide(SQUARE, { x: 0, y: 4 })).toBe("west");
    expect(borderSide(SQUARE, { x: 4, y: 0 })).toBe("north");
    expect(borderSide(SQUARE, { x: 4, y: 9 })).toBe("south");
    expect(borderSide(SQUARE, { x: 4, y: 4 })).toBeNull();
  });
});

describe("mirrorArrival — le bord d'entrée décide du bord de sortie", () => {
  it("entrer par l'est ressort sur la colonne ouest", () => {
    expect(mirrorArrival(SQUARE, { x: 9, y: 4 }, openMap())).toEqual({ x: 0, y: 4 });
  });

  it("entrer par l'ouest ressort sur la colonne est", () => {
    expect(mirrorArrival(SQUARE, { x: 0, y: 4 }, openMap())).toEqual({ x: 9, y: 4 });
  });

  it("entrer par le nord ressort sur la ligne sud", () => {
    expect(mirrorArrival(SQUARE, { x: 4, y: 0 }, openMap())).toEqual({ x: 4, y: 9 });
  });

  it("entrer par le sud ressort sur la ligne nord", () => {
    expect(mirrorArrival(SQUARE, { x: 4, y: 9 }, openMap())).toEqual({ x: 4, y: 0 });
  });

  it("garde la coordonnée perpendiculaire et la borne à la taille d'arrivée", () => {
    expect(mirrorArrival({ width: 12, height: 12 }, { x: 11, y: 7 }, openMap())).toEqual({ x: 0, y: 7 });
    expect(mirrorArrival({ width: 12, height: 12 }, { x: 11, y: 11 }, openMap())).toEqual({ x: 0, y: 9 });
  });

  it("une case intérieure n'est pas un bord : les coordonnées sont conservées", () => {
    expect(mirrorArrival(SQUARE, { x: 3, y: 4 }, openMap())).toEqual({ x: 3, y: 4 });
  });
});

describe("landingFor — l'arrivée est toujours praticable", () => {
  it("utilise la case écrite en donnée quand elle est fournie", () => {
    const landing = landingFor({ size: SQUARE, pos: { x: 9, y: 4 }, to: openMap(), at: { x: 2, y: 8 } });
    expect(landing).toEqual({ position: { x: 2, y: 8 }, relocated: false });
  });

  it("décale au plus proche praticable et le signale, avec une seule ligne de journal", () => {
    const landing = landingFor({ size: { width: 5, height: 5 }, pos: { x: 4, y: 2 }, to: marshMap() });
    expect(landing).toEqual({ position: { x: 1, y: 2 }, relocated: true });
    const lines = [arrivalLine("La Cale aux Serments", landing)];
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("La Cale aux Serments");
    expect(lines[0]).toContain("grève");
  });

  it("écrit une ligne sobre quand la case du miroir est praticable", () => {
    const landing = landingFor({ size: SQUARE, pos: { x: 9, y: 4 }, to: openMap() });
    expect(landing.relocated).toBe(false);
    expect(arrivalLine("Le Quai des Réclamations", landing)).not.toContain("grève");
  });
});

describe("nearestWalkable et exitAt", () => {
  it("trouve la case praticable la plus proche et ignore les murs", () => {
    expect(nearestWalkable(marshMap(), { x: 0, y: 2 })).toEqual({ x: 1, y: 2 });
  });

  it("retrouve la sortie posée sur la case cliquée", () => {
    const exits = [{ x: 9, y: 4, to: "ile_voisine" }];
    expect(exitAt(exits, { x: 9, y: 4 })).toEqual(exits[0]);
    expect(exitAt(exits, { x: 8, y: 4 })).toBeNull();
  });
});
