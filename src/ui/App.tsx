import { useEffect, useRef } from "react";
import { CombatCanvas } from "../renderer";
import { useCombatStore } from "../store/useCombatStore";
import { CombatHud } from "./components";

/**
 * Démarre le combat de démonstration une seule fois : le garde couvre le double
 * effet de `StrictMode` et un remontage de `App` conserve le combat en cours.
 */
function useBootstrapCombat(): void {
  const startDemoCombat = useCombatStore((state) => state.startDemoCombat);
  const hasCombat = useCombatStore((state) => state.combat !== null);
  const requested = useRef(false);
  useEffect(() => {
    if (requested.current || hasCombat) return;
    requested.current = true;
    startDemoCombat();
  }, [hasCombat, startDemoCombat]);
}

function ArenaStage() {
  return (
    <div
      aria-label="Terrain de combat"
      className="flex h-full w-full items-center justify-center bg-slate-950"
    >
      <CombatCanvas />
    </div>
  );
}

export default function App() {
  useBootstrapCombat();
  return (
    <div className="relative h-full w-full overflow-hidden">
      <ArenaStage />
      <CombatHud />
    </div>
  );
}
