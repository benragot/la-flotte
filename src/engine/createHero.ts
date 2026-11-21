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

export function createHero(name: string, classDef: ClassDef): Hero {
  const identity = { name, classId: classDef.id, className: classDef.name };
  return { ...identity, ...levelOneStats(classDef) };
}
