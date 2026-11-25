import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { getCastableCells } from "../../src/engine/combatLoop/castable";
import { allPositions } from "../../src/engine/combatLoop/cells";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { isWalkableCell, parseAsciiMap, samePosition } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { logLook } from "../../src/ui/logElements";
import { slotFace, slotReason, slotStateOf } from "../../src/ui/spellSlotState";
import type { SlotState } from "../../src/ui/spellSlotState";

/**
 * Contenu du dock, **mesuré** : encres PV/PA/PM recalculées par la formule WCAG,
 * absence d'emoji, cinq états de sort, journal teinté par élément.
 *
 * Deux familles d'assertions cohabitent :
 * - les unes lisent le navigateur (`getComputedStyle`) : une classe Tailwind
 *   écrite mais non générée laisserait un fond transparent ;
 * - les autres appellent les résolveurs purs (`slotStateOf`, `logLook`) sur un
 *   combat construit depuis `data/`, seul moyen déterministe d'atteindre « hors
 *   portée » et « PA insuffisants » sans dépendre d'un spawn aléatoire.
 */
const DATA = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const monsters = parseMonstersYaml(DATA("monsters.yaml"));
const classes = parseClassesYaml(DATA("classes.yaml"));
const maps = parseMapsYaml(DATA("maps.yaml"));
const spells = parseSpellsYaml(DATA("spells.yaml"));

const MONSTER_ID = "fer_rat_de_cale";
const MAP_ID = "ferraille_plage_01";
const CLASS_ID = "iop";
const HERO_NAME = "Balthazar";
const LONG_SPELL = "epee_du_destin";

const VITALS = '[data-zone="vitals"] section[aria-label="Ressources du héros"]';
const JOURNAL = '[data-zone="journal"] section[aria-label="Journal de combat"]';
const SPELLS = '[data-zone="spells"] section[aria-label="Sorts disponibles"]';
const DOCK_ZONES = '[data-zone="journal"], [data-zone="vitals"], [data-zone="turn"], [data-zone="spells"]';

/** Encres attendues (spec §1.4/§1.5), et le corps de panneau qui les reçoit. */
const SURFACE_2 = "#3d342a";
const INKS = [
  { label: "PV", hex: "#d68f87", rgb: "rgb(214, 143, 135)" },
  { label: "PA", hex: "#89a0bf", rgb: "rgb(137, 160, 191)" },
  { label: "PM", hex: "#91b083", rgb: "rgb(145, 176, 131)" },
] as const;
const MIN_CONTRAST = 4.5;
/** Remplissages des barres (§2.3) et piste creuse (§1.2). */
const FILLS = ["rgb(184, 59, 59)", "rgb(59, 111, 184)", "rgb(74, 140, 74)"];
const TRACK_INSET = "rgb(26, 21, 18)";
const METER_HEIGHTS = ["8px", "6px", "6px"];

type Channels = readonly [number, number, number];

/** `#RRGGBB` → canaux 0–1 : les hex viennent de la spec, pas du navigateur. */
function channelsOfHex(hex: string): Channels {
  const digits = hex.replace("#", "");
  return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16) / 255) as unknown as Channels;
}

/** `rgb(r, g, b)` déjà composé par le moteur → canaux 0–1. Refuse le reste. */
function channelsOf(value: string): Channels {
  const match = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(value);
  if (match === null) throw new Error(`Couleur non résolue en sRGB opaque : ${value}`);
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}

