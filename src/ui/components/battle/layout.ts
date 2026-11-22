/**
 * Carte des zones du HUD de combat 1v1 : la source unique du « qui occupe où ».
 *
 * Règle : un élément visible appartient à **exactement une** zone, et deux
 * zones ne se disputent jamais la même aire. C'était le bug d'origine —
 * « Passer son tour » vivait dans le bloc des PA/PM, et les noms des
 * combattants passaient sous la barre de sorts.
 *
 * Les composants consomment cette carte via `data-zone`, les tests la vérifient.
 */
export type CombatArea = "top" | "band" | "dock";

export type CombatZoneId =
  | "header"
  | "initiative"
  | "journal"
  | "vitals"
  | "turn"
  | "spells";

export type CombatElement =
  | "title"
  | "version"
  | "mapTurn"
  | "phase"
  | "combatantName"
  | "combatantVitals"
  | "log"
  | "hp"
  | "apMp"
  | "endTurn"
  | "spells";

export interface CombatZone {
  readonly area: CombatArea;
  readonly elements: readonly CombatElement[];
}

export type CombatZoneMap = Readonly<Record<CombatZoneId, CombatZone>>;

/** Ordre de déclaration : il fixe aussi l'ordre d'affichage vertical du HUD. */
export const ZONE_IDS: readonly CombatZoneId[] = [
  "header",
  "initiative",
  "journal",
  "vitals",
  "turn",
  "spells",
];

export const COMBAT_ZONES: CombatZoneMap = {
  header: { area: "top", elements: ["title", "version", "mapTurn", "phase"] },
  initiative: { area: "band", elements: ["combatantName", "combatantVitals"] },
  journal: { area: "dock", elements: ["log"] },
  vitals: { area: "dock", elements: ["hp", "apMp"] },
  turn: { area: "dock", elements: ["endTurn"] },
  spells: { area: "dock", elements: ["spells"] },
};

/** Colonnes du dock, de gauche à droite : une zone = une colonne, jamais deux. */
export const DOCK_ORDER: readonly CombatZoneId[] = ["journal", "vitals", "turn", "spells"];

function duplicatesOf(values: readonly string[]): string[] {
  const repeated = values.filter((value, index) => values.indexOf(value) !== index);
  return [...new Set(repeated)];
}

/** Zones qui revendiquent le même élément : vide = carte saine. */
export function zonesOf(element: CombatElement, zones: CombatZoneMap = COMBAT_ZONES): CombatZoneId[] {
  return ZONE_IDS.filter((id) => zones[id].elements.includes(element));
}

/** Éléments déclarés par plusieurs zones : vide = carte saine. */
export function layoutViolations(zones: CombatZoneMap = COMBAT_ZONES): string[] {
  const declared = ZONE_IDS.flatMap((id) => zones[id].elements);
  return duplicatesOf(declared);
}

/** Zones empilées deux fois dans la même colonne du dock : vide = carte saine. */
export function dockViolations(order: readonly string[] = DOCK_ORDER): string[] {
  return duplicatesOf(order);
}
