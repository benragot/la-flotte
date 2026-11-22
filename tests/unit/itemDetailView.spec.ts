import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { StatField } from "../../src/engine/inventory";
import type { EquipmentDef, ItemDef } from "../../src/schemas/itemSchema";
import { itemStatsSchema, parseItemsYaml } from "../../src/schemas/itemSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import { GAME_CATALOG, useGameStore } from "../../src/store/useGameStore";
import { STAT_LABELS, buildSlotViews } from "../../src/ui/inventoryHudHelpers";
import { BagRow } from "../../src/ui/components/inventory/BackpackList";
import { SlotTile } from "../../src/ui/components/inventory/EquipmentSlots";
import ItemDetailPanel, { ItemDetailBody } from "../../src/ui/components/inventory/ItemDetailPanel";
import {
  itemDetailView,
  type ItemDetailContext,
  type ItemDetailView,
} from "../../src/ui/components/inventory/itemDetailView";
import { nextSelection, selectionAfterKey } from "../../src/ui/components/inventory/itemSelection";

/**
 * Outillage du dépôt : pas de jsdom ni de @testing-library. Le modèle de vue
 * est testé en node pur, l'UI par `react-dom/server`, et les affordances
 * d'une tuile pure sont déclenchées en appelant directement le composant
 * (aucun hook dedans) puis les `onClick` de l'arbre retourné.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const items: ItemDef[] = parseItemsYaml(read("items.yaml"));
const sets = parseSetsYaml(read("sets.yaml"));
const CONTEXT: ItemDetailContext = { sets };
const STAT_KEYS = Object.keys(itemStatsSchema.shape);

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

describe("itemStatsSchema — énumération clé par clé", () => {
  it("donne un libellé lisible à chaque statistique du schéma", () => {
    const labels = STAT_LABELS as Record<string, string | undefined>;
    expect(STAT_KEYS.filter((key) => labels[key] === undefined)).toEqual([]);
  });

  function showsStat(key: string): boolean {
    const base = mustFindEquipment("cape_graisseuse");
    const item = { ...base, stats: { [key]: 5 } } as ItemDef;
    const view = itemDetailView(item, CONTEXT);
    return [...view.rows, ...view.resistances].some((row) => row.key === key && row.label === STAT_LABELS[key as StatField]);
  }

  it("affiche chaque statistique du schéma avec son libellé", () => {
    expect(STAT_KEYS.filter((key) => !showsStat(key))).toEqual([]);
  });

  it("couvre les treize clés de stats connues", () => {
    expect(STAT_KEYS).toHaveLength(13);
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
  it("marque le bouton avec aria-pressed, sans rôle option imbriqué", () => {
    const entry = { itemId: "plume_mazoutee", name: "Plume mazoutée", quantity: 2, category: "resource" as const };
    const html = renderToStaticMarkup(createElement(BagRow, { entry, selected: true, onSelect: () => undefined }));
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('role="option"');
    expect(html).toContain("<button");
  });
});

/** Élément portant un `onClick` : assez pour déclencher une affordance sans DOM. */
type Clickable = ReactElement<{ children?: ReactNode; onClick?: () => void; "aria-label"?: string }>;

/** Déplie aussi les composants purs (aucun hook dans la tuile) pour atteindre les boutons. */
function collectClickables(node: ReactNode, out: Clickable[] = []): Clickable[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectClickables(child, out));
    return out;
  }
  if (typeof node !== "object" || node === null) return out;
  const element = node as Clickable & { type?: unknown };
  if (typeof element.type === "function") {
    const render = element.type as (props: unknown) => ReactNode;
    return collectClickables(render(element.props), out);
  }
  if (typeof element.props.onClick === "function") out.push(element);
  return collectClickables(element.props.children, out);
}

function equippedHatInventory() {
  return { stacks: [], equipment: { hat: "chapeau_piou_mazoute" } };
}

