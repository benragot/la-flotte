import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { DevHeroPayload } from "../../src/dev/devHero";
import type { DevHeroOptions, DevHeroSink } from "../../src/dev/devHeroBridge";
import { bootstrapDevHero, installDevHero, parseDevHeroParam } from "../../src/dev/devHeroBridge";

interface RecordingSink {
  sink: DevHeroSink;
  installed: DevHeroPayload[];
  saves: () => number;
}

function recordingSink(): RecordingSink {
  const installed: DevHeroPayload[] = [];
  let saved = 0;
  const sink: DevHeroSink = {
    install: (payload) => {
      installed.push(payload);
    },
    save: () => {
      saved += 1;
      return true;
    },
  };
  return { sink, installed, saves: () => saved };
}

function fakeWindow(): Window {
  return {} as Window;
}

const DEV = "development";

describe("installDevHero", () => {
  it("écrit le héros dans le store et appelle saveGame en développement", () => {
    const { sink, installed, saves } = recordingSink();
    const hero = installDevHero({}, { mode: DEV, sink });
    expect(hero?.level).toBe(20);
    expect(hero?.strength).toBe(500);
    expect(installed).toHaveLength(1);
    expect(installed[0]?.hero.strength).toBe(500);
    expect(saves()).toBe(1);
  });

  it("transmet les options (niveau, force) au héros installé", () => {
    const { sink, installed } = recordingSink();
    const hero = installDevHero({ level: 30, strength: 400 }, { mode: DEV, sink });
    expect(hero?.level).toBe(30);
    expect(hero?.strength).toBe(400);
    expect(installed[0]?.hero.level).toBe(30);
  });

  it("ne touche à rien hors mode development", () => {
    const { sink, installed, saves } = recordingSink();
    expect(installDevHero({}, { mode: "test", sink })).toBeNull();
    expect(installDevHero({}, { mode: "production", sink })).toBeNull();
    expect(installed).toEqual([]);
    expect(saves()).toBe(0);
  });

  it("reste inerte sous Vitest quand les dépendances ne sont pas injectées", () => {
    expect(installDevHero()).toBeNull();
  });
});

describe("parseDevHeroParam", () => {
  it("lit `?dev-hero=niveau-force`", () => {
    expect(parseDevHeroParam("?dev-hero=20-500")).toEqual({ level: 20, strength: 500 });
  });

  it("ignore un paramètre absent ou mal formé", () => {
    const searches = ["", "?autre=1", "?dev-hero", "?dev-hero=20", "?dev-hero=20-500-9", "?dev-hero=0-500"];
    for (const search of searches) expect(parseDevHeroParam(search)).toBeNull();
  });
});

describe("bootstrapDevHero", () => {
  it("n'expose jamais `window.__flotteDev` hors développement", () => {
    const host = fakeWindow();
    expect(bootstrapDevHero({ mode: "test", search: "?dev-hero=20-500", window: host })).toBeNull();
    expect(host.__flotteDev).toBeUndefined();
  });

  it("expose la console dev et installe le héros demandé par l'URL", () => {
    const host = fakeWindow();
    const calls: DevHeroOptions[] = [];
    const install = (options: DevHeroOptions = {}) => {
      calls.push(options);
      return null;
    };
    bootstrapDevHero({ mode: DEV, search: "?dev-hero=30-400", window: host, install });
    expect(typeof host.__flotteDev?.createHero).toBe("function");
    expect(calls).toEqual([{ level: 30, strength: 400 }]);
  });

  it("expose la console dev même sans paramètre d'URL", () => {
    const host = fakeWindow();
    const calls: DevHeroOptions[] = [];
    const install = (options: DevHeroOptions = {}) => {
      calls.push(options);
      return null;
    };
    bootstrapDevHero({ mode: DEV, search: "", window: host, install });
    expect(typeof host.__flotteDev?.createHero).toBe("function");
    expect(calls).toEqual([]);
  });
});

describe("branchement de src/main.tsx", () => {
  it("appelle bootstrapDevHero, gardé par le mode développement", () => {
    const source = readFileSync(join(process.cwd(), "src/main.tsx"), "utf8");
    expect(source).toContain("bootstrapDevHero()");
    expect(source).toMatch(/import\.meta\.env\.MODE === "development"/);
  });
});
