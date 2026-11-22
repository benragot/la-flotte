import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initExploration } from "../../src/engine/exploration";
import type { ExplorationState } from "../../src/engine/exploration";
import { parseAsciiMap } from "../../src/engine/grid";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";
import type { ExplorationView } from "../../src/renderer/explorationScene";
import { SPRITE_SHEETS } from "../../src/renderer/spriteManifest";
import { ExplorationJournal, ExplorationStatusOverlay } from "../../src/ui/components/ExplorationOverlay";
import { explorationView } from "../../src/ui/explorationView";
import { isDevOnlyLine, shouldLogMove, visibleExplorationLog } from "../../src/ui/explorationLog";
import { JOURNAL_PANEL, STATUS_OVERLAY } from "../../src/ui/explorationLayout";

/** `P` = héros, `M` = groupe : carte minimale, aucune donnée YAML ici. */
const MAP_ROWS = ["P....", ".....", "..M.."];
const VIEWPORT = { width: 1024, height: 768 };
const SPAWN = { monsterId: "piou_mazoute", monsterName: "Piou Mazouté", level: 1 };

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function state(): ExplorationState {
  return initExploration({ map: parseAsciiMap(MAP_ROWS), ...SPAWN });
}

function viewOf(heroClassId: string | null, exploration: ExplorationState = state()): ExplorationView {
  const view = explorationView({ exploration, heroClassId });
  if (view === undefined) throw new Error("vue d'exploration attendue");
  return view;
}

function tokensOf(heroClassId: string | null) {
  return buildExplorationViewModel({ exploration: viewOf(heroClassId), viewport: VIEWPORT }).tokens;
}

describe("exploration — sprites câblés comme en combat", () => {
  it("référence la feuille du héros et celle du groupe, pas un cercle", () => {
    const tokens = tokensOf("iop");
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.spriteId).toBe("iop");
    expect(tokens[1]?.spriteId).toBe("piou_mazoute");
    tokens.forEach((token) => expect(token.spriteId).not.toBeNull());
  });

  it("porte les mêmes ids dans la vue qu'affiche le renderer", () => {
    const view = viewOf("ecaflip");
    expect(view.heroSpriteId).toBe("ecaflip");
    expect(view.groups[0]?.spriteId).toBe("piou_mazoute");
    expect(SPRITE_SHEETS.length).toBeGreaterThan(0);
  });

  it("ne retombe sur le cercle que pour une entité absente du manifeste", () => {
    const unknown = initExploration({ map: parseAsciiMap(MAP_ROWS), monsterId: "craqueleur", monsterName: "Craqueleur", level: 7 });
    const tokens = buildExplorationViewModel({ exploration: viewOf("classe_inconnue", unknown), viewport: VIEWPORT }).tokens;
    expect(tokens[0]?.spriteId).toBeNull();
    expect(tokens[1]?.spriteId).toBeNull();
  });
});

describe("exploration — aucun aperçu de chemin au survol", () => {
  it("ne produit aucune tuile de chemin dans le modèle de scène", () => {
    const model = buildExplorationViewModel({ exploration: viewOf("iop"), viewport: VIEWPORT });
    expect(model.path).toHaveLength(0);
  });

  it("ne lit plus la case survolée pour tracer un itinéraire", () => {
    expect(readSource("src/ui/explorationView.ts")).not.toContain("hovered");
    expect(readSource("src/ui/useExplorationPointer.ts")).not.toContain("setHoveredCell");
  });
});

describe("exploration — journal ancré à gauche", () => {
  it("rend le journal dans une colonne gauche, jamais dans le dock bas", () => {
    const markup = renderToStaticMarkup(createElement(ExplorationJournal, { lines: ["Le héros arrive sur la carte."] }));
    expect(markup.startsWith("<aside")).toBe(true);
    expect(markup).toContain("aria-label=\"Journal d’exploration\"");
    expect(markup).toContain("border-r-2");
    expect(markup).not.toContain("border-t-2");
  });

  it("déclare un panneau de largeur fixe placé avant l'arène dans App", () => {
    expect(JOURNAL_PANEL).toContain("w-64");
    const source = readSource("src/ui/App.tsx");
    expect(source.indexOf("<ExplorationJournalPanel />")).toBeLessThan(source.indexOf("<ArenaSection"));
  });
});

describe("exploration — bandeau d'état en overlay haut-gauche", () => {
  it("pose le bandeau en absolu au-dessus de la carte", () => {
    const markup = renderToStaticMarkup(createElement(ExplorationStatusOverlay, { mapId: "ferraille_plage_01" }));
    expect(markup).toContain("Mode Exploration — Clique un monstre pour combattre");
    expect(markup).toContain("Carte ferraille_plage_01");
    expect(STATUS_OVERLAY).toContain("absolute");
    expect(STATUS_OVERLAY).toContain("left-2");
    expect(STATUS_OVERLAY).toContain("top-2");
  });

  it("monte le bandeau à l'intérieur de la zone jouable, par-dessus le canvas", () => {
    const source = readSource("src/ui/App.tsx");
    expect(source).toContain("<ExplorationStatus />");
    expect(source).not.toContain("Mode Exploration");
  });
});

describe("exploration — message de déplacement réservé au dev", () => {
  const LOG = ["Le héros arrive sur la carte.", "Le héros se déplace de 8 case(s)."];

  it("ne produit aucun message technique en production", () => {
    expect(shouldLogMove(false)).toBe(false);
    expect(visibleExplorationLog(LOG, false)).toEqual(["Le héros arrive sur la carte."]);
  });

  it("garde le message en développement", () => {
    expect(shouldLogMove(true)).toBe(true);
    expect(visibleExplorationLog(LOG, true)).toEqual(LOG);
  });

  it("ne filtre jamais une ligne de jeu", () => {
    expect(isDevOnlyLine("Un groupe rôde plus loin : Piou Mazouté · Niv. 1 (group-2).")).toBe(false);
    expect(visibleExplorationLog(["Le groupe group-1 est vaincu."], false)).toEqual(["Le groupe group-1 est vaincu."]);
  });
});
