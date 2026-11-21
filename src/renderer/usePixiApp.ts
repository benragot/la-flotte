import { Application } from "pixi.js";
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface PixiAppOptions {
  background: number;
  width: number;
  height: number;
}

export interface PixiAppHandle {
  host: RefObject<HTMLDivElement>;
  app: Application | null;
}

interface MountState {
  app: Application | null;
  cancelled: boolean;
}

interface MountContext {
  host: HTMLDivElement;
  options: PixiAppOptions;
  isCancelled: () => boolean;
  onReady: (app: Application) => void;
}

interface LifecycleOptions extends PixiAppOptions {
  host: RefObject<HTMLDivElement>;
  setApp: (app: Application | null) => void;
}

interface LifecycleInput extends LifecycleOptions {
  state: MountState;
}

/** Libère une application PixiJS v8, y compris son canvas DOM. */
export function destroyApp(app: Application | null): void {
  if (app === null) return;
  app.destroy(true, { children: true });
}

async function initApp(options: PixiAppOptions): Promise<Application> {
  const app = new Application();
  await app.init({
    background: options.background,
    width: options.width,
    height: options.height,
    antialias: true,
  });
  return app;
}

async function mountApp(context: MountContext): Promise<void> {
  const app = await initApp(context.options);
  if (context.isCancelled()) {
    destroyApp(app);
    return;
  }
  context.host.appendChild(app.canvas);
  context.onReady(app);
}

function startLifecycle(input: LifecycleInput): void {
  const element = input.host.current;
  if (element === null) return;
  const options = { background: input.background, width: input.width, height: input.height };
  const onReady = (app: Application) => attachApp(input.state, app, input.setApp);
  void mountApp({ host: element, options, isCancelled: () => input.state.cancelled, onReady });
}

function attachApp(state: MountState, app: Application, setApp: (app: Application | null) => void): void {
  state.app = app;
  setApp(app);
}

function stopLifecycle(state: MountState, setApp: (app: Application | null) => void): void {
  state.cancelled = true;
  destroyApp(state.app);
  state.app = null;
  setApp(null);
}

function usePixiEffect(input: LifecycleOptions): void {
  const { host, background, width, height, setApp } = input;
  useEffect(() => {
    const state: MountState = { app: null, cancelled: false };
    startLifecycle({ host, background, width, height, setApp, state });
    return () => stopLifecycle(state, setApp);
  }, [host, background, width, height, setApp]);
}

/** Monte une application PixiJS v8 dans un `div` hôte, nettoyée au démontage. */
export function usePixiApp(background: number, width: number, height: number): PixiAppHandle {
  const host = useRef<HTMLDivElement>(null);
  const [app, setApp] = useState<Application | null>(null);
  usePixiEffect({ host, background, width, height, setApp });
  return { host, app };
}