function linear(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: Channels): number {
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

/** Ratio de contraste WCAG, arrondi au centième. */
function contrast(a: Channels, b: Channels): number {
  const la = luminance(a);
  const lb = luminance(b);
  return Math.round(((Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)) * 100) / 100;
}

/* ------------------------- relevés exécutés dans la page -------------------- */

interface VitalsProbe {
  readonly surface: string;
  readonly texts: readonly { text: string; color: string }[];
}

interface MeterProbe {
  readonly height: string;
  readonly track: string;
  readonly fill: string;
}

/** Fond du panneau de ressources et couleur de **chaque** texte qu'il porte. */
function readVitals(section: HTMLElement): VitalsProbe {
  const surface = getComputedStyle(section).backgroundColor;
  const nodes = [...section.querySelectorAll("span")].filter((node) => (node.textContent ?? "").trim().length > 0);
  const texts = nodes.map((node) => ({ text: (node.textContent ?? "").trim(), color: getComputedStyle(node).color }));
  return { surface, texts };
}

/** Barres : hauteur et fond de la **piste**, plus la couleur du remplissage. */
function readMeters(nodes: Element[]): MeterProbe[] {
  return nodes.map((node) => {
    const track = node.parentElement ?? node;
    return { height: getComputedStyle(track).height, track: getComputedStyle(track).backgroundColor, fill: getComputedStyle(node).backgroundColor };
  });
}

/** Face d'une case de sort : filet et planche, lus par le moteur. */
function readSlotFace(node: Element): { border: string; face: string } {
  const style = getComputedStyle(node);
  return { border: style.borderTopColor, face: style.backgroundColor };
}

/** Lignes du journal : taille du texte et glyphe d'élément. */
function readLogRows(nodes: Element[]): { size: string; glyph: string }[] {
  return nodes.map((node) => ({ size: getComputedStyle(node).fontSize, glyph: node.querySelector("[aria-hidden]")?.textContent ?? "" }));
}

/* ------------------------------- combat de test ------------------------------ */

const NEIGHBOURS: readonly Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function demoCombat(): CombatState {
  const hero = createHero(HERO_NAME, mustFind(classes, CLASS_ID));
  const map = parseAsciiMap(mustFind(maps, MAP_ID).grid);
  return initCombat({ map, hero, monster: mustFind(monsters, MONSTER_ID), spells });
}

function movedTo(combat: CombatState, position: Position): CombatState {
  return { ...combat, player: { ...combat.player, position } };
}

function readableSlots(combat: CombatState, ap: number): CombatState {
  return { ...combat, player: { ...combat.player, ap } };
}

function freeCellNextToEnemy(combat: CombatState): Position {
  const { x, y } = combat.enemy.position;
  const cells = NEIGHBOURS.map((step) => ({ x: x + step.x, y: y + step.y }));
  const free = cells.find((cell) => isWalkableCell(combat.map, cell));
  if (free === undefined) throw new Error("aucune case libre autour du monstre de test");
  return free;
}

/** Combat où les trois sorts du héros sont lançables : PV/PA/PM pleins. */
function inRangeCombat(): CombatState {
  const combat = demoCombat();
  return readableSlots(movedTo(combat, freeCellNextToEnemy(combat)), 12);
}

/** `null` = aucun sort lançable depuis cette case : le cas « hors portée ». */
function farCell(combat: CombatState): Position {
  const far = allPositions(combat.map).find((cell) => isWalkableCell(combat.map, cell) && unwired(combat, cell));
  if (far === undefined) throw new Error("aucune case hors portée sur la carte de test");
  return far;
}

function unwired(combat: CombatState, cell: Position): boolean {
  if (samePosition(cell, combat.enemy.position)) return false;
  return getCastableCells(movedTo(combat, cell), LONG_SPELL).length === 0;
}

/* ---------------------------------- encres ---------------------------------- */

test.describe("encres PV / PA / PM — recalcul WCAG", () => {
  test("les trois encres de la palette dépassent 4,5:1 sur le corps de panneau", () => {
    const surface = channelsOfHex(SURFACE_2);
    for (const ink of INKS) {
      const ratio = contrast(channelsOfHex(ink.hex), surface);
      expect(ratio, `${ink.label} ${ink.hex} sur ${SURFACE_2} : ${ratio}:1`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  test("les compteurs rendus portent exactement les trois encres, toutes lisibles", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(VITALS)).toBeVisible();
    const probe = await page.locator(VITALS).evaluate(readVitals);
    const surface = channelsOf(probe.surface);
    for (const { text, color } of probe.texts) {
      const ratio = contrast(channelsOf(color), surface);
      expect(ratio, `« ${text} » ${color} : ${ratio}:1`).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
    const colors = new Set(probe.texts.map((entry) => entry.color));
    for (const ink of INKS) expect(colors, `encre ${ink.label}`).toContain(ink.rgb);
    const dock = probe.texts.map((entry) => entry.text).join(" · ");
    for (const label of ["PV", "PA", "PM"]) expect(dock, `libellé ${label}`).toMatch(new RegExp(`${label} \\d+ / \\d+`));
  });
});

test.describe("barres de ressource — géométrie et matière", () => {
  test("les barres mesurent 8 px (PV) et 6 px (PA/PM) sur une piste creuse", async ({ page }) => {
    await page.goto("/?demo=combat");
    const fills = page.locator(`${VITALS} div[style*="width"]`);
    await expect(fills).toHaveCount(3);
    const meters = await fills.evaluateAll(readMeters);
    meters.forEach((meter, index) => {
      expect(meter.height, `hauteur de la barre ${index}`).toBe(METER_HEIGHTS[index]);
      expect(meter.track, `piste creuse ${index}`).toBe(TRACK_INSET);
      expect(meter.fill, `remplissage ${index}`).toBe(FILLS[index]);
    });
  });
});

/* --------------------------------- emoji ------------------------------------ */

test.describe("dock — aucune icône emoji", () => {
  test("le texte du dock n'emploie ni pictogramme emoji ni les anciens glyphes", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(SPELLS)).toBeVisible();
    const texts = await page.locator(DOCK_ZONES).evaluateAll((zones) => zones.map((zone) => zone.textContent ?? ""));
    const dock = texts.join("\n");
    expect(dock, "pictogramme emoji dans le dock").not.toMatch(/\p{Extended_Pictographic}/u);
    for (const legacy of ["❤", "★", "👢"]) expect(dock, `ancien glyphe ${legacy}`).not.toContain(legacy);
    expect(dock).toContain("PV");
  });
});

/* -------------------------------- sorts ------------------------------------- */

const STATE_OF_SPELL = (combat: CombatState, id: string): SlotState =>
  slotStateOf({ combat, selectedSpellId: null }, mustFind(spells, id));

/** Les six états d'une case, chacun atteint par une situation distincte. */
function slotStates(): SlotState[] {
  const base = inRangeCombat();
  const selected = slotStateOf({ combat: base, selectedSpellId: "pression" }, mustFind(spells, "pression"));
  return [
    STATE_OF_SPELL(readableSlots(base, 0), "pression"),
    STATE_OF_SPELL({ ...base, phase: "enemy_turn" }, "pression"),
    STATE_OF_SPELL(movedTo(base, farCell(base)), "pression"),
    STATE_OF_SPELL(base, "pression"),
    selected,
    slotStateOf({ combat: base, selectedSpellId: null }, null),
  ];
}

test.describe("cases de sort — cinq états francs", () => {
  test("chaque situation donne un état distinct, la case vide en plus", () => {
    const states = slotStates();
    expect(states).toEqual(["pa-insuffisants", "verrouille", "hors-portee", "disponible", "selectionne", "vide"]);
    expect(new Set(states).size).toBe(6);
  });

  test("les cinq faces sont deux à deux différentes", () => {
    const states: SlotState[] = ["disponible", "selectionne", "hors-portee", "pa-insuffisants", "verrouille"];
    const faces = states.map(slotFace);
    expect(new Set(faces).size).toBe(states.length);
    for (const face of faces) expect(face).toContain("border-");
  });

  test("la cause est écrite dans l'infobulle, jamais seulement en couleur", () => {
    expect(slotReason("hors-portee")).toBe("Hors portée");
    expect(slotReason("pa-insuffisants")).toBe("PA insuffisants");
    expect(slotReason("verrouille")).toBe("Tour adverse");
    expect(slotReason("disponible")).toBeNull();
  });
});

test.describe("cases de sort — états rendus dans le dock", () => {
  test("hors portée se lit à la trame et au filet creux, pas à la seule couleur", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(SPELLS)).toBeVisible();
    const first = page.locator(`${SPELLS} button`).first();
    await expect(first).toBeDisabled();
    await expect(first).toHaveAttribute("title", /Hors portée/);
    const face = await first.evaluate(readSlotFace);
    expect(face.border, "filet creux line-field").toBe("rgb(87, 69, 47)");
    expect(face.face, "planche slot-disabled").toBe("rgb(51, 44, 36)");
  });

  test("sélectionner un sort lançable le peint en or", async ({ page }) => {
    await page.goto("/?demo=combat");
    await expect(page.locator(SPELLS)).toBeVisible();
    const second = page.locator(`${SPELLS} button`).nth(1);
    await page.keyboard.press("2");
    await expect(second).toHaveAttribute("aria-pressed", "true");
    const selected = await second.evaluate(readSlotFace);
    expect(selected.border, "filet or du sort sélectionné").toBe("rgb(212, 165, 55)");
    expect(selected.face, "planche surface-3").toBe("rgb(74, 64, 52)");
  });
});

