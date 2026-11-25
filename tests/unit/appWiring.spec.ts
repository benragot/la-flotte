import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appScreen, shouldStartExploration } from "../../src/ui/appRouting";
import { CombatHud, HeroCreation, InventoryPanel } from "../../src/ui/components";

const APP_PATH = "src/ui/App.tsx";

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("aiguillage de App", () => {
  it("affiche la création sans héros et l'arène dès qu'un héros existe", () => {
    expect(appScreen(false)).toBe("creation");
    expect(appScreen(true)).toBe("arena");
  });

  it("ne démarre l'exploration qu'avec un héros, une session vierge et pas déjà demandée", () => {
    const base = { hasHero: true, isFresh: true, battleOpen: false, requested: false };
    expect(shouldStartExploration({ ...base, hasHero: false })).toBe(false);
    expect(shouldStartExploration({ ...base, isFresh: false })).toBe(false);
    expect(shouldStartExploration({ ...base, requested: true })).toBe(false);
    expect(shouldStartExploration(base)).toBe(true);
  });

  it("ne démarre jamais l'exploration par-dessus une salle de combat ouverte", () => {
    const open = { hasHero: true, isFresh: true, battleOpen: true, requested: false };
    expect(shouldStartExploration(open)).toBe(false);
  });

  it("expose création, inventaire et HUD de combat par le barrel racine", () => {
    expect(typeof HeroCreation).toBe("function");
    expect(typeof InventoryPanel).toBe("function");
    expect(typeof CombatHud).toBe("function");
  });

  it("tente de restaurer la sauvegarde puis branche l'exploration sur le héros", () => {
    const source = readSource(APP_PATH);
    expect(source).toMatch(/useGameBootstrap\(\)/);
    expect(source).toMatch(/loadGame/);
    expect(source).toMatch(/useArenaBootstrap\(hero !== null\)/);
  });

  it("appelle réellement appScreen depuis App, sans if en dur", () => {
    const source = readSource(APP_PATH);
    expect(source).toContain("appScreen(");
    expect(source).not.toContain('if (hero === null) return <CreationScreen />');
  });
});
