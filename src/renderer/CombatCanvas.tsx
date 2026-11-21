import type { ReactElement } from "react";
import { useCombatStore } from "../store/useCombatStore";
import { SCENE_BACKGROUND, combatCanvasSize } from "./combatCanvasConfig";
import { useCombatPointer } from "./useCombatPointer";
import { useCombatScene } from "./useCombatScene";
import { usePixiApp } from "./usePixiApp";

/** Canvas PixiJS v8 de la grille tactique, branché sur le store de combat. */
export function CombatCanvas(): ReactElement {
  const combat = useCombatStore((state) => state.combat);
  const selectedSpellId = useCombatStore((state) => state.selectedSpellId);
  const hoveredCell = useCombatStore((state) => state.hoveredCell);
  const { width, height } = combatCanvasSize(combat);
  const { host, app } = usePixiApp(SCENE_BACKGROUND, width, height);
  useCombatScene({ app, combat, selectedSpellId, hoveredCell });
  useCombatPointer({ app, combat });
  return <div ref={host} />;
}