/* -------------------------------- journal ----------------------------------- */

/** Tous les sorts de `data/` : le journal ne reçoit que leurs noms. */
function spellBook(): Record<string, SpellDef> {
  return Object.fromEntries(spells.map((spell) => [spell.id, spell]));
}

test.describe("journal — teinte et glyphe par élément", () => {
  test("chaque élément a son glyphe, et aucun ne repose sur la couleur seule", () => {
    const lines = [
      "Balthazar lance Épée du Destin : 12 dégâts.",
      "Balthazar lance Lancer de Pièces : 7 dégâts.",
      "Balthazar lance Coup d'Aile Gras : 6 dégâts.",
      "Balthazar lance Pression : 9 dégâts.",
      "Vous récupérez 20 PV.",
      "Case bloquée : le héros reste sur place.",
      "Tour 2 : à Balthazar de jouer.",
    ];
    const looks = lines.map((line) => logLook(line, spellBook()));
    expect(looks.map((look) => look.tone)).toEqual(["feu", "eau", "air", "terre", "soin", "echec", "neutre"]);
    expect(new Set(looks.map((look) => look.glyph)).size).toBe(lines.length);
  });
});

test.describe("journal — rendu du dock", () => {
  test("le journal rendu est à 11 px et chaque ligne porte un glyphe", async ({ page }) => {
    await page.goto("/?demo=combat");
    const lines = page.locator(`${JOURNAL} li`);
    await expect(lines.first()).toBeVisible();
    const rows = await lines.evaluateAll(readLogRows);
    for (const row of rows) {
      expect(row.size, "ligne de journal 11 px (§2.5 body)").toBe("11px");
      expect(row.glyph.length, "glyphe d'élément").toBeGreaterThan(0);
    }
  });

  test("la ligne d'ouverture garde l'encre de son locuteur, pas un remplissage", async ({ page }) => {
    await page.goto("/?demo=combat");
    const line = page.locator(`${JOURNAL} li`).first();
    const color = await line.evaluate((node) => getComputedStyle(node).color);
    expect(color, "ligne du joueur en ink-1").toBe("rgb(232, 220, 200)");
  });
});

/** Le dock ne doit jamais passer sous l'arène : le journal reste dans sa colonne. */
test("le journal ne déborde pas de sa zone", async ({ page }) => {
  await page.goto("/?demo=combat");
  const overflow = await page.locator(JOURNAL).evaluate((panel) => {
    const zone = panel.closest('[data-zone="journal"]');
    if (zone === null) return null;
    const outer = zone.getBoundingClientRect();
    const inner = panel.getBoundingClientRect();
    return { dx: Math.round(inner.right - outer.right), dy: Math.round(inner.bottom - outer.bottom) };
  });
  expect(overflow?.dx ?? 1).toBeLessThanOrEqual(2);
  expect(overflow?.dy ?? 1).toBeLessThanOrEqual(2);
});
