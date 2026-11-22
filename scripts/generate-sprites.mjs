#!/usr/bin/env node
/**
 * Générateur déterministe des feuilles de sprites de La Flotte.
 *
 * Note : `scripts/*.mjs` est hors du périmètre ESLint (qui ne couvre que `src/`
 * et `tests/`), donc les micro-fonctions de 10 lignes ne sont pas imposées ici.
 * Les fonctions restent courtes et pures : aucune horloge, aucun aléa, aucune
 * dépendance npm — deux exécutions produisent des fichiers identiques au bit.
 *
 * Format de sortie (contrat du manifeste `data/sprites.yaml`) :
 *   512 × 512, grille 4 colonnes × 4 lignes de cellules 128 × 128
 *   ligne 0 = idle, ligne 1 = walk, ligne 2 = attack, ligne 3 = hit
 *
 * Échelle : les silhouettes restent dessinées dans l'espace historique de
 * 64 unités (`UNIT`), puis *toute* la frame est passée par un unique
 * `transform="scale(FRAME_SCALE)"`. Un seul facteur, appliqué à la racine de la
 * frame : formes, rayons, offsets et pivots suivent ensemble. Aucune coordonnée
 * de dessin n'est réécrite à la main, donc aucun risque de personnage 2× trop
 * petit collé dans le coin haut-gauche.
 *
 * Stratégie : une silhouette de base par entité (parties nommées : `back`,
 * `legL`, `legR`, `body`, `armL`, `head`, `hair`, `armR`, `prop`) déclarée une
 * fois dans `<defs>`, puis 16 groupes de frames qui ne font que *transformer*
 * des `<use>` — le dessin n'est jamais répété 16 fois.
 *
 * Usage : `node scripts/generate-sprites.mjs` (écrit) / `--check` (vérifie).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "assets", "sprites");

/** Espace de dessin historique : toutes les silhouettes sont exprimées en unités de 64. */
const UNIT = 64;
/** Facteur de génération (D05) : feuille produite à 2× pour un rendu net. */
const FRAME_SCALE = 2;
const CELL = UNIT * FRAME_SCALE;
const COLUMNS = 4;
const ROWS = 4;
const SHEET = CELL * COLUMNS;
const ANIMATIONS = ["idle", "walk", "attack", "hit"];

const INK = "#1a1614";

/* ------------------------------------------------------------------ formes */

function shape(tag, attrs, fill, opts = {}) {
  const pairs = Object.entries(attrs).map(([key, value]) => `${key}="${value}"`);
  const extra = opts.extra === undefined ? "" : ` ${opts.extra}`;
  return `<${tag} ${pairs.join(" ")} fill="${fill}" ${strokeAttrs(opts)}${extra}/>`;
}

