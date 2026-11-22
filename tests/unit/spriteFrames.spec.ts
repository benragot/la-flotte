import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SPRITE_FRAME_SIZE,
  animationFrames,
  frameAt,
  frameIndexAt,
  frameRect,
} from "../../src/renderer/sprites/frameMath";

const SPRITE_DIR = join(process.cwd(), "public", "assets", "sprites");

const ENTITY_IDS = [
  "cra",
  "ecaflip",
  "eniripsa",
  "enutrof",
  "feca",
  "fer_boulon_pousseur",
  "fer_crabe_cle_molette",
  "fer_rat_de_cale",
  "iop",
  "osamodas",
  "pandawa",
  "piou_mazoute",
  "sacrieur",
  "sadida",
  "sram",
  "xelor",
] as const;

/** Grille 4 × 4 de cellules de 128 px : les 16 coins de frame attendus dans le SVG. */
const CELL_OFFSETS = [0, 128, 256, 384];

const TAG = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;

interface TagMatch {
  closing: string;
  name: string;
  selfClosing: string;
}

function* tagMatches(svg: string): Generator<TagMatch> {
  for (const match of svg.matchAll(TAG)) {
    const [, closing = "", name = "", , selfClosing = ""] = match;
    yield { closing, name, selfClosing };
  }
}

/** Vérifie l'équilibre des balises : équivalent d'un parse XML bien formé pour notre sous-ensemble. */
function isWellFormed(svg: string): boolean {
  const stack: string[] = [];
  for (const tag of tagMatches(svg)) {
    if (tag.closing === "/") {
      if (stack.pop() !== tag.name) return false;
    } else if (tag.selfClosing !== "/") {
      stack.push(tag.name);
    }
  }
  return stack.length === 0;
}

function countFrames(svg: string): number {
  return svg.match(/class="frame"/g)?.length ?? 0;
}

/** Un attribut dupliqué rend le SVG invalide pour un parseur strict et pour `<img>`. */
function hasDuplicateAttributes(svg: string): boolean {
  for (const [, , , attrs = ""] of svg.matchAll(TAG)) {
    const names = [...attrs.matchAll(/ ([a-zA-Z][\w:-]*)=/g)].map(([, name]) => name);
    if (new Set(names).size !== names.length) return true;
  }
  return false;
}

function svgOf(id: string): string {
  return readFileSync(join(SPRITE_DIR, `${id}.svg`), "utf8");
}

function hasAllCells(svg: string): boolean {
  return CELL_OFFSETS.every((x) => CELL_OFFSETS.every((y) => svg.includes(`translate(${x} ${y})`)));
}

describe("frameMath — frameRect", () => {
  const cell = { frameWidth: 64, frameHeight: 64 };

  it("place le coin haut-gauche de la grille 4×4 à l'origine", () => {
    expect(frameRect({ ...cell, row: 0, column: 0 })).toEqual({ x: 0, y: 0, width: 64, height: 64 });
  });

  it("décale d'une cellule par colonne sur la même ligne", () => {
    expect(frameRect({ ...cell, row: 0, column: 1 })).toEqual({ x: 64, y: 0, width: 64, height: 64 });
  });

  it("décale d'une cellule par ligne sur la même colonne", () => {
    expect(frameRect({ ...cell, row: 1, column: 0 })).toEqual({ x: 0, y: 64, width: 64, height: 64 });
  });

  it("place le coin bas-droit de la grille 4×4", () => {
    expect(frameRect({ ...cell, row: 3, column: 3 })).toEqual({ x: 192, y: 192, width: 64, height: 64 });
  });

  it("respecte une taille de cellule différente", () => {
    const rect = frameRect({ row: 2, column: 1, frameWidth: 32, frameHeight: 48 });
    expect(rect).toEqual({ x: 32, y: 96, width: 32, height: 48 });
  });
});

