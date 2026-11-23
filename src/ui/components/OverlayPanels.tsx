import { useState } from "react";
import type { ReactNode } from "react";
import type { Hero } from "../../engine/createHero";
import { useCombatStore } from "../../store/useCombatStore";
import { GAME_CATALOG, useGameStore } from "../../store/useGameStore";
import type { ClassDef } from "../../schemas/classSchema";
import type { EffectiveHp } from "../hudHp";
import { useEffectiveHp } from "../useEffectiveHp";
import { useEscapeClose } from "../useEscapeClose";
import { StatAllocation } from "./hero";
import { HERO_SHEET, HERO_SHEET_TITLE } from "./hero/heroTheme";
import HeroVitalsLine from "./HeroVitalsLine";
import { InventoryPanel } from "./inventory";
import { DungeonEntryPanel, DungeonNotice } from "./dungeon";
import NewGameButton from "./NewGameButton";
import SpellbookPanel from "./spellbook/SpellbookPanel";
import { OVERLAY_HEAD, LAYER_SCRIM } from "./overlayTheme";
import { CHROME_BUTTON } from "./hudTheme";

/** Panneaux superposés accessibles depuis l'arène en exploration. */
type PanelId = "inventory" | "hero" | "dungeon" | "spells";

const ACCESS_BAR = "pointer-events-auto absolute right-2 top-2 z-30 flex gap-2";
const ACCESS_BUTTON = CHROME_BUTTON;
const LAYER = LAYER_SCRIM;
const SHEET = HERO_SHEET;
/** Ligne de PV de la fiche : monospace tabulaire, encre de PV (§1.5) — le `❤` reste. */
const HERO_VITALS = "font-mono text-[13px] font-bold leading-4 tabular-nums text-[var(--color-ink-danger)]";

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

interface PanelButtonsProps {
  onOpen: (panel: PanelId) => void;
  blocked: boolean;
}

function PanelButtons({ onOpen, blocked }: PanelButtonsProps) {
  return (
    <>
      <AccessButton label="Inventaire" onClick={() => onOpen("inventory")} />
      <AccessButton label="Fiche perso" onClick={() => onOpen("hero")} />
      <AccessButton label="Sorts" onClick={() => onOpen("spells")} />
      <AccessButton label="Donjons" onClick={() => onOpen("dungeon")} disabled={blocked} />
    </>
  );
}

function AccessBar({ onOpen }: { onOpen: (panel: PanelId) => void }) {
  const blocked = useLiveCombat();
  return (
    <div className={ACCESS_BAR}>
      <PanelButtons onOpen={onOpen} blocked={blocked} />
      <NewGameButton />
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
    <header className={OVERLAY_HEAD}>
      <h2 className={HERO_SHEET_TITLE}>{title}</h2>
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
      <HeroVitalsLine hp={hp} className={HERO_VITALS} />
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
export function HeroSheet({ hero, onClose }: { hero: Hero; onClose: () => void }) {
  const hp = useEffectiveHp();
  const classDef = classDefOf(hero.classId);
  return (
    <section aria-label="Fiche du héros" className={SHEET}>
      <SheetHead title={heroTitle(hero)} onClose={onClose} />
      {sheetBody(hero, classDef, hp)}
    </section>
  );
}

/** Panneaux sans données : une fabrique par identifiant, aucune cascade de `if`. */
const PANEL_BODIES: Record<Exclude<PanelId, "hero">, (onClose: () => void) => ReactNode> = {
  inventory: (onClose) => <InventoryPanel onClose={onClose} />,
  dungeon: (onClose) => <DungeonEntryPanel onClose={onClose} />,
  spells: (onClose) => <SpellbookPanel onClose={onClose} />,
};

function PanelContent({ active, onClose }: { active: PanelId; onClose: () => void }) {
  const hero = useGameStore((state) => state.hero);
  if (active === "hero") return hero === null ? null : <HeroSheet hero={hero} onClose={onClose} />;
  return PANEL_BODIES[active](onClose);
}

/** Ouvre un panneau ; l'entrée de donjon purge sa notice périmée avant affichage. */
function usePanelOpener(setActive: (panel: PanelId) => void) {
  const clearNotice = useCombatStore((state) => state.clearDungeonNotice);
  return (panel: PanelId) => {
    if (panel === "dungeon") clearNotice();
    setActive(panel);
  };
}

interface ActivePanel {
  active: PanelId | null;
  open: (panel: PanelId) => void;
  close: () => void;
}

/**
 * Panneau affiché et ses deux portes : le bouton « Fermer » et Échap. Le
 * panneau est le **parent** de la pile : un détail monté après lui passe
 * devant, et Échap referme donc le détail avant le panneau.
 */
function useActivePanel(): ActivePanel {
  const [active, setActive] = useState<PanelId | null>(null);
  const open = usePanelOpener(setActive);
  const close = () => setActive(null);
  useEscapeClose(close, active !== null);
  return { active, open, close };
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
  const { active, open, close } = useActivePanel();
  return (
    <>
      <AccessBar onOpen={open} />
      <OverlayLayers active={active} onClose={close} />
    </>
  );
}
