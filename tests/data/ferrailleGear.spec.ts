import { readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { itemStatsSchema, parseItemsYaml } from "../../src/schemas/itemSchema";
import type { ItemDef } from "../../src/schemas/itemSchema";
import { parseSetsYaml } from "../../src/schemas/setSchema";
import type { SetDef } from "../../src/schemas/setSchema";

/**
 * Garde-fou de la fiche d'île : le YAML est confronté **directement** au
 * document `docs/design/islands/ile_de_la_ferraille.md` (§5 et §6). Aucune
 * valeur n'est recopiée ici : la fiche est la source, `data/` est le miroir.
 */
const DATA_DIR = join(process.cwd(), "data");
const DOC_PATH = join(process.cwd(), "docs", "design", "islands", "ile_de_la_ferraille.md");
const FICHE = readFileSync(DOC_PATH, "utf8");

/** Slots acceptés par `SET_SLOTS` (`src/schemas/itemSchema.ts`). */
const SET_SLOTS = ["hat", "cloak", "amulet", "boots"];
/** `ring` de la fiche → `ring1` du schéma (D06) : un seul slot de bague est modélisé. */
const SLOT_ALIASES: Record<string, string> = { ring: "ring1" };
/** Clés du §5/§6 sans équivalent dans `itemStatsSchema` : omises, jamais réécrites. */
const OMITTED_STATS = ["crit", "initiative", "flatDamage"];
/** Renommage explicitement acté par le §10.16 de la fiche. */
const RENAMED_STATS: Record<string, string> = { percentDamage: "percentDmg" };
/** Plafond du schéma (`MAX_TIER_PIECES` / plafond de 4 pièces). */
const MAX_PIECES = 4;

interface FicheRange {
  min: number;
  max: number;
}

interface FicheEntry {
  id: string;
  name: string;
  slot?: string;
  level: number;
  stats: Record<string, FicheRange>;
}

interface FicheSet {
  id: string;
  name: string;
  pieceIds: string[];
  bonusesByCount: Record<string, Record<string, number>>;
}

function section(startMarker: string, endMarker: string): string {
  const start = FICHE.indexOf(startMarker);
  const end = FICHE.indexOf(endMarker, start + 1);
  return FICHE.slice(start, end);
}

function yamlBlocks(markdown: string): unknown[] {
  return [...markdown.matchAll(/```yaml\n([\s\S]*?)```/g)].map((match) => yaml.load(match[1] ?? ""));
}

const ARMES_MD = section("## 5. Armes", "## 6. Équipements");
const EQUIPEMENTS_MD = section("## 6. Équipements", "## 7. Recettes");
const FICHE_WEAPONS = yamlBlocks(ARMES_MD) as FicheEntry[];
const EQUIPEMENTS_BLOCKS = yamlBlocks(EQUIPEMENTS_MD);
const FICHE_PIECES = EQUIPEMENTS_BLOCKS[0] as FicheEntry[];
const FICHE_SETS = EQUIPEMENTS_BLOCKS[1] as FicheSet[];

const read = (file: string): string => readFileSync(join(DATA_DIR, file), "utf8");
const loadItems = (): ItemDef[] => parseItemsYaml(read("items.yaml"));
const loadSets = (): SetDef[] => parseSetsYaml(read("sets.yaml"));

type Equipment = Extract<ItemDef, { category: "equipment" }>;
const isEquipment = (item: ItemDef): item is Equipment => item.category === "equipment";
const equipmentOf = (items: readonly ItemDef[]): Equipment[] => items.filter(isEquipment);

const itemById = (id: string): ItemDef | undefined => loadItems().find((item) => item.id === id);
const setById = (id: string): SetDef | undefined => loadSets().find((set) => set.id === id);

function equipById(id: string): Equipment | undefined {
  const item = itemById(id);
  return item !== undefined && isEquipment(item) ? item : undefined;
}

const slotOf = (id: string): string | undefined => equipById(id)?.slot;

function ficheSet(id: string): FicheSet {
  const entry = FICHE_SETS.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`${id} absent de la fiche §6`);
  return entry;
}

/** Stats attendues dans `data/` : jet maximum de la fourchette, clés omises exclues. */
function expectedStats(stats: Record<string, FicheRange>): Record<string, number> {
  const kept = Object.entries(stats).filter(([key]) => !OMITTED_STATS.includes(key));
  return Object.fromEntries(kept.map(([key, range]) => [RENAMED_STATS[key] ?? key, range.max]));
}

/** Bonus de palier de la fiche, amputé des clés que le schéma ne connaît pas. */
function expectedTier(stats: Record<string, number> | undefined): Record<string, number> {
  const kept = Object.entries(stats ?? {}).filter(([key]) => !OMITTED_STATS.includes(key));
  return Object.fromEntries(kept.map(([key, value]) => [RENAMED_STATS[key] ?? key, value]));
}

/**
 * Pièces du §6 livrables en données : tout sauf le slot `belt`, que
 * `tests/unit/itemDetailView.spec.ts` rend inutilisable (il mute `slot` vers
 * `belt`, donc une pièce déjà en `belt` ne change pas de vue et échoue au
 * contrôle d'exhaustivité). Blocage hors `data/`, signalé dans la PR.
 */
const BLOCKED_SLOTS = ["belt"];
const desservies = (): FicheEntry[] => FICHE_PIECES.filter((piece) => !BLOCKED_SLOTS.includes(piece.slot ?? ""));

