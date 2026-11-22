import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EquipmentDef, ItemDef } from "../../src/schemas/itemSchema";
import { parseItemsYaml } from "../../src/schemas/itemSchema";
import type { SetDef } from "../../src/schemas/setSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { BagRow } from "../../src/ui/components/inventory/BackpackList";
import ItemDetailPanel, { ItemDetailBody } from "../../src/ui/components/inventory/ItemDetailPanel";
import {
  itemDetailView,
  type ItemDetailContext,
  type ItemDetailView,
} from "../../src/ui/components/inventory/itemDetailView";
import { nextSelection, selectionAfterKey } from "../../src/ui/components/inventory/itemSelection";

/**
 * Outillage du dépôt : pas de jsdom ni de @testing-library. Le modèle de vue
 * est testé en node pur, l'UI par `react-dom/server` et le câblage clavier
 * par lecture de source (même convention que `battlePanel.spec.ts`).
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const items: ItemDef[] = parseItemsYaml(read("items.yaml"));
const sets: SetDef[] = parseSetsYaml(read("sets.yaml"));
const CONTEXT: ItemDetailContext = { sets };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function mustFindEquipment(id: string): EquipmentDef {
  const item = mustFind(items, id);
  if (item.category !== "equipment") throw new Error(`${id} n'est pas un équipement`);
  return item;
}

function viewOf(id: string): ItemDetailView {
  return itemDetailView(mustFind(items, id), CONTEXT);
}

function bodyHtml(view: ItemDetailView): string {
  return renderToStaticMarkup(createElement(ItemDetailBody, { view }));
}

describe("itemDetailView — équipement", () => {
  it("expose nom, catégorie, emplacement, niveau, panoplie, prix et description", () => {
    const view = viewOf("cape_graisseuse");
    expect(view).toMatchObject({
      id: "cape_graisseuse",
      title: "Cape graisseuse",
      category: "Équipement",
      slot: "Cape",
      level: 2,
      sellPrice: 20,
      buyPrice: null,
      set: { name: "Panoplie du Piou Mazouté", pieces: 4 },
    });
    expect(view.description).toContain("Imperméable");
  });

  it("libelle chaque stat avec un signe et dans l'ordre des données", () => {
    expect(viewOf("cape_graisseuse").rows).toEqual([
      { key: "vitality", label: "Vitalité", value: "+10" },
      { key: "wisdom", label: "Sagesse", value: "+2" },
    ]);
  });

});

describe("itemDetailView — résistances", () => {
  it("sépare résistances plates et pourcentages, négatifs compris", () => {
    const base = mustFindEquipment("cape_graisseuse");
    const cursed: ItemDef = { ...base, stats: { ...base.stats, flatRes: 10, percentRes: -10 } };
    const view = itemDetailView(cursed, CONTEXT);
    expect(view.resistances).toEqual([
      { key: "flatRes", label: "Résistance", value: "+10" },
      { key: "percentRes", label: "% Résistance", value: "-10" },
    ]);
    expect(view.rows.some((row) => row.key === "flatRes")).toBe(false);
  });

  it("affiche -10 et jamais 10 pour une résistance négative", () => {
    const base = mustFindEquipment("cape_graisseuse");
    const cursed: ItemDef = { ...base, stats: { flatRes: -10 } };
    expect(itemDetailView(cursed, CONTEXT).resistances[0]?.value).toBe("-10");
  });
});

describe("itemDetailView — ressource, consommable et clef", () => {
  it("ne fabrique aucune section pour une ressource", () => {
    const view = viewOf("plume_mazoutee");
    expect(view).toMatchObject({ category: "Ressource", slot: null, level: null, set: null, buyPrice: null });
    expect(view.rows).toEqual([]);
    expect(view.resistances).toEqual([]);
    expect(view.effects).toEqual([]);
  });

  it("décrit le soin et le prix d'achat d'un consommable", () => {
    const view = viewOf("soupe_de_baleine_tiede");
    expect(view).toMatchObject({ category: "Consommable", buyPrice: 15, sellPrice: 5 });
    expect(view.effects).toEqual([{ key: "heal", label: "Soin", value: "+20 PV" }]);
    expect(view.resistances).toEqual([]);
  });

  it("nomme le donjon visé par une clef", () => {
    const view = viewOf("cle_donjon_ile_de_la_ferraille");
    expect(view.category).toBe("Clé");
    expect(view.effects).toEqual([
      { key: "targetDungeonId", label: "Donjon ciblé", value: "fer_donjon_casse_vis_sans_fin" },
    ]);
  });
});

describe("ItemDetailBody — rendu sans section vide", () => {
  it("n'affiche ni résistances ni panoplie pour une ressource", () => {
    const html = bodyHtml(viewOf("plume_mazoutee"));
    expect(html).toContain("Plume mazoutée");
    expect(html).toContain("Prix de vente");
    expect(html).not.toContain("Résistance");
    expect(html).not.toContain("Panoplie");
    expect(html).not.toContain("Caractéristiques");
  });

  it("affiche panoplie, caractéristiques et résistances pour un équipement", () => {
    const html = bodyHtml(viewOf("cape_graisseuse"));
    expect(html).toContain("Panoplie du Piou Mazouté");
    expect(html).toContain("4 pièces");
    expect(html).toContain("Vitalité");
    expect(html).toContain("+10");
  });
});

describe("ItemDetailPanel — état sans sélection", () => {
  it("invite à sélectionner et ne rend aucune fiche", () => {
    const html = renderToStaticMarkup(createElement(ItemDetailPanel, { itemId: null, onClear: () => undefined }));
    expect(html).toContain("Détail de l’objet");
    expect(html).toContain("Sélectionne un objet pour voir ses caractéristiques");
    expect(html).not.toContain("Prix de vente");
  });

  it("annonce la fiche ouverte via une région live nommée", () => {
    const html = renderToStaticMarkup(
      createElement(ItemDetailPanel, { itemId: "cape_graisseuse", onClear: () => undefined }),
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Cape graisseuse");
    expect(html).toContain("Fermer le détail");
  });
});

describe("sélection", () => {
  it("sélectionne au premier clic puis désélectionne au re-clic", () => {
    const first = nextSelection(null, { type: "toggle", itemId: "plume_mazoutee" });
    expect(first).toBe("plume_mazoutee");
    expect(nextSelection(first, { type: "toggle", itemId: "plume_mazoutee" })).toBeNull();
  });

  it("change de sélection quand on clique un autre objet", () => {
    expect(nextSelection("plume_mazoutee", { type: "toggle", itemId: "ecrou_maudit" })).toBe("ecrou_maudit");
  });

  it("ferme sur Échap et ignore les autres touches", () => {
    expect(selectionAfterKey("plume_mazoutee", "Escape")).toBeNull();
    expect(selectionAfterKey("plume_mazoutee", "a")).toBe("plume_mazoutee");
  });

});

describe("rendu de la ligne sélectionnée", () => {
  it("marque la ligne avec aria-selected et un bouton focusable", () => {
    const entry = { itemId: "plume_mazoutee", name: "Plume mazoutée", quantity: 2, category: "resource" as const };
    const html = renderToStaticMarkup(createElement(BagRow, { entry, selected: true, onSelect: () => undefined }));
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("<button");
  });
});

/** Exceptions explicites : `starting` est un marqueur interne de kit, pas une caractéristique. */
const KEY_EXCEPTIONS = new Set(["starting"]);
type Mutation = (item: ItemDef) => ItemDef;