function hatTile(props: { onSelect: (itemId: string) => void; onUnequip: () => void; selected?: boolean }) {
  useGameStore.setState({ inventory: equippedHatInventory() });
  const views = buildSlotViews({ inventory: useGameStore.getState().inventory, items: GAME_CATALOG.items });
  const hat = views.find((view) => view.slot === "hat");
  if (hat === undefined) throw new Error("slot hat absent");
  const tile = SlotTile({ view: hat, itemId: "chapeau_piou_mazoute", selected: props.selected ?? false, ...props });
  return collectClickables(tile);
}

function findAction(actions: readonly Clickable[], prefix: string): Clickable {
  const found = actions.find((action) => action.props["aria-label"]?.startsWith(prefix));
  if (found === undefined) throw new Error(`affordance « ${prefix} » absente`);
  return found;
}

describe("objet équipé — inspecter sans retirer", () => {
  it("« Détails » sélectionne le slot sans déséquiper et laisse l'inventaire intact", () => {
    const onSelect = vi.fn();
    const onUnequip = vi.fn();
    const actions = hatTile({ onSelect, onUnequip, selected: true });
    findAction(actions, "Détails").props.onClick?.();
    expect(onSelect).toHaveBeenCalledWith("chapeau_piou_mazoute");
    expect(onUnequip).not.toHaveBeenCalled();
    expect(useGameStore.getState().inventory).toEqual(equippedHatInventory());
    expect(findAction(actions, "Détails").props["aria-label"]).toBe("Détails de Chapeau du Piou Mazouté");
  });

  it("la croix de déséquipement reste une action distincte", () => {
    const onSelect = vi.fn();
    const onUnequip = vi.fn();
    const actions = hatTile({ onSelect, onUnequip });
    findAction(actions, "Déséquiper").props.onClick?.();
    expect(onUnequip).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

});

describe("objet équipé — déséquiper reste possible", () => {
  it("le déséquipement explicite rend toujours l'objet au sac", () => {
    useGameStore.setState({ inventory: equippedHatInventory() });
    useGameStore.getState().unequip({ slot: "hat" });
    const inventory = useGameStore.getState().inventory;
    expect(inventory.equipment.hat).toBeUndefined();
    expect(inventory.stacks).toEqual([{ itemId: "chapeau_piou_mazoute", quantity: 1 }]);
  });

  it("la fiche d'un objet porté est remplie et l'équipement inchangé", () => {
    useGameStore.setState({ inventory: equippedHatInventory() });
    const html = renderToStaticMarkup(
      createElement(ItemDetailPanel, { itemId: "chapeau_piou_mazoute", onClear: () => undefined }),
    );
    expect(html).toContain("Vitalité");
    expect(html).toContain("+5");
    expect(useGameStore.getState().inventory).toEqual(equippedHatInventory());
  });
});

/**
 * Exceptions explicites : `starting` est un marqueur interne de kit, pas une
 * caractéristique. `stats` n'est pas muté en bloc : chaque clé de
 * `itemStatsSchema` est couverte une par une ci-dessus.
 */
const KEY_EXCEPTIONS = new Set(["starting"]);
const AGGREGATE_KEYS = new Set(["stats"]);
type Mutation = (item: ItemDef) => ItemDef;

/** Une mutation par clé de haut niveau présente dans les données. */
const KEY_MUTATIONS: Record<string, Mutation> = {
  id: (item) => ({ ...item, id: "objet_mute" }),
  name: (item) => ({ ...item, name: "Nom muté" }),
  description: (item) => ({ ...item, description: "Description mutée" }),
  category: (item) => ({ ...item, category: "key", targetDungeonId: "donjon_mute" }),
  sellPrice: (item) => ({ ...item, sellPrice: 999 }),
  slot: (item) => ({ ...item, slot: "belt" }),
  level: (item) => ({ ...item, level: 99 }),
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
      .filter((key) => !KEY_EXCEPTIONS.has(key) && !AGGREGATE_KEYS.has(key))
      .filter((key) => ignoresKey(item, key))
      .map((key) => `${item.id}.${key}`);
  }

  it("tout champ présent dans les données est affiché ou explicitement exempté", () => {
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