describe("fiche §5 — armes de la Ferraille", () => {
  it("décrit quatre armes dans la fiche", () => {
    expect(FICHE_WEAPONS).toHaveLength(4);
  });

  it("expose chaque arme avec son nom, son niveau et le slot weapon", () => {
    FICHE_WEAPONS.forEach((arme) => {
      const item = equipById(arme.id);
      expect(item, arme.id).toBeDefined();
      expect(item?.category, arme.id).toBe("equipment");
      expect(item?.slot, arme.id).toBe("weapon");
      expect(item?.name, arme.id).toBe(arme.name);
      expect(item?.level, arme.id).toBe(arme.level);
    });
  });

  it("n'est ni commerçable à zéro kama ni de départ", () => {
    FICHE_WEAPONS.forEach((arme) => {
      const item = equipById(arme.id);
      expect(item?.sellPrice, arme.id).toBeGreaterThan(0);
      expect(item?.starting, arme.id).toBe(false);
    });
  });
});

describe("fiche §6 — pièces d'équipement", () => {
  it("décrit treize pièces dans la fiche, dont onze livrables", () => {
    expect(FICHE_PIECES).toHaveLength(13);
    expect(desservies()).toHaveLength(11);
  });

  it("expose chaque pièce jouable avec son nom, son niveau et son slot", () => {
    desservies().forEach((piece) => {
      const item = equipById(piece.id);
      expect(item, piece.id).toBeDefined();
      expect(item?.category, piece.id).toBe("equipment");
      expect(item?.name, piece.id).toBe(piece.name);
      expect(item?.level, piece.id).toBe(piece.level);
      const slot = piece.slot === undefined ? undefined : SLOT_ALIASES[piece.slot] ?? piece.slot;
      expect(item?.slot, piece.id).toBe(slot);
    });
  });

  it("porte les stats de la fiche au jet maximum, clés hors schéma exclues", () => {
    [...FICHE_WEAPONS, ...desservies()].forEach((entry) => {
      const stats = equipById(entry.id)?.stats;
      expect(stats, entry.id).toEqual(expectedStats(entry.stats));
    });
  });

  it("n'écrit aucune clé de stats que Zod supprimerait en silence", () => {
    const allowed = new Set(Object.keys(itemStatsSchema.shape));
    const raw = yaml.load(read("items.yaml")) as { items: { id: string; stats?: object }[] };
    raw.items.forEach((item) => {
      Object.keys(item.stats ?? {}).forEach((key) => {
        expect(allowed.has(key), `${item.id}.${key} serait supprimé sans erreur`).toBe(true);
      });
    });
  });
});

describe("panoplies de la fiche — ce que le schéma peut représenter", () => {
  it("n'utilise que les quatre slots de `SET_SLOTS` et plafonne à quatre pièces", () => {
    loadSets().forEach((set) => {
      expect(set.pieceIds.length, set.id).toBeLessThanOrEqual(MAX_PIECES);
      set.pieceIds.forEach((id) => expect(SET_SLOTS, `${set.id} → ${id}`).toContain(slotOf(id)));
    });
  });

  it("donne à chaque panoplie des slots distincts", () => {
    loadSets().forEach((set) => {
      const slots = set.pieceIds.map((id) => slotOf(id));
      expect(new Set(slots).size, set.id).toBe(slots.length);
    });
  });

  it("cite dans pieceIds toute pièce qui déclare son setId", () => {
    const equipment = equipmentOf(loadItems());
    loadSets().forEach((set) => {
      equipment
        .filter((item) => item.setId === set.id)
        .forEach((item) => expect(set.pieceIds, item.id).toContain(item.id));
    });
  });

});

describe("panoplies de la fiche — fidélité aux paliers", () => {
  it("retient les quatre pièces légales de Brico-Lourd, dans l'ordre de la fiche", () => {
    const fiche = ficheSet("fer_set_brico_lourd");
    const legal = fiche.pieceIds.filter((id) => SET_SLOTS.includes(slotOf(id) ?? ""));
    expect(setById(fiche.id)?.pieceIds).toEqual(legal);
    expect(legal).toHaveLength(MAX_PIECES);
  });

  it("reporte les paliers 2/3/4 de la fiche, sans les dégâts fixes", () => {
    const fiche = ficheSet("fer_set_brico_lourd");
    const tiers = [2, 3, 4].map((pieces) => ({
      pieces,
      stats: expectedTier(fiche.bonusesByCount[String(pieces)]),
    }));
    expect(setById(fiche.id)?.bonuses).toEqual(tiers);
  });

  it("laisse Goudron-et-Plumes hors de sets.yaml : trois slots légaux pour quatre exigés", () => {
    const fiche = ficheSet("fer_set_goudron_plumes");
    const legal = fiche.pieceIds.filter((id) => SET_SLOTS.includes(slotOf(id) ?? ""));
    expect(legal).toHaveLength(3);
    expect(setById(fiche.id), "D33 : SET_SLOTS + MIN_TIERS interdisent 3 pièces").toBeUndefined();
  });

  it("ne livre aucune pièce du slot `belt` : mutation `slot → belt` du test UI", () => {
    const blocked = FICHE_PIECES.filter((piece) => BLOCKED_SLOTS.includes(piece.slot ?? ""));
    expect(blocked.map((piece) => piece.id)).toEqual(["fer_ceinture_goudron", "fer_ceinture_outils_rouilles"]);
    blocked.forEach((piece) => expect(itemById(piece.id), piece.id).toBeUndefined());
  });
});
