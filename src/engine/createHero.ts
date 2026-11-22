import type { ClassDef } from "../schemas/classSchema";

export interface Hero {
  name: string;
  classId: string;
  className: string;
  level: number;
  ap: number;
  mp: number;
  hp: number;
  maxHp: number;
  pp: number;
  xp: number;
  kamas: number;
  capitalPoints: number;
  spellPoints: number;
  vitality: number;
  wisdom: number;
  strength: number;
  intelligence: number;
  chance: number;
  agility: number;
}

function levelOneStats(classDef: ClassDef) {
  return {
    level: 1,
    ap: classDef.basePa,
    mp: classDef.basePm,
    hp: classDef.baseHp,
    maxHp: classDef.baseHp,
    pp: classDef.basePp,
  };
}

/** Aucun point investi ni gagné au niveau 1. */
function emptyResources() {
  return { xp: 0, kamas: 0, capitalPoints: 0, spellPoints: 0 };
}

function emptyStats() {
  return { vitality: 0, wisdom: 0, strength: 0, intelligence: 0, chance: 0, agility: 0 };
}

export function createHero(name: string, classDef: ClassDef): Hero {
  const identity = { name, classId: classDef.id, className: classDef.name };
  return { ...identity, ...levelOneStats(classDef), ...emptyResources(), ...emptyStats() };
}
