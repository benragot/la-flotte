import { describe, expect, it } from "vitest";
import { pickSpawn, pickWeighted, totalWeight } from "../../src/engine/exploration";
import type { SpawnZone, WeightedMonster } from "../../src/engine/exploration";
import { useCombatStore } from "../../src/store/useCombatStore";

/**
 * Fixture à poids réels : 50 / 30 / 20 sur 100, donc bornes cumulées
 * `[50, 80, 100]`. Les attentes ci-dessous se calculent depuis ces bornes,
 * elles ne sont pas devinées.
 */
const ALPHA: readonly WeightedMonster[] = [
  { monsterId: "monstre_lourd", weight: 50 },
  { monsterId: "monstre_moyen", weight: 30 },
  { monsterId: "monstre_leger", weight: 20 },
];
const BETA: readonly WeightedMonster[] = [{ monsterId: "monstre_beta", weight: 7 }];

const ONE_OF_EACH = { groups: { min: 1, max: 1 }, members: { min: 1, max: 1 } } as const;

const ZONES: readonly SpawnZone[] = [
  { id: "zone_alpha", mapId: "map_alpha", monsters: ALPHA, ...ONE_OF_EACH },
  { id: "zone_beta", mapId: "map_beta", monsters: BETA, ...ONE_OF_EACH },
];

const rngOf = (value: number) => () => value;

const sweep = (): string[] => {
  const picks: string[] = [];
  for (let index = 0; index < 1000; index += 1) {
    picks.push(pickSpawn({ zones: ZONES, mapId: "map_alpha", rng: rngOf(index / 1000) }).monsterId);
  }
  return picks;
};

const countOf = (picks: readonly string[], monsterId: string): number =>
  picks.filter((entry) => entry === monsterId).length;

describe("totalWeight", () => {
  it("somme les poids relatifs de la zone", () => {
    expect(totalWeight(ALPHA)).toBe(100);
    expect(totalWeight(BETA)).toBe(7);
  });
});

describe("pickSpawn — tirage pondéré déterministe", () => {
  it("suit les bornes cumulées calculées depuis les poids", () => {
    // 0 · 100 = 0 → borne 50 · 0.5 · 100 = 50, strictement `< 50` faux → borne 80
    // 0.999 · 100 = 99.9 → borne 100.
    expect(pickSpawn({ zones: ZONES, mapId: "map_alpha", rng: rngOf(0) }).monsterId).toBe("monstre_lourd");
    expect(pickSpawn({ zones: ZONES, mapId: "map_alpha", rng: rngOf(0.499) }).monsterId).toBe("monstre_lourd");
    expect(pickSpawn({ zones: ZONES, mapId: "map_alpha", rng: rngOf(0.5) }).monsterId).toBe("monstre_moyen");
    expect(pickSpawn({ zones: ZONES, mapId: "map_alpha", rng: rngOf(0.999) }).monsterId).toBe("monstre_leger");
  });

  it("nomme la zone retenue et l'absence de repli", () => {
    const pick = pickSpawn({ zones: ZONES, mapId: "map_alpha", rng: rngOf(0) });
    expect(pick.zoneId).toBe("zone_alpha");
    expect(pick.fallback).toBe(false);
  });
});

describe("pickSpawn — fréquence proportionnelle au poids", () => {
  it("sort le monstre le plus lourd le plus souvent", () => {
    const picks = sweep();
    expect(countOf(picks, "monstre_lourd")).toBeGreaterThan(countOf(picks, "monstre_moyen"));
    expect(countOf(picks, "monstre_moyen")).toBeGreaterThan(countOf(picks, "monstre_leger"));
  });

  it("couvre tous les monstres déclarés sur un balayage régulier", () => {
    expect(new Set(sweep()).size).toBe(ALPHA.length);
  });
});

describe("pickSpawn — repli sur la première zone", () => {
  it("ne jette pas quand la map courante n'a pas de zone", () => {
    const pick = pickSpawn({ zones: ZONES, mapId: "map_inconnue", rng: rngOf(0) });
    expect(pick.zoneId).toBe("zone_alpha");
    expect(pick.monsterId).toBe("monstre_lourd");
    expect(pick.fallback).toBe(true);
  });
});

describe("pickWeighted — immuabilité", () => {
  it("ne mute jamais la table fournie", () => {
    const before = structuredClone(ZONES);
    pickSpawn({ zones: ZONES, mapId: "map_out", rng: rngOf(0.5) });
    pickWeighted(BETA, rngOf(0));
    expect(ZONES).toEqual(before);
  });
});

describe("useCombatStore — exploration branchée sur data/spawns.yaml", () => {
  it("tire le monstre de la zone de la plage au lieu d'une constante", () => {
    useCombatStore.getState().startExploration(rngOf(0));
    expect(useCombatStore.getState().exploration?.monsterGroups[0]?.monsterIds).toEqual(["piou_mazoute"]);
  });

  // `members` vaut 1-1 (le 1v1 ne fait entrer qu'un monstre) : le groupe porte
  // exactement le monstre du tirage, comme avant la donnée `groups`.
  it("atteint l'Écrou-Baton sur un tirage haut, sans dépendre du donjon", () => {
    useCombatStore.getState().startExploration(rngOf(0.999));
    const group = useCombatStore.getState().exploration?.monsterGroups[0];
    expect(group?.monsterIds).toEqual(["fer_boulon_pousseur"]);
  });
});
