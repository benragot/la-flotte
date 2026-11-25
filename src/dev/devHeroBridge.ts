import type { Hero } from "../engine/createHero";
import { useGameStore } from "../store/useGameStore";
import type { DevHeroOptions, DevHeroPayload } from "./devHero";
import { buildDevHero } from "./devHero";

export type { DevHeroOptions, DevHeroPayload };

export interface FlotteDevApi {
  createHero: (options?: DevHeroOptions) => Hero | null;
}

declare global {
  interface Window {
    __flotteDev?: FlotteDevApi;
  }
}

/** Point d'écriture injectable : les tests branchent un faux store. */
export interface DevHeroSink {
  install: (payload: DevHeroPayload) => void;
  save: () => boolean;
}

export interface InstallDevHeroDeps {
  mode: string;
  sink: DevHeroSink;
}

export interface DevHeroBootstrapDeps {
  mode: string;
  search: string;
  window: Window;
  install?: (options?: DevHeroOptions) => Hero | null;
}

const DEV_MODE = "development";
const DEV_HERO_PARAM = "dev-hero";
const DEV_PARAM_PATTERN = /^(\d+)-(\d+)$/;

/** Un héros absent du store impose de déclarer le personnage avant la sauvegarde. */
function installInStore(payload: DevHeroPayload): void {
  const store = useGameStore.getState();
  if (store.hero === null) store.createCharacter({ name: payload.hero.name, classId: payload.hero.classId });
  useGameStore.setState({ hero: payload.hero, inventory: payload.inventory });
}

function storeSink(): DevHeroSink {
  return { install: installInStore, save: () => useGameStore.getState().saveGame() };
}

function defaultDeps(): InstallDevHeroDeps {
  return { mode: import.meta.env.MODE, sink: storeSink() };
}

type Installer = NonNullable<DevHeroBootstrapDeps["install"]>;

function safeInstall(install: Installer, options: DevHeroOptions): Hero | null {
  try {
    return install(options);
  } catch {
    return null;
  }
}

/** Installe le héros de test et persiste ; inerte hors serveur Vite. */
export function installDevHero(options: DevHeroOptions = {}, deps: Partial<InstallDevHeroDeps> = {}): Hero | null {
  const { mode, sink } = { ...defaultDeps(), ...deps };
  if (mode !== DEV_MODE) return null;
  const payload = buildDevHero(options);
  sink.install(payload);
  sink.save();
  return payload.hero;
}

function isPositiveInt(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function positiveFrom(match: RegExpExecArray): DevHeroOptions | null {
  const level = Number(match[1]);
  const strength = Number(match[2]);
  if (!isPositiveInt(level) || !isPositiveInt(strength)) return null;
  return { level, strength };
}

/** `?dev-hero=20-500` → niveau 20, force 500 ; tout le reste est ignoré. */
export function parseDevHeroParam(search: string): DevHeroOptions | null {
  const raw = new URLSearchParams(search).get(DEV_HERO_PARAM) ?? "";
  const match = DEV_PARAM_PATTERN.exec(raw);
  return match === null ? null : positiveFrom(match);
}

function browserDeps(): DevHeroBootstrapDeps {
  return { mode: import.meta.env.MODE, search: window.location.search, window };
}

function installFromSearch(search: string, install: Installer): Hero | null {
  const param = parseDevHeroParam(search);
  return param === null ? null : safeInstall(install, param);
}

/**
 * Branchement de démarrage : expose `window.__flotteDev.createHero(opts)` et
 * installe le héros demandé par l'URL. `MODE` vaut « test » sous Vitest.
 */
export function bootstrapDevHero(deps: DevHeroBootstrapDeps = browserDeps()): Hero | null {
  if (deps.mode !== DEV_MODE) return null;
  const install = deps.install ?? installDevHero;
  deps.window.__flotteDev = { createHero: install };
  return installFromSearch(deps.search, install);
}
