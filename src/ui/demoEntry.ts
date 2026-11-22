import { useEffect, useRef } from "react";
import dungeonsYaml from "../../data/dungeons.yaml";
import type { DungeonRoom } from "../engine/dungeon";
import { dungeonsFileSchema } from "../schemas/dungeonSchema";
import { useCombatStore } from "../store/useCombatStore";

/** Entrées de démo reconnues par le paramètre d'URL `?demo=…`. */
export type DemoEntry = "combat" | "dungeon";

const DEMO_PARAM = "demo";

/** Garde mutable d'un démarrage unique (équivalent structurel de `useRef`). */
interface OnceGuard {
  current: boolean;
}

interface DemoActions {
  startDemoCombat: () => void;
  startDungeonRoom: (input: { room: DungeonRoom }) => void;
}

/**
 * Point d'entrée de TEST : le canvas n'offre aucun clic déterministe, donc la
 * mise en page du combat n'était pas testable. `isDev` vient de
 * `import.meta.env.DEV`, remplacé par `false` au build : en production le
 * paramètre est inerte, aucune branche de démo ne s'exécute.
 */
export function demoEntryFrom(search: string, isDev: boolean): DemoEntry | null {
  if (!isDev) return null;
  const demo = new URLSearchParams(search).get(DEMO_PARAM);
  if (demo === "combat" || demo === "dungeon") return demo;
  return null;
}

/** Salle 1 du premier donjon de `data/dungeons.yaml` : aucune clé requise en démo. */
function firstRoom(): DungeonRoom {
  const [dungeon] = dungeonsFileSchema.parse(dungeonsYaml).dungeons;
  const room = dungeon?.rooms[0];
  if (room === undefined) throw new Error("data/dungeons.yaml ne déclare aucune salle");
  return room;
}

function startEntry(entry: DemoEntry | null, actions: DemoActions): void {
  if (entry === "combat") actions.startDemoCombat();
  if (entry === "dungeon") actions.startDungeonRoom({ room: firstRoom() });
}

function runEntryOnce(guard: OnceGuard, actions: DemoActions): void {
  if (guard.current) return;
  guard.current = true;
  startEntry(demoEntryFrom(window.location.search, import.meta.env.DEV), actions);
}

/** Branche le point d'entrée de démo au montage, une seule fois (StrictMode). */
export function useDemoEntry(): void {
  const requested = useRef(false);
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  const startDungeonRoom = useCombatStore((state) => state.startDungeonRoom);
  useEffect(() => {
    runEntryOnce(requested, { startDemoCombat, startDungeonRoom });
  }, [startDemoCombat, startDungeonRoom]);
}
