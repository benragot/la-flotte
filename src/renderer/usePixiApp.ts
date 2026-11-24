import { Application } from "pixi.js";
import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { isApplicationAlive } from "./appLifecycle";
import type { GridSize } from "./gridProjection";
import type { PixiInitOptions } from "./pixiResolution";
import { pixiInitOptions } from "./pixiResolution";
import { resizeRenderer } from "./rendererResize";

export interface PixiAppOptions {
  background: number;
  size: GridSize;
}

export interface PixiAppHandle {
  app: Application | null;
  error: string | null;
}

/** Taille neutre à l'initialisation : l'effet de redimensionnement applique la vraie taille. */
export const INITIAL_CANVAS_SIZE = { width: 1, height: 1 } as const;

export const PIXI_INIT_ERROR = "Canvas indisponible : le rendu PixiJS n'a pas pu démarrer.";

interface MountState {
  app: Application | null;
  cancelled: boolean;
  destroyed: boolean;
}

interface RendererOptions extends PixiInitOptions {
  background: number;
  width: number;
  height: number;
}

interface MountContext {
  host: HTMLDivElement;
  options: RendererOptions;
  state: MountState;
  onReady: (app: Application) => void;
  onError: (message: string) => void;
}

interface LifecycleInput {
  host: RefObject<HTMLDivElement>;
  background: number;
  setApp: (app: Application | null) => void;
  setError: (message: string | null) => void;
}

/** Détruit une application PixiJS v8 une seule fois, sans jamais toucher une app morte. */
export function destroyApp(app: Application | null): void {
  if (!isApplicationAlive(app)) return;
  app.destroy(true, { children: true });
}

async function initApp(options: MountContext["options"]): Promise<Application | null> {
  const app = new Application();
  try {
    await app.init({ ...options, antialias: true, autoStart: false });
    return app;
  } catch (error) {
    console.error("[renderer] initialisation PixiJS impossible", error);
    return null;
  }
}

function reportInitFailure(context: MountContext): void {
  context.onError(PIXI_INIT_ERROR);
}

/** Un montage n'est utilisable que tant qu'il n'a été ni annulé ni détruit. */
function isMountUsable(state: MountState): boolean {
  return !state.cancelled && !state.destroyed;
}

async function mountApp(context: MountContext): Promise<void> {
  const app = await initApp(context.options);
  if (app === null) return reportInitFailure(context);
  if (!isMountUsable(context.state)) return destroyApp(app);
  context.host.appendChild(app.canvas);
  context.onReady(app);
}

function attachApp(state: MountState, app: Application, setApp: (app: Application | null) => void): void {
  state.app = app;
  setApp(app);
}

function startLifecycle(input: LifecycleInput, state: MountState): void {
  const element = input.host.current;
  if (element === null) return;
  const hidpi = pixiInitOptions(window.devicePixelRatio);
  const options = { background: input.background, ...INITIAL_CANVAS_SIZE, ...hidpi };
  const onReady = (app: Application) => attachApp(state, app, input.setApp);
  void mountApp({ host: element, options, state, onReady, onError: input.setError });
}

function stopLifecycle(state: MountState, setApp: (app: Application | null) => void): void {
  state.cancelled = true;
  state.destroyed = true;
  setApp(null);
  destroyApp(state.app);
  state.app = null;
}

function usePixiEffect(input: LifecycleInput): void {
  const { host, background, setApp, setError } = input;
  useEffect(() => {
    const state: MountState = { app: null, cancelled: false, destroyed: false };
    startLifecycle({ host, background, setApp, setError }, state);
    return () => stopLifecycle(state, setApp);
  }, [host, background, setApp, setError]);
}

function usePixiResize(app: Application | null, size: GridSize): void {
  const { width, height } = size;
  useEffect(() => {
    if (app === null) return;
    resizeRenderer(app, { width, height }, window.devicePixelRatio);
  }, [app, width, height]);
}

/** Monte une application PixiJS v8 unique dans `host`, conservée à travers les changements de taille. */
export function usePixiApp(host: RefObject<HTMLDivElement>, options: PixiAppOptions): PixiAppHandle {
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState<string | null>(null);
  usePixiEffect({ host, background: options.background, setApp, setError });
  usePixiResize(app, options.size);
  return { app, error };
}