describe("frameMath — animationFrames", () => {
  it("produit quatre rectangles sur la ligne demandée", () => {
    const frames = animationFrames({ row: 1, frames: 4 });
    expect(frames).toHaveLength(4);
    expect(frames.map((frame) => frame.y)).toEqual([SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE, SPRITE_FRAME_SIZE]);
  });

  it("incrémente x de la taille de cellule", () => {
    const frames = animationFrames({ row: 2, frames: 4 });
    expect(frames.map((frame) => frame.x)).toEqual([0, SPRITE_FRAME_SIZE, 2 * SPRITE_FRAME_SIZE, 3 * SPRITE_FRAME_SIZE]);
    frames.forEach((frame) => expect(frame.width).toBe(SPRITE_FRAME_SIZE));
    expect(frames[0]?.y).toBe(2 * SPRITE_FRAME_SIZE);
  });

  it("accepte une animation à une seule frame", () => {
    const size = SPRITE_FRAME_SIZE;
    expect(animationFrames({ row: 3, frames: 1 })).toEqual([{ x: 0, y: 3 * size, width: size, height: size }]);
  });

  it("ne produit aucun rectangle pour zéro frame", () => {
    expect(animationFrames({ row: 0, frames: 0 })).toHaveLength(0);
  });
});

describe("frameMath — bornes circulaires", () => {
  it("ramène un index négatif sur la dernière frame", () => {
    expect(frameIndexAt(-1, 4)).toBe(3);
    expect(frameIndexAt(-5, 4)).toBe(3);
  });

  it("ramène un index hors bornes sur la première frame", () => {
    expect(frameIndexAt(4, 4)).toBe(0);
    expect(frameIndexAt(9, 4)).toBe(1);
  });

  it("garde les index valides et tronque les décimaux", () => {
    expect(frameIndexAt(0, 4)).toBe(0);
    expect(frameIndexAt(2, 4)).toBe(2);
    expect(frameIndexAt(2.8, 4)).toBe(2);
  });

  it("tolère une animation vide sans division par zéro", () => {
    expect(frameIndexAt(3, 0)).toBe(0);
  });
});

describe("frameMath — frameAt", () => {
  it("retourne la frame demandée sur la bonne ligne", () => {
    const size = SPRITE_FRAME_SIZE;
    expect(frameAt({ row: 2, frames: 4 }, 0)).toEqual({ x: 0, y: 2 * size, width: size, height: size });
    expect(frameAt({ row: 2, frames: 4 }, 3)).toEqual({ x: 3 * size, y: 2 * size, width: size, height: size });
  });

  it("boucle modulo sur un index hors bornes", () => {
    expect(frameAt({ row: 0, frames: 4 }, 5)).toEqual(frameAt({ row: 0, frames: 4 }, 1));
    expect(frameAt({ row: 3, frames: 4 }, -1)).toEqual(frameAt({ row: 3, frames: 4 }, 3));
  });
});

describe("feuilles SVG générées", () => {
  it("livre exactement une feuille par entité", () => {
    const files = readdirSync(SPRITE_DIR).filter((file) => file.endsWith(".svg"));
    expect(files.sort()).toEqual(ENTITY_IDS.map((id) => `${id}.svg`).sort());
  });

  it.each(ENTITY_IDS)("déclare %s en 512×512 avec un titre", (id) => {
    const svg = svgOf(id);
    expect(svg).toContain('width="512"');
    expect(svg).toContain('height="512"');
    expect(svg).toContain('viewBox="0 0 512 512"');
    expect(svg).toContain("<title>");
  });

  it.each(ENTITY_IDS)("découpe %s en 16 frames sur la grille 4×4", (id) => {
    const svg = svgOf(id);
    expect(countFrames(svg)).toBe(16);
    expect(hasAllCells(svg)).toBe(true);
  });

  it.each(ENTITY_IDS)("produit un XML bien formé pour %s", (id) => {
    expect(isWellFormed(svgOf(id))).toBe(true);
  });

  it.each(ENTITY_IDS)("n'émet aucun attribut dupliqué pour %s", (id) => {
    expect(hasDuplicateAttributes(svgOf(id))).toBe(false);
  });
});
