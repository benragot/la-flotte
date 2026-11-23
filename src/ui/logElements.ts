import type { Element, SpellDef } from "../schemas/spellSchema";

/**
 * Teinte d'une ligne de journal. Le **glyphe** double toujours la couleur
 * (spec §3.1) : un daltonien lit la forme, pas seulement la teinte.
 *
 * Les encres viennent de `theme.css` : le remplissage `--color-el-*` ne sert
 * qu'au bandeau de 2 px, jamais au texte — Feu `#D2452F` ne pèse que 2,69:1 sur
 * le corps de panneau, l'encre `#DC8974` en pèse 4,57:1.
 */
export type ElementTone = "feu" | "eau" | "air" | "terre" | "soin" | "echec" | "neutre";

export interface LogLook {
  readonly tone: ElementTone;
  readonly glyph: string;
  /** Nom de l'élément pour l'infobulle ; vide quand la ligne n'en porte pas. */
  readonly label: string;
}

const GLYPHS: Readonly<Record<ElementTone, string>> = {
  feu: "▲",
  eau: "◆",
  air: "◇",
  terre: "■",
  soin: "⊕",
  echec: "×",
  neutre: "·",
};

const LABELS: Readonly<Record<ElementTone, string>> = {
  feu: "Feu",
  eau: "Eau",
  air: "Air",
  terre: "Terre",
  soin: "Soin",
  echec: "Échec",
  neutre: "",
};

const ELEMENT_TONE: Readonly<Record<Element, ElementTone>> = {
  fire: "feu",
  water: "eau",
  air: "air",
  earth: "terre",
  neutral: "neutre",
};

/** Le journal ne dit l'élément que d'un sort **lancé** (« … lance X : n dégâts. »). */
const CAST_MARKER = " lance ";
const HEAL_MARKERS: readonly string[] = ["récupér", "gagné", "soigne"];
const FAILURE_MARKERS: readonly string[] = ["bloqu", "refus", "impossible", "ne peut pas"];

function castTone(line: string, spells: Record<string, SpellDef>): ElementTone | null {
  if (!line.includes(CAST_MARKER)) return null;
  const cast = Object.values(spells).find((spell) => line.includes(spell.name));
  const element = cast?.element;
  return element === undefined ? null : ELEMENT_TONE[element];
}

function contains(line: string, markers: readonly string[]): boolean {
  return markers.some((marker) => line.includes(marker));
}

/** Élément du sort lancé, sinon soin, échec, puis neutre. */
function toneOf(line: string, spells: Record<string, SpellDef>): ElementTone {
  const cast = castTone(line, spells);
  if (cast !== null) return cast;
  if (contains(line, HEAL_MARKERS)) return "soin";
  return contains(line, FAILURE_MARKERS) ? "echec" : "neutre";
}

/** Ce que la ligne doit montrer : sa teinte, son glyphe et le nom de l'élément. */
export function logLook(line: string, spells: Record<string, SpellDef>): LogLook {
  const tone = toneOf(line, spells);
  return { tone, glyph: GLYPHS[tone], label: LABELS[tone] };
}
