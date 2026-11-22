/**
 * DEC-03 — soin au franchissement d'une salle. Entorse assumée à Dofus 1.29 :
 * le ratio vient de `data/dungeons.yaml` (`healBetweenRooms`), jamais du code.
 *
 * Le calcul porte sur le pool EFFECTIF (`hero.maxHp + objets + Vitalité`), celui
 * que le combattant expose ; le retour à la persistance reste le travail de
 * `heroHpFromCombat`, qui retire le bonus sans soigner.
 */

export interface RoomHealInput {
  /** PV effectifs courants du héros dans la salle qui vient d'être gagnée. */
  hp: number;
  /** PV effectifs maximaux du même combattant. */
  maxHp: number;
  /** Part du maximum rendue, bornée 0..1 par `dungeonSchema`. */
  ratio: number;
}

export interface RoomHeal {
  hp: number;
  healed: number;
}

function healAmount(maxHp: number, ratio: number): number {
  return Math.ceil(Math.max(0, maxHp) * ratio);
}

/** PV rendus entre deux salles : `ceil(max × ratio)`, bornés au maximum effectif. */
export function healBetweenRooms(input: RoomHealInput): RoomHeal {
  const hp = Math.min(input.maxHp, input.hp + healAmount(input.maxHp, input.ratio));
  return { hp, healed: hp - input.hp };
}
