/**
 * Ordre peintre de la scène : la première couche est la plus profonde, la
 * dernière recouvre tout. **Une seule source** — `sceneLayers.ts` ajoute les
 * enfants du `stage` dans cet ordre, les tests le lisent ici.
 *
 * `hover` est la surbrillance de l'entité survolée : au-dessus du décor et des
 * surbrillances de case, **sous** les jetons, donc sous les PV et les noms.
 */
export const SCENE_LAYER_ORDER = [
  "grid",
  "decor",
  "highlights",
  "hover",
  "path",
  "exitMarks",
  "tokens",
  "actors",
  "decorAbove",
  "hpBars",
  "labels",
  "floats",
] as const;

export type SceneLayerName = (typeof SCENE_LAYER_ORDER)[number];
