import { useState } from "react";
import type { Hero } from "../../engine/createHero";
import { useCombatStore } from "../../store/useCombatStore";
import { GAME_CATALOG, useGameStore } from "../../store/useGameStore";
import type { ClassDef } from "../../schemas/classSchema";
import type { EffectiveHp } from "../hudHp";
import { useEffectiveHp } from "../useEffectiveHp";
import { StatAllocation } from "./hero";
import HeroVitalsLine from "./HeroVitalsLine";
import { InventoryPanel } from "./inventory";
import { DungeonEntryPanel, DungeonNotice } from "./dungeon";
import { SECTION_HEADING } from "./hudTheme";

/** Panneaux superposés accessibles depuis l'arène en exploration. */
type PanelId = "inventory" | "hero" | "dungeon";

const ACCESS_BAR = "pointer-events-auto absolute right-2 top-2 z-30 flex gap-2";
const ACCESS_BUTTON =
  "rounded border border-[#8c6d46] bg-[#2b241d]/90 px-2 py-1 text-xs text-[#e8dcc8] transition hover:bg-[#d4a537] hover:text-[#2b241d]";
const LAYER =
  "pointer-events-auto absolute inset-0 z-40 flex items-center justify-center overflow-auto bg-[#2b241d]/70 p-4";
const SHEET =
  "flex max-h-full w-full max-w-xl flex-col gap-2 overflow-auto rounded border-2 border-[#8c6d46] bg-[#2b241d] p-3 text-[#e8dcc8]";

interface AccessButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

function AccessButton({ label, onClick, disabled = false }: AccessButtonProps) {
  const text = disabled ? `${label} — combat en cours` : label;
  return (
    <button type="button" onClick={onClick} className={ACCESS_BUTTON} disabled={disabled}>
      {text}
    </button>
  );
}

/** Un 1v1 ou une salle ouverte bloque l'entrée : les deux HUD ne cohabitent pas. */
function useLiveCombat(): boolean {
  const combat = useCombatStore((state) => state.combat);
  const battle = useCombatStore((state) => state.battle);
  return combat !== null || battle !== null;
}

function AccessBar({ onOpen }: { onOpen: (panel: PanelId) => void }) {
  const blocked = useLiveCombat();
  return (
    <div className={ACCESS_BAR}>
      <AccessButton label="Inventaire" onClick={() => onOpen("inventory")} />
      <AccessButton label="Fiche perso" onClick={() => onOpen("hero")} />
      <AccessButton label="Donjons" onClick={() => onOpen("dungeon")} disabled={blocked} />
    </div>
  );
}

function PanelClose({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className={ACCESS_BUTTON}>
      Fermer
    </button>
  );
}

function SheetHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <header className="flex items-center justify-between">
      <h2 className={SECTION_HEADING}>{title}</h2>
      <PanelClose onClose={onClose} />
    </header>
  );
}

function classDefOf(classId: string): ClassDef | undefined {
  return GAME_CATALOG.classes.find((entry) => entry.id === classId);
}

function HeroSheetBody({ hero, classDef, hp }: { hero: Hero; classDef: ClassDef; hp: EffectiveHp }) {
  return (
    <>
      <HeroVitalsLine hp={hp} className="text-xs" />
      <StatAllocation hero={hero} classDef={classDef} />
    </>
  );
}

function sheetBody(hero: Hero, classDef: ClassDef | undefined, hp: EffectiveHp | null) {
  if (classDef === undefined || hp === null) return null;
  return <HeroSheetBody hero={hero} classDef={classDef} hp={hp} />;
}

function heroTitle(hero: Hero): string {
  return `${hero.name} · niveau ${hero.level}`;
}

/** Fiche perso : identité, PV effectifs et les six caractéristiques avec le capital restant. */
function HeroSheet({ hero, onClose }: { hero: Hero; onClose: () => void }) {
  const hp = useEffectiveHp();
  const classDef = classDefOf(hero.classId);
  return (
    <section aria-label="Fiche du héros" className={SHEET}>
      <SheetHead title={heroTitle(hero)} onClose={onClose} />
      {sheetBody(hero, classDef, hp)}
    </section>
  );
}

function PanelContent({ active, onClose }: { active: PanelId; onClose: () => void }) {
  const hero = useGameStore((state) => state.hero);
  if (active === "inventory") return <InventoryPanel onClose={onClose} />;
  if (active === "dungeon") return <DungeonEntryPanel onClose={onClose} />;
  return hero === null ? null : <HeroSheet hero={hero} onClose={onClose} />;
}

/** Ouvre un panneau ; l'entrée de donjon purge sa notice périmée avant affichage. */
function usePanelOpener(setActive: (panel: PanelId) => void) {
  const clearNotice = useCombatStore((state) => state.clearDungeonNotice);
  return (panel: PanelId) => {
    if (panel === "dungeon") clearNotice();
    setActive(panel);
  };
}

function Overlay({ active, onClose }: { active: PanelId | null; onClose: () => void }) {
  if (active === null) return null;
  return (
    <div className={LAYER}>
      <PanelContent active={active} onClose={onClose} />
    </div>
  );
}

/** Région `aria-live` + panneau éventuel : la couche toujours montée hors barre d'accès. */
function OverlayLayers({ active, onClose }: { active: PanelId | null; onClose: () => void }) {
  return (
    <>
      <DungeonNotice />
      <Overlay active={active} onClose={onClose} />
    </>
  );
}

/** Boutons d'accès discrets + panneaux fermables, posés au-dessus de l'arène. */
export default function OverlayPanels() {
  const [active, setActive] = useState<PanelId | null>(null);
  const open = usePanelOpener(setActive);
  return (
    <>
      <AccessBar onOpen={open} />
      <OverlayLayers active={active} onClose={() => setActive(null)} />
    </>
  );
}
