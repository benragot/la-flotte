import { describe, expect, it } from "vitest";
import { buildExplorationViewModel } from "../../src/renderer/explorationScene";

/**
 * Capture regardée : au-dessus du crabe, le nom est tronqué (`L..o`) au lieu de
 * s'afficher en entier. Le modèle de scène doit porter le nom complet, sans
 * `slice` ni largeur maximale : c'est la couche d'affichage qui gère la place.
 */
const VIEWPORT = { width: 1024, height: 768 };
const CRAB_NAME = "Crabe à Clé-à-Molette";
const CRAB_LABEL = `${CRAB_NAME} · Niv. 3`;

function groupToken(extra: { spriteId?: string } = {}) {
  const exploration = {
    playerPos: { x: 1, y: 1 },
    groups: [{ pos: { x: 3, y: 4 }, label: CRAB_LABEL, totalLevel: 3, ...extra }],
  };
  const token = buildExplorationViewModel({ exploration, viewport: VIEWPORT }).tokens[1];
  if (token === undefined) throw new Error("jeton du groupe absent");
  return token;
}

describe("nom des monstres — aucune troncature dans le modèle de scène", () => {
  it("expose le nom entier, au-delà de l'ancienne limite d'affichage", () => {
    expect(groupToken().name).toBe(CRAB_NAME);
  });

  it("garde le nom complet même quand le groupe porte sa feuille de sprite", () => {
    expect(groupToken({ spriteId: "fer_crabe_cle_molette" }).name).toBe(CRAB_NAME);
  });
});
