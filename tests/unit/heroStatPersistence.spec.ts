import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Hero } from "../../src/engine/createHero";
import type { StorageLike } from "../../src/engine/save";
import { useGameStore } from "../../src/store/useGameStore";

const SAVE_KEY = "la-flotte-hero-stats-slot";
const LEVEL_3_XP = 650;
const LEVEL_4_XP = 1500;

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

/** Récompense de combat minimale : seul `xpGained` (et le butin) est crédité. */
function xpRewards(xpGained: number) {
  return {
    xpGained,
    totalXp: 0,
    level: 1,
    levelUp: { hp: 5, capitalPoints: 5, spellPoints: 1 },
    prospection: 100,
    drops: [],
  };
}

function hero(): Hero {
  const current = useGameStore.getState().hero;
  if (current === null) throw new Error("héros attendu");
  return current;
}

/** Crée le héros puis le fait monter au niveau 3 (deux paliers: +5 puis +5). */
function heroAtLevelThree(): Hero {
  useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
  useGameStore.getState().creditCombatRewards(xpRewards(LEVEL_3_XP));
  return hero();
}

/** Le serveur de dev recharge depuis `window.localStorage` : c'est ce chemin qu'on simule. */
function reloadFrom(storage: StorageLike): void {
  vi.stubGlobal("window", { localStorage: storage });
  useGameStore.getState().resetGame();
  expect(useGameStore.getState().loadGame(storage)).toBe(true);
}

beforeEach(() => {
  useGameStore.getState().resetGame();
  useGameStore.setState({ saveKey: SAVE_KEY });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("R1 — scénario du joueur : investir 10 en Force puis passer niveau 4", () => {
  it("garde les points investis et n'offre que les 5 points du niveau 4", () => {
    const atThree = heroAtLevelThree();
    expect(atThree.level).toBe(3);
    expect(atThree.capitalPoints).toBe(10);

    useGameStore.getState().allocateStat({ stat: "strength", points: 10 });
    expect(hero().strength).toBe(10);
    expect(hero().capitalPoints).toBe(0);

    useGameStore.getState().creditCombatRewards(xpRewards(LEVEL_4_XP - LEVEL_3_XP));
    const atFour = hero();
    expect(atFour.level).toBe(4);
    expect(atFour.strength).toBe(10);
    expect(atFour.capitalPoints).toBe(5);
  });
});

describe("R2 — rechargement : la Force investie ne doit pas revenir en capital", () => {
  it("préserve la Force après une sauvegarde explicite puis un rechargement", () => {
    heroAtLevelThree();
    useGameStore.getState().allocateStat({ stat: "strength", points: 10 });
    const storage = new MemoryStorage();
    expect(useGameStore.getState().saveGame(storage)).toBe(true);

    reloadFrom(storage);
    expect(hero().strength).toBe(10);
    expect(hero().capitalPoints).toBe(0);
  });

  it("persiste l'investissement sans bouton Sauvegarder (rechargement du navigateur)", () => {
    heroAtLevelThree();
    const storage = new MemoryStorage();
    expect(useGameStore.getState().saveGame(storage)).toBe(true);

    vi.stubGlobal("window", { localStorage: storage });
    useGameStore.getState().allocateStat({ stat: "strength", points: 10 });
    expect(hero().strength).toBe(10);

    reloadFrom(storage);
    expect(hero().strength).toBe(10);
    expect(hero().capitalPoints).toBe(0);
  });

  it("ne réécrit rien quand l'investissement est refusé (points insuffisants)", () => {
    heroAtLevelThree();
    const storage = new MemoryStorage();
    vi.stubGlobal("window", { localStorage: storage });
    useGameStore.getState().allocateStat({ stat: "strength", points: 50 });
    expect(storage.getItem(SAVE_KEY)).toBeNull();
  });
});