/** `flat` = aplat sans contour, `stroke`/`width` = contour spécifique, sinon encre noire. */
function strokeAttrs(opts) {
  if (opts.flat === true) return 'stroke="none"';
  const width = opts.width ?? 2.5;
  const color = opts.stroke ?? INK;
  return `stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;
}

const rect = (x, y, w, h, fill, opts) => shape("rect", { x, y, width: w, height: h }, fill, opts);
const circle = (cx, cy, r, fill, opts) => shape("circle", { cx, cy, r }, fill, opts);
const ellipse = (cx, cy, rx, ry, fill, opts) => shape("ellipse", { cx, cy, rx, ry }, fill, opts);
const poly = (points, fill, opts) => shape("polygon", { points }, fill, opts);
const path = (d, fill, opts) => shape("path", { d }, fill, opts);

/** Ombrage simple : un ton plus sombre de la couleur de base. */
function darken(hex, factor = 0.72) {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [16, 8, 0].map((shift) => Math.round(((value >> shift) & 255) * factor));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Deux bottes identiques : la base commune de toutes les entités bipèdes. */
function boots(color) {
  return { legR: rect(34, 48, 7, 10, color, { extra: 'rx="3"' }), legL: rect(23, 48, 7, 10, color, { extra: 'rx="3"' }) };
}

/** Yeux : deux points d'encre sans contour. */
function eyes(leftX = 28.5, rightX = 35.5, y = 25) {
  return circle(leftX, y, 1.4, INK, { flat: true }) + circle(rightX, y, 1.4, INK, { flat: true });
}

/** Tête chibi : un disque de peau, avec un léger ombrage sur la joue droite. */
function head(skin, cy = 26, r = 10) {
  return circle(32, cy, r, skin) + circle(36, cy + 3, r * 0.42, darken(skin, 0.9), { flat: true });
}

/* ------------------------------------------------------- parties et pivots */

const PART_ORDER = ["back", "legR", "legL", "body", "armL", "head", "hair", "armR", "prop"];

/** Point de rotation de chaque partie, en coordonnées locales de cellule. */
const PIVOTS = {
  back: [32, 42],
  legR: [37, 52],
  legL: [27, 52],
  body: [32, 54],
  armL: [22, 42],
  head: [32, 36],
  hair: [32, 24],
  armR: [42, 42],
  prop: [42, 44],
};

/* ------------------------------------------------------- deltas par frame */

/**
 * Chaque frame = `{ dy, tilt, parts }` :
 *  - `dy`   : rebond vertical de toute la silhouette,
 *  - `tilt` : inclinaison du corps autour des pieds,
 *  - `parts`: rotation en degrés de chaque partie nommée autour de son pivot,
 *  - `flash`: surbrillance d'impact (flash blanc translucide).
 */
const DEFAULT_DELTAS = {
  idle: [
    { dy: 0, tilt: 0, parts: {} },
    { dy: -1, tilt: -0.8, parts: { head: 1.5, hair: 2, armL: -3, armR: 3, prop: 2, body: -1 } },
    { dy: -2, tilt: -1.2, parts: { head: 2.5, hair: 3, armL: -5, armR: 5, prop: 3.5, body: -1.5 } },
    { dy: -1, tilt: -0.8, parts: { head: 1.5, hair: 2, armL: -3, armR: 3, prop: 2, body: -1 } },
  ],
  walk: [
    { dy: 0, tilt: -2, parts: { legL: 22, legR: -22, armL: -9, armR: 9, head: -2, hair: -3, prop: 6 } },
    { dy: -3, tilt: 1, parts: { legL: 0, legR: 0, armL: -2, armR: 2, head: 1, hair: 2, prop: 2 } },
    { dy: 0, tilt: 2, parts: { legL: -22, legR: 22, armL: 9, armR: -9, head: 2, hair: 3, prop: -6 } },
    { dy: -3, tilt: 1, parts: { legL: 0, legR: 0, armL: -2, armR: 2, head: 1, hair: 2, prop: 2 } },
  ],
  attack: [
    { dy: 0, tilt: -6, parts: { armR: -35, prop: -40, armL: -10, head: -4, hair: -6, body: -3 } },
    { dy: -2, tilt: 6, parts: { armR: 30, prop: 45, armL: 10, head: 5, hair: 8, body: 4 } },
    { dy: 0, tilt: 10, parts: { armR: 55, prop: 80, armL: 16, head: 8, hair: 12, body: 6 }, flash: true },
    { dy: -1, tilt: 2, parts: { armR: 12, prop: 20, armL: 4, head: 2, hair: 4, body: 2 } },
  ],
  hit: [
    { dy: 0, tilt: -12, parts: { head: -10, hair: -14, armL: -18, armR: 18, body: -8 } },
    { dy: -2, tilt: -16, parts: { head: -14, hair: -18, armL: -22, armR: 22, body: -10 }, flash: true },
    { dy: 0, tilt: -6, parts: { head: -6, hair: -8, armL: -10, armR: 10, body: -4 } },
    { dy: 0, tilt: 0, parts: { head: 0, hair: 2, armL: 0, armR: 0, body: 0 } },
  ],
};

/** Deltas propres à un oiseau rond et sans jambes : sauts sur place. */
const BIRD_DELTAS = {
  walk: [
    { dy: 0, tilt: -3, parts: { armL: -16, armR: 16, head: -2, hair: -4, prop: 0 } },
    { dy: -7, tilt: 0, parts: { armL: 4, armR: -4, head: 1, hair: 4, prop: 0 } },
    { dy: 0, tilt: 3, parts: { armL: 16, armR: -16, head: 2, hair: -4, prop: 0 } },
    { dy: -7, tilt: 0, parts: { armL: 4, armR: -4, head: 1, hair: 4, prop: 0 } },
  ],
  attack: [
    { dy: 0, tilt: -8, parts: { head: -12, hair: -14, armL: -20, armR: 20, prop: 0 } },
    { dy: -3, tilt: 8, parts: { head: 14, hair: 18, armL: 12, armR: -12, prop: 0 } },
    { dy: 0, tilt: 12, parts: { head: 20, hair: 24, armL: 20, armR: -20, prop: 0 }, flash: true },
    { dy: -1, tilt: 3, parts: { head: 6, hair: 8, armL: 6, armR: -6, prop: 0 } },
  ],
};

/* ------------------------------------------------------------- silhouettes */

const IOP = {
  id: "iop",
  label: "Iop",
  parts: {
    back: poly("18,36 46,36 52,58 12,58", "#8f2320"),
    ...boots("#5b3a22"),
    body:
      rect(21, 33, 22, 21, "#b8332f", { extra: 'rx="4"' }) +
      rect(30, 39, 4, 15, "#7d1f1c", { flat: true }) +
      rect(20, 32, 24, 4, "#f2d64b", { extra: 'rx="2"' }),
    armL: rect(15, 35, 6, 16, "#e8b98c", { extra: 'rx="3"' }),
    head: head("#e8b98c") + eyes(),
    hair: poly("20,23 24,8 28,18 32,5 36,17 40,8 44,23", "#d4642a"),
    armR: rect(42, 35, 6, 16, "#e8b98c", { extra: 'rx="3"' }),
    prop:
      rect(45, 12, 4, 27, "#cdd3da", { extra: 'rx="1"' }) +
      rect(40, 37, 14, 3, "#f2d64b", { extra: 'rx="1"' }) +
      rect(45.5, 40, 3, 8, "#7a5230"),
  },
};

const CRA = {
  id: "cra",
  label: "Crâ",
  parts: {
    back: poly("19,32 45,32 48,58 16,58", "#3f6b3a") + rect(41, 24, 6, 20, "#7a5230", { extra: 'rx="2"' }),
    ...boots("#4a3a22"),
    body: rect(21, 33, 22, 21, "#4f8f45", { extra: 'rx="4"' }) + rect(21, 48, 22, 4, "#7a5230"),
    armL: rect(15, 35, 6, 16, "#e8b98c", { extra: 'rx="3"' }),
    head: head("#e8b98c") + eyes(28.5, 35.5, 26),
    hair: path("M18 26 Q32 6 46 26 Q32 18 18 26 Z", "#3f6b3a") + poly("17,25 32,12 47,25 44,29 32,20 20,29", "#2f5230"),
    armR: rect(42, 35, 6, 16, "#e8b98c", { extra: 'rx="3"' }),
    prop:
      path("M45 12 Q58 36 45 58", "none", { stroke: "#8a6231", width: 3 }) +
      rect(43, 12, 3, 46, "#c9a86a", { flat: true }) +
      rect(40, 33, 12, 2, "#e8dcc0", { flat: true }),
  },
};

const FECA = {
  id: "feca",
  label: "Féca",
  parts: {
    back:
      ellipse(16, 42, 9, 12, "#3f7fd6") +
      ellipse(16, 42, 5, 8, "#f2d64b", { flat: true }) +
      poly("24,32 40,32 44,58 20,58", "#254f8c"),
    ...boots("#2c3a4a"),
    body:
      rect(21, 33, 22, 21, "#3f7fd6", { extra: 'rx="3"' }) +
      rect(31, 35, 3, 18, "#f2d64b", { flat: true }) +
      rect(21, 45, 22, 4, "#f2d64b"),
    armL: rect(15, 35, 6, 16, "#cdd3da", { extra: 'rx="3"' }),
    head: head("#e8b98c") + eyes(),
    hair: path("M20 22 Q32 6 44 22 L44 26 Q32 16 20 26 Z", "#cdd3da") + rect(30, 6, 4, 10, "#f2d64b", { extra: 'rx="2"' }),
    armR: rect(42, 35, 6, 16, "#cdd3da", { extra: 'rx="3"' }),
    prop: rect(41, 30, 4, 22, "#8a6231", { extra: 'rx="2"' }) + circle(43, 28, 5, "#f2d64b"),
  },
};

const SRAM = {
  id: "sram",
  label: "Sram",
  parts: {
    back: poly("18,32 46,32 49,58 15,58", "#2b2f3a"),
    ...boots("#1f232b"),
    body: rect(21, 33, 22, 21, "#3a4150", { extra: 'rx="4"' }) + rect(28, 38, 8, 16, "#22262f", { flat: true }),
    armL: rect(15, 35, 6, 16, "#3a4150", { extra: 'rx="3"' }),
    head: circle(32, 26, 10, "#efe6d2") + circle(28.5, 24, 2.2, INK, { flat: true }) + circle(35.5, 24, 2.2, INK, { flat: true }),
    hair:
      path("M18 26 Q32 4 46 26 L46 33 Q32 22 18 33 Z", "#2b2f3a") +
      rect(28, 31, 3, 3, INK, { flat: true }) +
      rect(33, 31, 3, 3, INK, { flat: true }),
    armR: rect(42, 35, 6, 16, "#3a4150", { extra: 'rx="3"' }),
    prop:
      poly("41,34 45,32 47,14 43,16", "#cdd3da") +
      rect(40, 32, 10, 2, "#8a6231", { flat: true }),
  },
};

const ENIRIPSA = {
  id: "eniripsa",
  label: "Eniripsa",
  parts: {
    back:
      poly("7,36 17,16 25,34 20,48", "#f4d7e0") +
      poly("57,36 47,16 39,34 44,48", "#f4d7e0"),
    ...boots("#e8dcc0"),
    body: poly("22,32 42,32 46,58 18,58", "#f7f2e8") + rect(22, 44, 20, 3, "#e8a0b4", { flat: true }),
    armL: rect(15, 35, 6, 16, "#f0c8a8", { extra: 'rx="3"' }),
    head: head("#f0c8a8") + eyes(),
    hair: path("M20 24 Q32 8 44 24 Q40 18 32 18 Q24 18 20 24 Z", "#e2a8c0") + circle(32, 10, 4, "#f4d7e0"),
    armR: rect(42, 35, 6, 16, "#f0c8a8", { extra: 'rx="3"' }),
    prop: rect(41, 22, 3, 28, "#c9a86a") + poly("43,10 46,17 53,17 47,21 49,28 43,24 37,28 39,21 33,17 40,17", "#f2d64b"),
  },
};

const ENUTROF = {
  id: "enutrof",
  label: "Enutrof",
  parts: {
    back: poly("22,34 42,34 46,58 18,58", "#6b5230"),
    ...boots("#4a3a22"),
    body: rect(21, 33, 22, 21, "#8d6b3d", { extra: 'rx="4"' }) + rect(21, 46, 22, 5, "#5c4425"),
    armL: rect(15, 35, 6, 16, "#e8b98c", { extra: 'rx="3"' }),
    head: head("#e8b98c") + eyes(28.5, 35.5, 24),
    hair:
      path("M22 30 Q26 46 32 46 Q38 46 42 30 Q38 40 32 40 Q26 40 22 30 Z", "#efe6d2") +
      path("M18 24 Q32 14 46 24 L44 18 Q32 10 20 18 Z", "#6b5230") +
      circle(32, 14, 3, "#f2d64b"),
    armR: rect(42, 35, 6, 16, "#e8b98c", { extra: 'rx="3"' }),
    prop:
      rect(42, 18, 3, 30, "#c9a86a") +
      poly("37,46 50,46 47,54 40,54", "#f2d64b"),
  },
};

const OSAMODAS = {
  id: "osamodas",
  label: "Osamodas",
  parts: {
    back: path("M40 40 Q56 44 52 60 Q46 52 38 50 Z", "#4a7f8c"),
    ...boots("#2f4a52"),
    body: rect(21, 33, 22, 21, "#5b8f9a", { extra: 'rx="4"' }) + rect(28, 36, 8, 18, "#3f6b75", { flat: true }),
    armL: rect(15, 35, 6, 16, "#8fc0c8", { extra: 'rx="3"' }),
    head: circle(32, 26, 10, "#8fc0c8") + eyes() + circle(36, 29, 3.4, darken("#8fc0c8", 0.88), { flat: true }),
    hair:
      poly("22,20 18,6 27,14", "#e8dcc0") +
      poly("42,20 46,6 37,14", "#e8dcc0") +
      circle(32, 18, 6, "#3f6b75"),
    armR: rect(42, 35, 6, 16, "#8fc0c8", { extra: 'rx="3"' }),
    prop: path("M44 30 Q56 36 40 46 Q24 54 40 60", "none", { stroke: "#8a4a2a", width: 3 }),
  },
};

const XELOR = {
  id: "xelor",
  label: "Xelor",
  parts: {
    back: poly("16,34 48,34 44,58 20,58", "#4a3a5c"),
    ...boots("#3a2f4a"),
    body:
      rect(21, 33, 22, 21, "#c9a86a", { extra: 'rx="4"' }) +
      rect(21, 40, 22, 3, "#8a6231", { flat: true }) +
      rect(21, 47, 22, 3, "#8a6231", { flat: true }),
    armL: rect(15, 35, 6, 16, "#c9a86a", { extra: 'rx="3"' }),
    head: head("#e8b98c") + eyes(),
    hair: rect(23, 15, 18, 7, "#c9a86a", { extra: 'rx="3"' }) + rect(29, 8, 6, 9, "#8a6231", { extra: 'rx="2"' }),
    armR: rect(42, 35, 6, 16, "#c9a86a", { extra: 'rx="3"' }),
    prop:
      poly("45,24 53,24 49,33 53,42 45,42 49,33", "#9fd6e0") +
      rect(44, 22, 10, 2, "#8a6231", { flat: true }) +
      rect(44, 42, 10, 2, "#8a6231", { flat: true }),
  },
};

const ECAFLIP = {
  id: "ecaflip",
  label: "Ecaflip",
  parts: {
    back: poly("17,34 47,34 52,58 12,58", "#b8332f"),
    ...boots("#5c2a22"),
    body:
      rect(21, 33, 22, 21, "#7ab0a8", { extra: 'rx="4"' }) +
      rect(21, 45, 22, 5, "#b8332f") +
      circle(32, 36, 2.4, "#b8332f", { flat: true }),
    armL: rect(15, 35, 6, 16, "#f0c8a8", { extra: 'rx="3"' }),
    head: head("#f0c8a8") + eyes(),
    hair:
      poly("21,19 21,6 29,16", "#e8b98c") +
      poly("43,19 43,6 35,16", "#e8b98c") +
      poly("23,18 25,9 28,16", "#e8a0b4") +
      poly("41,18 39,9 36,16", "#e8a0b4"),
    armR: rect(42, 35, 6, 16, "#f0c8a8", { extra: 'rx="3"' }),
    prop:
      rect(39, 26, 9, 9, "#f7f2e8", { extra: 'rx="2"' }) +
      circle(41, 29, 1.2, INK, { flat: true }) +
      circle(46, 32, 1.2, INK, { flat: true }) +
      circle(41, 33, 1.2, INK, { flat: true }),
  },
};

const SADIDA = {
  id: "sadida",
  label: "Sadida",
  parts: {
    back: poly("20,32 44,32 48,58 16,58", "#4f7a3a"),
    ...boots("#6b5230"),
    body: rect(21, 33, 22, 21, "#7a9c4a", { extra: 'rx="4"' }) + rect(21, 46, 22, 5, "#4f7a3a"),
    armL: rect(15, 35, 6, 16, "#c9a86a", { extra: 'rx="3"' }),
    head:
      circle(32, 26, 10, "#c9a86a") +
      circle(28.5, 24, 2, INK, { flat: true }) +
      circle(35.5, 24, 2, INK, { flat: true }) +
      rect(29, 30, 6, 2, INK, { flat: true }),
    hair:
      path("M18 24 Q26 8 32 16 Q38 8 46 24 Q38 16 32 22 Q26 16 18 24 Z", "#4f7a3a") +
      circle(20, 16, 4, "#7a9c4a") +
      circle(44, 16, 4, "#7a9c4a") +
      circle(32, 8, 4, "#7a9c4a"),
    armR: rect(42, 35, 6, 16, "#c9a86a", { extra: 'rx="3"' }),
    prop: rect(42, 16, 3, 32, "#8a6231") + path("M45 18 Q56 12 50 26 Q46 20 45 18 Z", "#7a9c4a"),
  },
};

const SACRIEUR = {
  id: "sacrieur",
  label: "Sacrieur",
  parts: {
    back: poly("20,34 44,34 46,58 18,58", "#8a4a52"),
    ...boots("#4a3a2a"),
    body:
      rect(21, 33, 22, 21, "#c96a5a", { extra: 'rx="4"' }) +
      path("M27 36 L34 42 L28 48", "none", { stroke: "#8a2f2a", width: 2.5 }) +
      rect(21, 47, 22, 4, "#5c3a30"),
    armL: rect(14, 34, 7, 17, "#e8b98c", { extra: 'rx="3"' }) + rect(14, 46, 7, 4, "#f7f2e8", { flat: true }),
    head: head("#e8b98c") + eyes() + path("M26 30 Q32 34 38 30", "none", { stroke: "#8a2f2a", width: 2 }),
    hair: rect(22, 16, 20, 6, "#8a2f2a", { extra: 'rx="3"' }),
    armR: rect(41, 34, 7, 17, "#e8b98c", { extra: 'rx="3"' }) + rect(41, 46, 7, 4, "#f7f2e8", { flat: true }),
    prop: rect(41, 46, 5, 5, "#f7f2e8", { extra: 'rx="2"' }),
  },
};

const PANDAWA = {
  id: "pandawa",
  label: "Pandawa",
  parts: {
    back:
      rect(10, 38, 14, 18, "#b07a3a", { extra: 'rx="6"' }) +
      rect(10, 44, 14, 3, "#7a5230", { flat: true }) +
      rect(10, 51, 14, 3, "#7a5230", { flat: true }),
    ...boots("#2b2622"),
    body: rect(21, 33, 22, 21, "#f7f2e8", { extra: 'rx="4"' }) + rect(21, 44, 22, 9, "#2b2622"),
    armL: rect(15, 35, 6, 16, "#2b2622", { extra: 'rx="3"' }),
    head: head("#f7f2e8") + circle(27, 24, 3, "#2b2622", { flat: true }) + circle(37, 24, 3, "#2b2622", { flat: true }),
    hair:
      rect(11, 14, 42, 4, "#c9a86a", { extra: 'rx="2"' }) +
      poly("18,14 46,14 32,2", "#c9a86a") +
      rect(16, 13, 32, 2, "#8a6231", { flat: true }),
    armR: rect(42, 35, 6, 16, "#2b2622", { extra: 'rx="3"' }),
    prop: rect(41, 30, 5, 24, "#b07a3a", { extra: 'rx="2"' }) + rect(39, 28, 9, 4, "#8a6231", { flat: true }),
  },
};

const PIOU = {
  id: "piou_mazoute",
  label: "Piou Mazouté",
  deltas: BIRD_DELTAS,
  shadow: { rx: 13, ry: 5 },
  parts: {
    back: ellipse(32, 44, 16, 14, "#2b2431"),
    legL: rect(26, 56, 5, 4, "#e8a13a", { extra: 'rx="1"' }),
    legR: rect(34, 56, 5, 4, "#e8a13a", { extra: 'rx="1"' }),
    body:
      ellipse(32, 40, 15, 15, "#3a2f44") +
      ellipse(34, 46, 9, 7, "#59456b", { flat: true }) +
      path("M22 50 Q26 60 30 54 Q34 62 38 54 Q42 60 44 50 Z", "#1f1a24", { flat: true }),
    armL: ellipse(17, 38, 5, 8, "#4a3a56"),
    head:
      circle(32, 26, 13, "#3a2f44") +
      circle(27, 22, 4, "#f7f2e8") +
      circle(27, 22, 1.8, INK, { flat: true }) +
      circle(38, 24, 3, "#f7f2e8") +
      circle(38, 24, 1.4, INK, { flat: true }) +
      poly("30,30 40,32 30,36", "#e8a13a"),
    hair: poly("20,16 26,6 30,14", "#59456b") + poly("44,16 38,6 34,14", "#59456b"),
    armR: ellipse(47, 38, 5, 8, "#4a3a56"),
    prop: path("M24 48 Q28 58 24 62", "none", { stroke: "#141018", width: 2.5 }),
  },
};

/* ------------------------------------------------- monstres de la Ferraille */

/**
 * Rat d'Égoût-dron : trottineur bas sur pattes. La queue (`back`) balaie à
 * chaque pas, la morsure part vers l'avant — il ne recule jamais.
 */
const RAT_DELTAS = {
  idle: [
    { dy: 0, tilt: 0, parts: {} },
    { dy: -1, tilt: 0, parts: { body: -1, head: 1, hair: 1.5, armL: -2, armR: 2, back: -3 } },
    { dy: 0, tilt: 0, parts: { body: 1, head: -1, hair: -1, back: 2 } },
    { dy: -1, tilt: 0, parts: { body: -1, head: 1, hair: 1.5, armL: -2, armR: 2, back: -3 } },
  ],
  walk: [
    { dy: 0, tilt: -2, parts: { legL: 22, legR: -22, armL: -16, armR: 16, head: -2, hair: -3, back: -6 } },
    { dy: -2, tilt: 1, parts: { legL: 0, legR: 0, armL: 0, armR: 0, head: 1 } },
    { dy: 0, tilt: 2, parts: { legL: -22, legR: 22, armL: 16, armR: -16, head: 2, hair: 3, back: 6 } },
    { dy: -2, tilt: 1, parts: { legL: 0, legR: 0, armL: 0, armR: 0, head: 1 } },
  ],
  attack: [
    { dy: 0, tilt: -5, parts: { head: -7, hair: -9, armL: -10, armR: 10, body: -3, back: -4 } },
    { dy: -3, tilt: 6, parts: { head: 8, hair: 10, armL: 8, armR: -8, body: 4, back: 4 } },
    { dy: 0, tilt: 10, parts: { head: 13, hair: 16, armL: 14, armR: -14, body: 6, back: 6 }, flash: true },
    { dy: -1, tilt: 3, parts: { head: 4, hair: 5, body: 2 } },
  ],
  hit: [
    { dy: 0, tilt: -10, parts: { head: -8, hair: -10, armL: -14, armR: 14, body: -6, back: -8 } },
    { dy: -2, tilt: -15, parts: { head: -12, hair: -14, armL: -18, armR: 18, body: -8, back: -10 }, flash: true },
    { dy: 0, tilt: -6, parts: { head: -5, hair: -6, armL: -8, armR: 8, body: -4, back: -4 } },
    { dy: 0, tilt: 0, parts: { head: 0, hair: 2, armL: 0, armR: 0, body: 0, back: 0 } },
  ],
};

/**
 * Crabe à Clé-à-Molette : la carapace tangue latéralement, la pince gauche
 * claque, la clé (main droite) n'est qu'un emblème — les rotations de `prop`
 * restent faibles pour ne jamais sortir de la cellule.
 */
const CRABE_DELTAS = {
  idle: [
    { dy: 0, tilt: 0, parts: {} },
    { dy: -1, tilt: 0, parts: { head: 2, armL: -6, armR: 2, prop: 3 } },
    { dy: 0, tilt: 0, parts: { head: -1, armL: 3, armR: -1, prop: -2 } },
    { dy: -1, tilt: 0, parts: { head: 2, armL: -6, armR: 2, prop: 3 } },
  ],
  walk: [
    { dy: 0, tilt: -3, parts: { legL: 18, legR: -18, armL: -8, armR: 8, head: -3, prop: -5 } },
    { dy: -2, tilt: 0, parts: { legL: 0, legR: 0, armL: 0, armR: 0, head: 1 } },
    { dy: 0, tilt: 3, parts: { legL: -18, legR: 18, armL: 8, armR: -8, head: 3, prop: 5 } },
    { dy: -2, tilt: 0, parts: { legL: 0, legR: 0, armL: 0, armR: 0, head: 1 } },
  ],
  attack: [
    { dy: 0, tilt: -4, parts: { armL: -26, head: -4, hair: -4, armR: -14, prop: -8, body: -2 } },
    { dy: -1, tilt: 4, parts: { armL: 14, head: 4, armR: 10, prop: 6, body: 3 } },
    { dy: 0, tilt: 8, parts: { armL: 32, head: 8, armR: 14, prop: 12, body: 5 }, flash: true },
    { dy: -1, tilt: 2, parts: { armL: 6, head: 2, armR: 4, prop: 4, body: 1 } },
  ],
  hit: [
    { dy: 0, tilt: -10, parts: { head: -8, hair: -10, armL: -16, armR: 16, body: -6 } },
    { dy: -2, tilt: -14, parts: { head: -12, hair: -14, armL: -20, armR: 20, body: -8 }, flash: true },
    { dy: 0, tilt: -5, parts: { head: -5, hair: -6, armL: -8, armR: 8, body: -3 } },
    { dy: 0, tilt: 0, parts: { head: 0, hair: 0, armL: 0, armR: 0, body: 0 } },
  ],
};

/** Écrou-Baton : masse d'acier, pas lourds, et une poussée au bâton qui engage tout le corps. */
const BOULON_DELTAS = {
  idle: [
    { dy: 0, tilt: 0, parts: {} },
    { dy: -1, tilt: 0, parts: { body: -1, head: 1, hair: 1, armL: -3, armR: 3, prop: 2 } },
    { dy: 0, tilt: 0, parts: { body: 1, head: -1, hair: -1, armL: 2, armR: -2, prop: -1 } },
    { dy: -1, tilt: 0, parts: { body: -1, head: 1, hair: 1, armL: -3, armR: 3, prop: 2 } },
  ],
  walk: [
    { dy: 0, tilt: -2, parts: { legL: 14, legR: -14, armL: -6, armR: 6, head: -2, hair: -2, prop: 4 } },
    { dy: -2, tilt: 0, parts: { legL: 0, legR: 0, head: 1 } },
    { dy: 0, tilt: 2, parts: { legL: -14, legR: 14, armL: 6, armR: -6, head: 2, hair: 2, prop: -4 } },
    { dy: -2, tilt: 0, parts: { legL: 0, legR: 0, head: 1 } },
  ],
  attack: [
    { dy: 0, tilt: -6, parts: { armR: -14, prop: -18, armL: -8, head: -4, body: -3 } },
    { dy: -1, tilt: 5, parts: { armR: 18, prop: 10, armL: 8, head: 5, body: 4 } },
    { dy: 0, tilt: 9, parts: { armR: 30, prop: 22, armL: 14, head: 8, body: 6 }, flash: true },
    { dy: -1, tilt: 2, parts: { armR: 8, prop: 6, armL: 3, head: 2, body: 2 } },
  ],
  hit: [
    { dy: 0, tilt: -9, parts: { head: -8, hair: -10, armL: -14, armR: 14, body: -6 } },
    { dy: -2, tilt: -13, parts: { head: -12, hair: -14, armL: -18, armR: 18, body: -8 }, flash: true },
    { dy: 0, tilt: -5, parts: { head: -5, hair: -6, armL: -8, armR: 8, body: -3 } },
    { dy: 0, tilt: 0, parts: { head: 0, hair: 0, armL: 0, armR: 0, body: 0, prop: 0 } },
  ],
};

/**
 * Rat d'Égoût-dron (niv. 6, `melee_rusher`) : rat de cale goudronné, museau
 * pointu, grandes oreilles roses, queue de caoutchouc et câble rongé sous les
 * pattes — la description du bestiaire dit « trois câbles » et « mazout ».
 */
const FER_RAT = {
  id: "fer_rat_de_cale",
  label: "Rat d'Égoût-dron",
  deltas: RAT_DELTAS,
  shadow: { rx: 16, ry: 4.5 },
  parts: {
    back:
      path("M15 43 Q2 37 5 26 Q7 20 11 22 Q8 29 12 34 Q15 38 19 40 Z", "#a8806a") +
      rect(5, 54, 20, 3, "#2b2622", { extra: 'rx="1"' }) +
      rect(25, 54, 4, 3, "#c9743a", { flat: true }),
    legL: rect(18, 49, 6, 9, "#3a322c", { extra: 'rx="2"' }),
    legR: rect(27, 49, 6, 9, "#332b26", { extra: 'rx="2"' }),
    body:
      ellipse(29, 43, 16, 11, "#4a4038") +
      ellipse(29, 47, 11, 5, "#6b5c4c", { flat: true }) +
      path("M21 48 Q19 55 23 55 Q26 54 24 48 Z", "#1f1a17", { flat: true }),
    armL: rect(35, 49, 5, 9, "#3a322c", { extra: 'rx="2"' }),
    head:
      circle(46, 36, 9, "#5a4a3e") +
      poly("51,32 61,37 51,42", "#7a6a5a") +
      circle(60, 37, 1.8, "#d99a8a") +
      circle(47.5, 33, 1.7, INK, { flat: true }) +
      rect(52, 39, 4, 3, "#f7f2e8", { flat: true }) +
      path("M57 35 L62 32 M57 39 L62 41", "none", { stroke: "#f7f2e8", width: 1 }),
    hair:
      circle(42, 29, 5, "#6b5c4c") +
      circle(42, 29, 2.4, "#d99a8a", { flat: true }) +
      circle(50, 30, 4.5, "#6b5c4c") +
      circle(50, 30, 2, "#d99a8a", { flat: true }),
    armR: rect(41, 49, 5, 9, "#332b26", { extra: 'rx="2"' }),
  },
};

/**
 * Crabe à Clé-à-Molette (niv. 9, `tank_tackler`) : carapace de tôle rouillée,
 * six pattes (trois par côté, dont une paire dans `back`), deux pédoncules
 * oculaires, pince gauche et clé à molette soudée au bras droit.
 */
const FER_CRABE = {
  id: "fer_crabe_cle_molette",
  label: "Crabe à Clé-à-Molette",
  deltas: CRABE_DELTAS,
  shadow: { rx: 17, ry: 5 },
  parts: {
    back:
      path("M16 43 L4 48", "none", { stroke: "#8f3a22", width: 3 }) +
      path("M15 48 L4 53", "none", { stroke: "#8f3a22", width: 3 }),
    legL: path("M19 53 L8 58", "none", { stroke: "#a8432a", width: 3 }),
    legR:
      path("M46 43 L56 47", "none", { stroke: "#a8432a", width: 3 }) +
      path("M47 48 L57 52", "none", { stroke: "#a8432a", width: 3 }) +
      path("M47 53 L57 57", "none", { stroke: "#a8432a", width: 3 }),
    body:
      ellipse(32, 41, 18, 12, "#c0563a") +
      ellipse(32, 45, 14, 7, "#d9714f", { flat: true }) +
      circle(24, 38, 2.6, "#8f3a22", { flat: true }) +
      circle(40, 38, 2.6, "#8f3a22", { flat: true }) +
      path("M32 33 Q38 41 32 49 Q26 41 32 33 Z", "#a8432a", { flat: true }),
    armL:
      poly("15 43 5 39 4 30 12 30 13 35 17 37", "#c0563a") +
      path("M7 33 L14 34", "none", { stroke: "#8f3a22", width: 2 }),
    head:
      rect(26, 24, 3, 11, "#c0563a") +
      rect(36, 23, 3, 12, "#c0563a") +
      circle(27.5, 23, 4.2, "#f7f2e8") +
      circle(37.5, 22, 4.2, "#f7f2e8") +
      circle(28, 22.5, 1.6, INK, { flat: true }) +
      circle(38, 21.5, 1.6, INK, { flat: true }),
    hair:
      circle(22, 41, 2, "#f2d64b", { flat: true }) +
      circle(42, 41, 2, "#f2d64b", { flat: true }) +
      circle(32, 47, 2, "#f2d64b", { flat: true }),
    armR: rect(47, 38, 4, 13, "#c0563a", { extra: 'rx="2"' }),
    prop:
      rect(49, 28, 4, 22, "#cdd3da", { extra: 'rx="1"' }) +
      rect(43, 16, 5, 13, "#cdd3da") +
      rect(55, 16, 5, 13, "#cdd3da") +
      rect(46, 24, 11, 4, "#cdd3da", { flat: true }) +
      circle(51.5, 26, 1.8, "#c9a86a", { flat: true }),
  },
};

/**
 * Écrou-Baton (niv. 15, `pusher_control`) : un écrou hexagonal de la taille
 * d'un homme, filetage doré, casque de chantier jaune et bâton de pousseur —
 * « sens très développé de l'injustice salariale », donc casque et bâton.
 */
const FER_BOULON = {
  id: "fer_boulon_pousseur",
  label: "Écrou-Baton",
  deltas: BOULON_DELTAS,
  shadow: { rx: 14, ry: 4.5 },
  parts: {
    back:
      poly("20,36 44,36 47,52 17,52", "#6b7681") +
      circle(20, 44, 2.2, "#4a5058", { flat: true }) +
      circle(44, 44, 2.2, "#4a5058", { flat: true }),
    legL: rect(23, 51, 7, 9, "#3a4048", { extra: 'rx="2"' }),
    legR: rect(34, 51, 7, 9, "#333941", { extra: 'rx="2"' }),
    body:
      poly("22,25 42,25 50,41 42,58 22,58 14,41", "#9aa4ad") +
      circle(32, 41, 8, "#3a4048") +
      path("M32 34 Q39 38 35 43 Q31 47 26 43 Q22 39 27 35", "none", { stroke: "#c9a86a", width: 2 }) +
      rect(21, 27, 22, 3, "#b6c0c8", { flat: true }) +
      circle(17, 42, 1.8, "#6b7681", { flat: true }) +
      circle(47, 42, 1.8, "#6b7681", { flat: true }),
    armL:
      rect(8, 37, 6, 16, "#8b959e", { extra: 'rx="3"' }) +
      rect(7, 48, 8, 6, "#6b7681", { extra: 'rx="2"' }),
    head:
      circle(32, 19, 9, "#b6c0c8") +
      circle(28.5, 19, 1.8, INK, { flat: true }) +
      circle(35.5, 19, 1.8, INK, { flat: true }) +
      path("M27 24 Q32 28 37 24", "none", { stroke: "#3a4048", width: 2 }),
    hair:
      path("M20 12 Q32 0 44 12 L44 15 L20 15 Z", "#f2d64b") +
      rect(17, 11, 30, 3, "#f2d64b", { extra: 'rx="1"' }) +
      rect(30, 2, 4, 10, "#e0c23c", { flat: true }),
    armR:
      rect(50, 37, 6, 16, "#8b959e", { extra: 'rx="3"' }) +
      rect(49, 48, 8, 6, "#6b7681", { extra: 'rx="2"' }),
    prop:
      rect(53, 18, 3, 34, "#8a6231") +
      rect(51, 49, 7, 4, "#cdd3da", { extra: 'rx="1"' }) +
      circle(54.5, 42, 2, "#8b959e", { flat: true }),
  },
};

const ENTITIES = [IOP, CRA, FECA, SRAM, ENIRIPSA, ENUTROF, OSAMODAS, XELOR, ECAFLIP, SADIDA, SACRIEUR, PANDAWA, PIOU, FER_RAT, FER_CRABE, FER_BOULON];

/* --------------------------------------------------------- assemblage SVG */

function deltasFor(entity, animation) {
  const override = entity.deltas === undefined ? undefined : entity.deltas[animation];
  return override ?? DEFAULT_DELTAS[animation];
}

function partTransform(name, frame) {
  const parts = frame.parts ?? {};
  const angle = parts[name];
  if (angle === undefined || angle === 0) return "";
  const [cx, cy] = PIVOTS[name];
  return ` transform="rotate(${angle} ${cx} ${cy})"`;
}

function actorMarkup(entity, frame) {
  const uses = PART_ORDER.filter((name) => entity.parts[name] !== undefined).map(
    (name) => `<use href="#p-${name}"${partTransform(name, frame)}/>`,
  );
  const tilt = `translate(0 ${frame.dy ?? 0}) rotate(${frame.tilt ?? 0} 32 58)`;
  return `<g class="actor" transform="${tilt}">${uses.join("")}</g>`;
}

/** Ombre au sol ; les entités larges (crabe) peuvent élargir la leur. */
const DEFAULT_SHADOW = { rx: 13, ry: 4.5 };

function shadowMarkup(entity) {
  const { rx, ry } = entity.shadow ?? DEFAULT_SHADOW;
  return ellipse(32, 60, rx, ry, "#000000", { flat: true, extra: 'opacity="0.22"' });
}

/** Surbrillance d'impact : exprimée dans l'espace de dessin, donc couvre la cellule via `FRAME_SCALE`. */
function flashMarkup(frame) {
  return frame.flash === true ? rect(0, 0, UNIT, UNIT, "#fff2b0", { flat: true, extra: 'opacity="0.22"' }) : "";
}

function frameMarkup(entity, animation, row, column) {
  const frame = deltasFor(entity, animation)[column];
  const offset = `translate(${column * CELL} ${row * CELL})`;
  const body = [shadowMarkup(entity), actorMarkup(entity, frame), flashMarkup(frame)].join("");
  const scaled = `<g transform="scale(${FRAME_SCALE})">${body}</g>`;
  return `<g class="frame" data-animation="${animation}" data-frame="${column}" transform="${offset}"><g clip-path="url(#cell)">${scaled}</g></g>`;
}

function framesMarkup(entity) {
  const frames = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      frames.push(frameMarkup(entity, ANIMATIONS[row], row, column));
    }
  }
  return frames.join("\n    ");
}

function defsMarkup(entity) {
  const clip = `<clipPath id="cell"><rect x="0" y="0" width="${CELL}" height="${CELL}"/></clipPath>`;
  const parts = PART_ORDER.filter((name) => entity.parts[name] !== undefined).map(
    (name) => `<g id="p-${name}">${entity.parts[name]}</g>`,
  );
  return `<defs>${clip}${parts.join("")}</defs>`;
}

function titleMarkup(entity) {
  const animations = ANIMATIONS.join(", ");
  return `<title>La Flotte — ${entity.label} (${animations})</title>`;
}

function svgFor(entity) {
  const header = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET}" height="${SHEET}" viewBox="0 0 ${SHEET} ${SHEET}">`;
  const body = [defsMarkup(entity), framesMarkup(entity)].join("\n    ");
  return `${header}\n  ${titleMarkup(entity)}\n  ${body}\n</svg>\n`;
}

