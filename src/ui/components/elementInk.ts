import type { ElementTone } from "../logElements";
import { LOG_BAND, LOG_GLYPH } from "../uiTokens";

/**
 * Encres et bandeaux d'élément, **une seule fois** pour tout le HUD.
 *
 * Défaut d'origine (relevé au lot 5) : `CombatLogPanel` tenait ces deux tables,
 * le grimoire n'en avait aucune et affichait l'élément en or — deux langages
 * pour la même donnée. Les tables vivent ici, `logElements` fournit la teinte et
 * le glyphe, et chaque surface ne choisit plus sa couleur.
 *
 * Règle §1.5 : le **remplissage** (`--color-el-*`) ne sert qu'au bandeau, jamais
 * au texte — Feu `#D2452F` ne pèse que 2,69:1 sur le corps de panneau. L'**encre**
 * (`--color-el-*-ink`) porte le texte et dépasse 4,5:1 partout.
 */
export const ELEMENT_INK: Readonly<Record<ElementTone, string>> = {
  feu: "text-[var(--color-el-feu-ink)]",
  eau: "text-[var(--color-el-eau-ink)]",
  air: "text-[var(--color-el-air-ink)]",
  terre: "text-[var(--color-el-terre-ink)]",
  soin: "text-[var(--color-el-soin-ink)]",
  echec: "text-[var(--color-el-echec-ink)]",
  neutre: "",
};

export const ELEMENT_BAND: Readonly<Record<ElementTone, string>> = {
  feu: "bg-[var(--color-el-feu)]",
  eau: "bg-[var(--color-el-eau)]",
  air: "bg-[var(--color-el-air)]",
  terre: "bg-[var(--color-el-terre)]",
  soin: "bg-[var(--color-el-soin)]",
  echec: "bg-[var(--color-el-echec)]",
  neutre: "bg-transparent",
};

/** Bandeau de 2 px : le jeton du journal, réemployé tel quel (aucune copie). */
export const ELEMENT_BAND_CELL = LOG_BAND;

/** Glyphe d'élément : la colonne du journal, réemployée telle quelle. */
export const ELEMENT_GLYPH = LOG_GLYPH;
