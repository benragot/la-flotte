import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { roomMonsters } from "../../src/engine/dungeon";
import type { DungeonRoom } from "../../src/engine/dungeon";
import type { BattleState } from "../../src/engine/multiCombat";
import type { StorageLike } from "../../src/engine/save";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import { closeBattle, closingAction } from "../../src/ui/components/battle/closeBattle";

const PANEL_PATH = "src/ui/components/battle/BattlePanel.tsx";
const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}

function roomOne(): DungeonRoom {
  const dungeon: DungeonDef | undefined = dungeons.find((entry) => entry.id === DUNGEON_ID);
  const room = dungeon?.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

function heroOrThrow() {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros absent");
  return hero;
}

function startRoom(): BattleState {
  useCombatStore.getState().startDungeonRoom({ room: roomOne() });
  const state = useCombatStore.getState().battle;
  if (state === null) throw new Error("battle absent");
  return state;
}

function withHeroHp(state: BattleState, hp: number): BattleState {
  return { ...state, combatants: state.combatants.map((entry) => (entry.side === "player" ? { ...entry, hp } : entry)) };
}

function wonBattle(hp: number): BattleState {
  const wounded = withHeroHp(startRoom(), hp);
  const combatants = wounded.combatants.map((entry) => (entry.side === "enemy" ? { ...entry, hp: 0 } : entry));
  return { ...wounded, combatants };
}

function openBattle(): BattleState {
  return withHeroHp(startRoom(), 20);
}

/** Câblage identique au panneau : `Clore la salle` passe par `closeBattle`. */
function clickClose(battle: BattleState, storage: MemoryStorage): void {
  const store = useCombatStore.getState();
  closeBattle(battle, { settle: () => store.settleDungeonRoom({ storage }), abandon: () => store.endBattle() });
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useCombatStore.setState({ battle: null, combat: null, mode: "exploration", exploration: null });
});

describe("closingAction — victoire ou abandon", () => {
  it("clôt une salle gagnée par un report", () => {
    expect(closingAction(wonBattle(33))).toBe("settle");
  });

  it("clôt une salle encore disputée ou perdue par un simple abandon", () => {
    expect(closingAction(openBattle())).toBe("end");
    const lost = withHeroHp(openBattle(), 0);
    expect(closingAction(lost)).toBe("end");
  });
});

describe("closeBattle — Clore la salle ne jette plus une victoire", () => {
  it("reporte les PV du héros et écrit une sauvegarde sur une salle gagnée", () => {
    const storage = new MemoryStorage();
    const won = wonBattle(33);
    expect(roomMonsters(roomOne()).length).toBeGreaterThan(0);
    useCombatStore.setState({ battle: won });
    const saveKey = useGameStore.getState().saveKey;
    clickClose(won, storage);
    expect(heroOrThrow().hp).toBe(33);
    expect(storage.getItem(saveKey)).not.toBeNull();
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBe(33);
    expect(useCombatStore.getState().battle).toBeNull();
  });

  it("abandonne sans report ni sauvegarde quand la salle n'est pas gagnée", () => {
    const storage = new MemoryStorage();
    const open = openBattle();
    useCombatStore.setState({ battle: open });
    const beforeHp = heroOrThrow().hp;
    const saveKey = useGameStore.getState().saveKey;
    clickClose(open, storage);
    expect(heroOrThrow().hp).toBe(beforeHp);
    expect(storage.getItem(saveKey)).toBeNull();
    expect(useCombatStore.getState().battle).toBeNull();
  });

  it("branche Clore la salle sur closeBattle, jamais sur endBattle seul", () => {
    const source = readFileSync(join(process.cwd(), PANEL_PATH), "utf8");
    expect(source).toContain("closeBattle(");
    expect(source).toContain("settleDungeonRoom");
    expect(source).not.toMatch(/onClose=\{?handlers?\.?(endBattle|abandon)/);
  });
});