/* ------------------------------------------------------------------ sortie */

function writeSheets() {
  mkdirSync(OUT_DIR, { recursive: true });
  ENTITIES.forEach((entity) => writeFileSync(join(OUT_DIR, `${entity.id}.svg`), svgFor(entity), "utf8"));
  return ENTITIES.length;
}

const TAG = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
const ATTRIBUTE = / ([a-zA-Z][\w:-]*)=/g;

/** Contrôle d'équilibre des balises : équivalent « XML bien formé » pour ce sous-ensemble. */
function isWellFormed(svg) {
  const stack = [];
  for (const [, closing, name, , selfClosing] of svg.matchAll(TAG)) {
    if (closing === "/") {
      if (stack.pop() !== name) return false;
    } else if (selfClosing !== "/") {
      stack.push(name);
    }
  }
  return stack.length === 0;
}

/** Un attribut dupliqué rend le document invalide pour un parseur strict (et pour `<img>`). */
function hasDuplicateAttributes(svg) {
  for (const [, , , attrs = ""] of svg.matchAll(TAG)) {
    const names = [...attrs.matchAll(ATTRIBUTE)].map(([, name]) => name);
    if (new Set(names).size !== names.length) return true;
  }
  return false;
}

function checkSheet(entity) {
  const file = join(OUT_DIR, `${entity.id}.svg`);
  if (!existsSync(file)) return { id: entity.id, ok: false, reason: "fichier absent", bytes: 0 };
  const svg = readFileSync(file, "utf8");
  const bytes = Buffer.byteLength(svg, "utf8");
  const frames = svg.match(/class="frame"/g)?.length ?? 0;
  const problems = [];
  if (svg !== svgFor(entity)) problems.push("feuille désynchronisée du générateur");
  if (!svg.includes(`width="${SHEET}"`) || !svg.includes(`height="${SHEET}"`)) problems.push(`dimensions ≠ ${SHEET}×${SHEET}`);
  if (frames !== 16) problems.push(`frames = ${frames}`);
  if (!isWellFormed(svg)) problems.push("XML mal formé");
  if (hasDuplicateAttributes(svg)) problems.push("attribut dupliqué");
  return { id: entity.id, ok: problems.length === 0, reason: problems.join(", "), bytes };
}

