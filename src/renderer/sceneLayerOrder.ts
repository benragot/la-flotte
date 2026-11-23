/**
 * Ordre peintre de la scène : la première couche est la plus profonde, la
 * dernière recouvre tout. **Une seule source** — `sceneLayers.ts` ajoute les
 * enfants du `stage` dans cet ordre, les tests le lisent ici.
 *
 * `hover` est la surbrillance de l'entité survolée : au-dessus du décor et des
 * surbrillances de case, **sous** les jetons, donc sous les PV et les noms.
 *
 * `teamRings` porte l'anneau d'équipe au sol : après le survol (qui ne doit pas
 * laver la teinte du camp), **avant** `tokens` et `actors`, donc sous le sprite
 * et sous l'ombre elliptique cuite dans sa feuille (§5, §8.6).
 */
export const SCENE_LAYER_ORDER = [
  "grid",
  "decor",
  "highlights",
  "hover",
  "path",
  "exitMarks",
  "teamRings",
  "tokens",
  "actors",
  "decorAbove",
  "hpBars",
  "labels",
  "floats",
] as const;

export type SceneLayerName = (typeof SCENE_LAYER_ORDER)[number];
