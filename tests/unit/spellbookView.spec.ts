import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SpellDef } from "../../src/schemas/spellSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { SpellDetailBody } from "../../src/ui/components/spellbook/SpellbookPanel";
import { heroSpells, spellDetail } from "../../src/ui/components/spellbook/spellbookView";
import type { SpellDetailView } from "../../src/ui/components/spellbook/spellbookView";
import { isEscapeKey } from "../../src/ui/useEscapeClose";

/**
 * Le grimoire est un **affichage** : tout ce qu'il montre vient de
 * `data/spells.yaml`, et ce qui n'y est pas reste `undefined` — jamais un `0`
 * ni un `-` inventé pour combler un champ absent.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const spells: readonly SpellDef[] = parseSpellsYaml(read("spells.yaml"));

function mustFind(id: string): SpellDef {
  const found = spells.find((spell) => spell.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/spells.yaml`);
  return found;
}

function viewOf(id: string): SpellDetailView {
  return spellDetail(mustFind(id));
}

function bodyHtml(id: string): string {
  return renderToStaticMarkup(createElement(SpellDetailBody, { view: viewOf(id) }));
}

function rowKeys(view: SpellDetailView): string[] {
  return view.rows.map((row) => row.key);
}

describe("spellDetail — champs réellement présents", () => {
  it("expose coût, élément, dégâts, portée et ligne de vue de Pression", () => {
    expect(viewOf("pression")).toMatchObject({
      id: "pression",
      name: "Pression",
      kind: "Dégâts",
      apCost: 3,
      element: "Terre",
      damage: "8–12",
      range: "1–2 PO",
      requiresLos: true,
    });
    expect(viewOf("pression").description).toContain("coup de pression");
  });

  it("laisse undefined tout champ que la donnée ne porte pas (Bond)", () => {
    const view = viewOf("bond");
    expect(view).toMatchObject({
      kind: "Téléportation",
      damage: undefined,
      cooldown: undefined,
      castsPerTurn: undefined,
      castsPerTarget: undefined,
      pushCells: undefined,
      effect: undefined,
    });
    expect(rowKeys(view)).not.toContain("damage");
    expect(rowKeys(view)).not.toContain("cooldown");
  });
});

describe("spellDetail — limites et effets", () => {
  it("affiche recharge, quotas et poussée quand la donnée les déclare", () => {
    expect(viewOf("fer_spell_coup_daile_gras")).toMatchObject({
      element: "Air",
      damage: "4–6",
      cooldown: 1,
      castsPerTurn: 1,
      castsPerTarget: 1,
      pushCells: 1,
    });
  });

  it("décrit un effet utilitaire sans lui inventer des dégâts", () => {
    const view = viewOf("glyphe_agressif");
    expect(view.damage).toBeUndefined();
    expect(view.effect).toBe("Glyphe · 1–3 · 3 tours");
  });

  it("traduit l'état requis au lieu de laisser l'identifiant brut", () => {
    expect(viewOf("gueule_de_bois").requiresState).toBe("Ivre");
  });
});

describe("spellDetail — rendu de la fiche", () => {
  it("n'affiche jamais « Recharge : 0 » pour un sort sans recharge", () => {
    expect(bodyHtml("pression")).not.toContain("Recharge");
    expect(bodyHtml("fer_spell_coup_daile_gras")).toContain("Recharge");
  });

  it("rend nom, coût PA, élément, dégâts et portée", () => {
    const html = bodyHtml("pression");
    for (const expected of ["Pression", "3 PA", "Terre", "8–12", "1–2 PO"]) {
      expect(html).toContain(expected);
    }
  });
});

describe("spellDetail — en-tête lisible", () => {
  it("nomme le coût : « Dégâts · 3 PA » ne doit plus être produit", () => {
    const html = bodyHtml("pression");
    expect(html).not.toContain("Dégâts · 3 PA");
    expect(html).toContain("Coût 3 PA");
  });

  it("n'affiche jamais l'identifiant technique du sort", () => {
    expect(bodyHtml("epee_du_destin")).not.toContain("epee_du_destin");
  });
});

describe("heroSpells — les sorts appris, pas le fichier entier", () => {
  it("ne retient que les sorts de la classe du héros", () => {
    const learned = heroSpells({ spells, classId: "iop" });
    expect(learned.map((spell) => spell.id)).toEqual(["pression", "bond", "epee_du_destin"]);
    expect(learned.some((spell) => spell.classId === "monster")).toBe(false);
  });

  it("suit la liste du combat quand elle est fournie, dans son ordre", () => {
    const learned = heroSpells({ spells, classId: "iop", learnedIds: ["epee_du_destin", "pression"] });
    expect(learned.map((spell) => spell.id)).toEqual(["epee_du_destin", "pression"]);
  });

  it("ignore un identifiant appris inconnu du YAML au lieu de le fabriquer", () => {
    const learned = heroSpells({ spells, classId: "iop", learnedIds: ["sort_fantome", "bond"] });
    expect(learned.map((spell) => spell.id)).toEqual(["bond"]);
  });

  it("renvoie une liste vide pour une classe sans sort déclaré", () => {
    expect(heroSpells({ spells, classId: "classe_inconnue" })).toEqual([]);
  });
});

describe("isEscapeKey — la touche déjà réservée par le HUD", () => {
  it("reconnaît Échap et laisse les autres touches aux raccourcis", () => {
    expect(isEscapeKey({ key: "Escape" } as KeyboardEvent)).toBe(true);
    expect(isEscapeKey({ key: "a" } as KeyboardEvent)).toBe(false);
  });
});
