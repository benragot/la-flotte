import type { ClassDef } from "../../schemas/classSchema";
import type { Hero } from "../createHero";
import type { HeroSnapshot, HeroStatsSnapshot } from "../save";

type HeroIdentity = Omit<HeroSnapshot, "stats">;

function statsOf(hero: Hero): HeroStatsSnapshot {
  const { vitality, wisdom, strength, intelligence, chance, agility } = hero;
  return { vitality, wisdom, strength, intelligence, chance, agility };
}

function identityOf(hero: Hero): HeroIdentity {
  const { name, classId, level, xp, kamas, hp, maxHp, ap, mp, capitalPoints, spellPoints } = hero;
  return { name, classId, level, xp, kamas, hp, maxHp, ap, mp, capitalPoints, spellPoints };
}

/** Photo persistable : `className` et `pp` sont redérivés de la classe. */
export function heroToSnapshot(hero: Hero): HeroSnapshot {
  return { ...identityOf(hero), stats: statsOf(hero) };
}

/** Reconstruit le héros ; `className` et `pp` viennent de la classe fournie. */
export function heroFromSnapshot(snapshot: HeroSnapshot, classDef: ClassDef): Hero {
  const { stats, ...identity } = snapshot;
  return { ...identity, className: classDef.name, pp: classDef.basePp, ...stats };
}