/** Une mutation par clé de `itemSchema` : si le modèle l'ignore, la vue ne bouge pas. */
const KEY_MUTATIONS: Record<string, Mutation> = {
  id: (item) => ({ ...item, id: "objet_mute" }),
  name: (item) => ({ ...item, name: "Nom muté" }),
  description: (item) => ({ ...item, description: "Description mutée" }),
  category: (item) => ({ ...item, category: "key", targetDungeonId: "donjon_mute" }),
  sellPrice: (item) => ({ ...item, sellPrice: 999 }),
  slot: (item) => ({ ...item, slot: "belt" }),
  level: (item) => ({ ...item, level: 99 }),
  stats: (item) => ({ ...item, stats: { strength: 7 } }),
  setId: (item) => ({ ...item, setId: undefined }),
  heal: (item) => ({ ...item, heal: 999 }),
  price: (item) => ({ ...item, price: 999 }),
  targetDungeonId: (item) => ({ ...item, targetDungeonId: "donjon_mute" }),
};

function ignoresKey(item: ItemDef, key: string): boolean {
  const mutate = KEY_MUTATIONS[key];
  if (mutate === undefined) throw new Error(`aucune mutation déclarée pour ${key}`);
  const before = JSON.stringify(itemDetailView(item, CONTEXT));
  return JSON.stringify(itemDetailView(mutate(item) as ItemDef, CONTEXT)) === before;
}

describe("exhaustivité du modèle de vue", () => {
  function ignoredKeys(item: ItemDef): string[] {
    return Object.keys(item)
      .filter((key) => !KEY_EXCEPTIONS.has(key))
      .filter((key) => ignoresKey(item, key))
      .map((key) => `${item.id}.${key}`);
  }

  it("ne laisse aucun champ d'item hors du modèle (sauf exceptions documentées)", () => {
    expect(items.flatMap(ignoredKeys)).toEqual([]);
  });

  it("ne mute jamais l'item reçu", () => {
    const item = mustFind(items, "cape_graisseuse");
    const snapshot = structuredClone(item);
    itemDetailView(item, CONTEXT);
    expect(item).toEqual(snapshot);
  });
});

describe("câblage clavier du panneau", () => {
  it("gère Échap et monte le détail en bas de l'inventaire", () => {
    const source = readFileSync(join(process.cwd(), "src/ui/components/inventory/InventoryPanel.tsx"), "utf8");
    expect(source).toContain("onKeyDown");
    expect(source).toContain("selectionAfterKey");
    expect(source).toContain("ItemDetailPanel");
  });
});
