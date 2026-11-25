import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DungeonRoom } from "../../src/engine/dungeon";
import { shouldRenderBattle } from "../../src/renderer/battleViewModel";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import type { CombatStore } from "../../src/store/useCombatStore";
import { shouldStartExploration } from "../../src/ui/appRouting";
import { demoEntryFrom } from "../../src/ui/demoEntry";

/** Salle 1 du premier donjon : la même que `demoEntry` ouvre sous `?demo=dungeon`. */
function firstRoom(): DungeonRoom {
  const dungeons = parseDungeonsYaml(readFileSync(join(process.cwd(), "data", "dungeons.yaml"), "utf8"));
  const room = dungeons[0]?.rooms[0];
  if (room === undefined) throw new Error("data/dungeons.yaml ne déclare aucune salle");
  return room;
}

/** Même calcul que `useArenaBootstrap` : la session n'a ni combat ni exploration. */
function isFresh(state: CombatStore): boolean {
  return state.combat === null && state.exploration === null;
}

/** Garde du bootstrap, recopié de `App` : `shouldStartExploration` reste la source. */
function bootstrapAllows(state: CombatStore): boolean {
  return shouldStartExploration({
    hasHero: true,
    isFresh: isFresh(state),
    battleOpen: state.battle !== null,
    requested: false,
  });
}

describe("demoEntryFrom", () => {
  it("ignore totalement le paramètre en production", () => {
    expect(demoEntryFrom("?demo=combat", false)).toBeNull();
    expect(demoEntryFrom("?demo=dungeon", false)).toBeNull();
  });

  it("reconnaît les deux entrées de démo en dev", () => {
    expect(demoEntryFrom("?demo=combat", true)).toBe("combat");
    expect(demoEntryFrom("?demo=dungeon", true)).toBe("dungeon");
  });

  it("ignore un paramètre absent ou inconnu", () => {
    expect(demoEntryFrom("", true)).toBeNull();
    expect(demoEntryFrom("?demo=autre", true)).toBeNull();
  });
});

/**
 * Ordre réel de `App` : `useDemoEntry()` s'exécute avant `useArenaBootstrap`.
 * La salle de démo est donc publiée **avant** le bootstrap d'exploration ; un
 * re-render ne doit jamais appeler `startExploration` par-dessus une salle
 * ouverte, sinon `?demo=dungeon` n'affiche plus `BattlePanel`.
 */
describe("?demo=dungeon — le bootstrap ne referme pas une salle ouverte", () => {
  it("garde le battle par identité quand la salle de démo est déjà publiée", () => {
    useCombatStore.getState().resetCombat();
    useCombatStore.getState().startDungeonRoom({ room: firstRoom() });
    const battle = useCombatStore.getState().battle;
    if (bootstrapAllows(useCombatStore.getState())) useCombatStore.getState().startExploration(() => 0.2);
    expect(useCombatStore.getState().battle).toBe(battle);
    expect(shouldRenderBattle(useCombatStore.getState().battle)).toBe(true);
  });

  it("lance l'exploration quand la session est réellement neuve", () => {
    useCombatStore.getState().resetCombat();
    expect(bootstrapAllows(useCombatStore.getState())).toBe(true);
    useCombatStore.getState().startExploration(() => 0.2);
    expect(useCombatStore.getState().exploration).not.toBeNull();
    expect(useCombatStore.getState().battle).toBeNull();
  });
});