/** Tout `.svg` présent sur disque qui ne sort pas du générateur est un vestige. */
function findUnexpected() {
  return found
    .filter((file) => !expected.includes(file.replace(/\.svg$/, "")))
    .map((file) => ({ id: file, ok: false, reason: "SVG surnuméraire (hors générateur)", bytes: 0 }));
}

function printResults(results) {
  results.forEach((result) => {
    const status = result.ok ? "OK  " : "FAIL";
    const detail = result.ok ? `${result.bytes} o, 16 frames` : result.reason;
    console.log(`${status} ${result.id.padEnd(14)} ${detail}`);
  });
}

function countFailures(results) {
  return results.filter((result) => !result.ok).length;
}

function report(results, extraFailures = 0) {
  printResults(results);
  const total = results.reduce((sum, result) => sum + result.bytes, 0);
  const failures = countFailures(results) + extraFailures;
  console.log(`\n${ENTITIES.length} feuilles, ${total} octets au total, ${failures} échec(s).`);
  return failures;
}

function reportUnexpected(extras) {
  printResults(extras);
  return extras.length;
}

const expected = ENTITIES.map((entity) => entity.id).sort();
const found = existsSync(OUT_DIR) ? readdirSync(OUT_DIR).filter((file) => file.endsWith(".svg")).sort() : [];

if (process.argv.includes("--check")) {
  const missing = expected.filter((id) => !found.includes(`${id}.svg`));
  if (missing.length > 0) console.log(`Manquantes : ${missing.join(", ")}`);
  const extras = findUnexpected();
  const failures = report(ENTITIES.map(checkSheet), extras.length + missing.length);
  reportUnexpected(extras);
  process.exit(failures === 0 ? 0 : 1);
}

const written = writeSheets();
report(ENTITIES.map(checkSheet));
console.log(`\n${written} feuilles écrites dans public/assets/sprites/.`);
