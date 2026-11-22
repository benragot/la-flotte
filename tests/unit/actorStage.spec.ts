import { describe, expect, it } from "vitest";
import type { CombatantLike } from "../../src/engine/multiCombat";
import type { GridSize } from "../../src/renderer/gridProjection";
import { sceneOrigin } from "../../src/renderer/gridProjection";
import { ActorStage } from "../../src/renderer/sprites/actorStage";
import { SPRITE_SHEETS } from "../../src/renderer/spriteManifest";
import type { TokenView } from "../../src/renderer/tokens";
import { combatantTokenView } from "../../src/renderer/tokens";

/**
 * Deux « Piou Mazouté » de la salle 1 partagent la **même feuille** : la couche
 * d'acteurs les indexait par `spriteId`, donc un seul sprite existait pour deux
 * combattants — le second ennemi était invisible sur la carte alors que son
 * panneau et sa barre de PV, eux, existaient.
 */
const VIEWPORT: GridSize = { width: 1024, height: 768 };
const ORIGIN = sceneOrigin({ width: 12, height: 12 }, VIEWPORT);
const PIou = "piou_mazoute";

function sheetOf(entityId: string) {
  const sheet = SPRITE_SHEETS.find((entry) => entry.entityId === entityId);
  if (sheet === undefined) throw new Error(`${entityId} absent du manifeste`);
  return sheet;
}

function combatant(id: string, x: number): CombatantLike {
  const stats = { strength: 1, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
  const zeros = { earth: 0, fire: 0, water: 0, air: 0, neutral: 0 };
  const base = { side: "enemy" as const, name: "Piou Mazouté", level: 1, hp: 35, maxHp: 35, ap: 6 };
  const pools = { maxAp: 6, mp: 3, maxMp: 3 };
  const body = { ...base, ...pools, stats, resistances: { flat: zeros, percent: zeros }, position: { x, y: 0 } };
  return { ...body, id, initiative: 10 };
}

function token(id: string, x: number): TokenView {
  const sprite = { spriteId: PIou, facing: "left" as const, animation: "idle" as const, animationKey: `t-${id}` };
  return combatantTokenView({ combatant: combatant(id, x), sprite, active: false }, ORIGIN);
}

describe("couche d'acteurs — un sprite par combattant", () => {
  it("crée deux acteurs distincts quand deux ennemis partagent la même feuille", () => {
    const stage = new ActorStage([sheetOf(PIou)]);
    stage.sync({ tokens: [token("piou_mazoute-0", 0), token("piou_mazoute-1", 3)], onReady: () => undefined });
    expect(stage.container.children).toHaveLength(2);
  });

  it("donne à chaque acteur la position de son propre jeton", () => {
    const stage = new ActorStage([sheetOf(PIou)]);
    const first = token("piou_mazoute-0", 0);
    const second = token("piou_mazoute-1", 3);
    stage.sync({ tokens: [first, second], onReady: () => undefined });
    const xs = stage.container.children.map((child) => child.position.x);
    expect(xs).toContain(first.center.x);
    expect(xs).toContain(second.center.x);
  });
});
