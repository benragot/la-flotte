import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { EscapeRegistry } from "../../src/ui/escapeStack";
import { createEscapeRegistry, handleEscapeKey, isEscapeKey } from "../../src/ui/escapeStack";

/**
 * Échap est réclamé par deux comportements : fermer l'interface ouverte, sinon
 * annuler le sort sélectionné. La pile tranche : **un seul** panneau se ferme
 * par appui, le plus interne, et l'événement n'atteint l'écouteur global de
 * `window` que si aucun panneau n'était ouvert.
 */
interface Probe {
  key: string;
  stopped: boolean;
  stopPropagation: () => void;
}

/** Événement minimal : le module ne touche que `key` et `stopPropagation`. */
function probe(key: string): Probe {
  const event: Probe = { key, stopped: false, stopPropagation: () => undefined };
  event.stopPropagation = () => {
    event.stopped = true;
  };
  return event;
}

function asKeyboardEvent(event: Probe): KeyboardEvent {
  return event as unknown as KeyboardEvent;
}

interface Fixture {
  registry: EscapeRegistry;
  closed: string[];
}

/** Un panneau se désinscrit en se fermant : c'est son démontage React. */
function registerClosing(registry: EscapeRegistry, name: string, closed: string[]): void {
  const dispose = registry.push(() => {
    closed.push(name);
    dispose();
  });
}

function registryWith(names: readonly string[]): Fixture {
  const registry = createEscapeRegistry();
  const closed: string[] = [];
  for (const name of names) registerClosing(registry, name, closed);
  return { registry, closed };
}

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("isEscapeKey", () => {
  it("ne reconnaît que la touche Échap", () => {
    expect(isEscapeKey(asKeyboardEvent(probe("Escape")))).toBe(true);
    expect(isEscapeKey(asKeyboardEvent(probe("a")))).toBe(false);
  });
});

describe("pile des panneaux — le plus interne d'abord", () => {
  it("ne referme qu'un niveau par appui, du dernier ouvert au premier", () => {
    const { registry, closed } = registryWith(["inventaire", "détail objet"]);
    expect(registry.closeTop()).toBe(true);
    expect(closed).toEqual(["détail objet"]);
    expect(registry.closeTop()).toBe(true);
    expect(closed).toEqual(["détail objet", "inventaire"]);
  });

  it("signale une pile vide sans rien fermer", () => {
    const { registry, closed } = registryWith([]);
    expect(registry.closeTop()).toBe(false);
    expect(closed).toEqual([]);
  });

  it("garde l'ordre quand un panneau du milieu se démonte", () => {
    const registry = createEscapeRegistry();
    const closed: string[] = [];
    const names = ["inventaire", "détail objet", "confirmation"];
    const disposers = names.map((name) => registry.push(() => closed.push(name)));
    disposers[1]?.();
    expect(registry.count()).toBe(2);
    registry.closeTop();
    expect(closed).toEqual(["confirmation"]);
  });
});

describe("priorité — le panneau passe avant l'annulation du sort", () => {
  it("consomme Échap quand un panneau est ouvert", () => {
    const { registry, closed } = registryWith(["inventaire"]);
    const event = probe("Escape");
    expect(handleEscapeKey(asKeyboardEvent(event), registry)).toBe(true);
    expect(closed).toEqual(["inventaire"]);
    expect(event.stopped).toBe(true);
  });

  it("laisse filer Échap vers l'écouteur global quand rien n'est ouvert", () => {
    const { registry } = registryWith([]);
    const event = probe("Escape");
    expect(handleEscapeKey(asKeyboardEvent(event), registry)).toBe(false);
    expect(event.stopped).toBe(false);
  });

  it("ignore les autres touches, même avec un panneau ouvert", () => {
    const { registry, closed } = registryWith(["inventaire"]);
    const event = probe("Space");
    expect(handleEscapeKey(asKeyboardEvent(event), registry)).toBe(false);
    expect(closed).toEqual([]);
    expect(event.stopped).toBe(false);
  });
});

describe("câblage — chaque interface ouvrable écoute Échap", () => {
  it("pose l'écouteur unique dans App et le hook dans chaque panneau", () => {
    expect(readSource("src/ui/App.tsx")).toContain("useEscapeLayer()");
    const panels = [
      "src/ui/components/OverlayPanels.tsx",
      "src/ui/components/inventory/ItemDetailPanel.tsx",
      "src/ui/components/spellbook/SpellbookPanel.tsx",
      "src/ui/components/battle/BattlePanel.tsx",
      "src/ui/components/NewGameButton.tsx",
    ];
    for (const panel of panels) expect(readSource(panel)).toContain("useEscapeClose(");
  });
});
