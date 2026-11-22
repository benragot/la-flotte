import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initCombat } from "../../src/engine/combatLoop/init";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap } from "../../src/engine/grid";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { COMBAT_ZONES, DOCK_ORDER, ZONE_IDS, dockViolations, layoutViolations, zonesOf } from "../../src/ui/components/battle/layout";
import type { CombatZoneMap } from "../../src/ui/components/battle/layout";
import { CombatDock } from "../../src/ui/components/battle";
import SpellSlots from "../../src/ui/components/SpellSlots";
import Timeline from "../../src/ui/components/Timeline";

/**
 * Pas de jsdom : la géométrie réelle n'est **pas** mesurable ici
 * (`getBoundingClientRect` renverrait des zéros). On teste donc le contrat de
 * zones (données pures) et la structure du markup rendu par `react-dom/server`.
 */
const readData = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");

const monsters = parseMonstersYaml(readData("monsters.yaml"));
const classes = parseClassesYaml(readData("classes.yaml"));
const maps = parseMapsYaml(readData("maps.yaml"));
const spells = parseSpellsYaml(readData("spells.yaml"));

const RAT_ID = "fer_rat_de_cale";
const RAT_NAME = "Rat d'Égoût-dron";
const RAT_LABEL = "Niv. 6 · 52 / 52 PV";

function ratCombat(): CombatState {
  const monster = monsters.find((entry) => entry.id === RAT_ID);
  const map = maps.find((entry) => entry.id === "ferraille_plage_01");
  const classDef = classes.find((entry) => entry.id === "iop");
  if (monster === undefined || map === undefined || classDef === undefined) throw new Error("donnée absente");
  return initCombat({ map: parseAsciiMap(map.grid), hero: createHero("Balthazar", classDef), monster, spells });
}

/** Retire séparateurs React et entités HTML : on compare du texte lisible. */
function plainText(html: string): string {
  return html
    .replaceAll("<!-- -->", "")
    .replaceAll("&#x27;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function sliceFrom(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`repère absent du markup : ${start}`);
  return html.slice(from, to);
}

function zonesIn(html: string): string[] {
  return [...html.matchAll(/data-zone="([a-z]+)"/g)].map((match) => match[1] ?? "");
}

describe("carte des zones du combat — exclusivité", () => {
  it("place « Passer son tour » hors de la zone des PA/PM", () => {
    expect(zonesOf("endTurn")).toEqual(["turn"]);
    expect(zonesOf("apMp")).toEqual(["vitals"]);
    expect(zonesOf("endTurn")).not.toEqual(zonesOf("apMp"));
  });

  it("donne une zone et une seule à chaque élément visible", () => {
    const declared = ZONE_IDS.flatMap((id) => COMBAT_ZONES[id].elements);
    const unique = new Set(declared);
    expect([...unique].sort()).toEqual([...declared].sort());
    expect(declared.every((element) => zonesOf(element).length === 1)).toBe(true);
  });

  it("ne met jamais un nom de combattant dans la zone des sorts", () => {
    expect(zonesOf("combatantName")).toEqual(["initiative"]);
    expect(zonesOf("combatantVitals")).toEqual(["initiative"]);
    expect(zonesOf("combatantName")).not.toContain("spells");
    expect(COMBAT_ZONES.spells.elements).not.toContain("combatantName");
  });

  it("ne signale aucune violation sur la carte réelle", () => {
    expect(layoutViolations()).toEqual([]);
    expect(dockViolations(DOCK_ORDER)).toEqual([]);
  });

  it("attrape la disposition fautive d'origine (endTurn avec apMp, dock dupliqué)", () => {
    const broken: CombatZoneMap = { ...COMBAT_ZONES, vitals: { area: "dock", elements: ["hp", "apMp", "endTurn"] } };
    expect(layoutViolations(broken)).toContain("endTurn");
    expect(dockViolations(["journal", "vitals", "vitals"])).toContain("vitals");
  });

  it("déclare un dock ordonné sans doublon qui couvre toutes ses zones", () => {
    const dockZones = ZONE_IDS.filter((id) => COMBAT_ZONES[id].area === "dock");
    expect(new Set(DOCK_ORDER).size).toBe(DOCK_ORDER.length);
    expect([...DOCK_ORDER].sort()).toEqual([...dockZones].sort());
  });
});

describe("dock de combat — structure rendue", () => {
  it("rend les quatre blocs du dock dans l'ordre déclaré", () => {
    const html = renderToStaticMarkup(createElement(CombatDock, { combat: ratCombat(), selectedSpellId: null }));
    expect(zonesIn(html)).toEqual([...DOCK_ORDER]);
  });

  it("n'imbrique pas « Passer son tour » dans le bloc des PA/PM", () => {
    const html = plainText(renderToStaticMarkup(createElement(CombatDock, { combat: ratCombat(), selectedSpellId: null })));
    const vitals = sliceFrom(html, 'aria-label="Ressources du héros"', "</section>");
    const turn = sliceFrom(html, 'data-zone="turn"', "</div>");
    expect(vitals).not.toContain("Passer");
    expect(turn).toContain("Passer");
  });

  it("garde les PA/PM rendus dans le bloc de vitals", () => {
    const html = plainText(renderToStaticMarkup(createElement(CombatDock, { combat: ratCombat(), selectedSpellId: null })));
    const vitals = sliceFrom(html, 'aria-label="Ressources du héros"', "</section>");
    expect(vitals).toContain("PA");
    expect(vitals).toContain("PM");
  });
});

describe("bande d'initiative — noms lisibles", () => {
  it("tient le nom et son Niv./PV dans le même conteneur", () => {
    const combat = ratCombat();
    const html = plainText(renderToStaticMarkup(createElement(Timeline, { ...combat, phase: combat.phase })));
    const card = sliceFrom(html, `data-combatant="${RAT_ID}"`, "</article>");
    expect(card).toContain(RAT_NAME);
    expect(card).toContain(RAT_LABEL);
  });

  it("déclare la bande comme sa propre zone, hors dock", () => {
    const combat = ratCombat();
    const html = renderToStaticMarkup(createElement(Timeline, { ...combat, phase: combat.phase }));
    expect(html).toContain('data-zone="initiative"');
    expect(zonesIn(html)).toEqual(["initiative"]);
  });
});

describe("panneau des sorts — pas de nom de combattant", () => {
  it("n'accueille ni le nom du rat ni celui du héros", () => {
    const combat = ratCombat();
    const html = plainText(renderToStaticMarkup(createElement(SpellSlots, { combat, selectedSpellId: null })));
    const panel = sliceFrom(html, 'aria-label="Sorts disponibles"', "</section>");
    expect(panel).not.toContain(RAT_NAME);
    expect(panel).not.toContain("Balthazar");
    expect(panel).toContain("Sorts · touches 1 à 9");
  });
});

describe("assemblage du HUD de combat", () => {
  it("empile bandeau, bande d'initiative puis dock, sans positionnement absolu", () => {
    const source = readFileSync(join(process.cwd(), "src/ui/components/CombatHud.tsx"), "utf8");
    const layout = sliceFrom(source, "function HudLayout(", "function CombatLayout");
    expect(layout.indexOf("<TopBanner")).toBeLessThan(layout.indexOf("<InitiativeZone"));
    expect(layout.indexOf("<InitiativeZone")).toBeLessThan(layout.indexOf("<CombatDock"));
    expect(layout).not.toContain("absolute");
  });
});
