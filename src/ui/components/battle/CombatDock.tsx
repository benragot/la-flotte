import type { ReactNode } from "react";
import type { CombatState } from "../../../engine/combatLoop/types";
import CombatLogPanel from "../CombatLogPanel";
import SpellSlots from "../SpellSlots";
import TurnButton from "../TurnButton";
import Vitals from "../Vitals";
import { COMBAT_DOCK, DOCK_JOURNAL, DOCK_SPELLS, DOCK_TURN, DOCK_VITALS } from "./battleTheme";
import type { CombatZoneId } from "./layout";

export interface CombatDockProps {
  combat: CombatState;
  selectedSpellId: string | null;
}

interface DockBlockSpec {
  zone: CombatZoneId;
  className: string;
  body: ReactNode;
}

/** Le dock est déclaré comme une table : une ligne = une zone de `layout.ts`. */
function dockBlocks({ combat, selectedSpellId }: CombatDockProps): readonly DockBlockSpec[] {
  return [
    { zone: "journal", className: DOCK_JOURNAL, body: <CombatLogPanel log={combat.log} playerName={combat.player.name} /> },
    { zone: "vitals", className: DOCK_VITALS, body: <Vitals combat={combat} /> },
    { zone: "turn", className: DOCK_TURN, body: <TurnButton phase={combat.phase} /> },
    { zone: "spells", className: DOCK_SPELLS, body: <SpellSlots combat={combat} selectedSpellId={selectedSpellId} /> },
  ];
}

function DockBlock({ zone, className, body }: DockBlockSpec) {
  return <div data-zone={zone} className={className}>{body}</div>;
}

/** Quatre colonnes exclusives : journal, vitals, action de tour, sorts. */
export function CombatDock(props: CombatDockProps) {
  const blocks = dockBlocks(props);
  return <div className={COMBAT_DOCK}>{blocks.map((block) => <DockBlock key={block.zone} {...block} />)}</div>;
}
