import { describe, expect, it } from "vitest";
import {
  computeApMpLossChance,
  computeCritDenominator,
  computeCritRate,
  computeDamage,
  computeInitiative,
  computePushbackDamage,
  computeTackleEscapePercent,
} from "../../src/engine/combat";

describe("computeDamage — formule de base", () => {
  it("applique la stat, le bonus pourcentage puis le bonus plat", () => {
    expect(computeDamage({ base: 100, stat: 50, percentDmg: 20, flatDmg: 10 })).toBe(180);
  });

  it("ajoute le bonus plat sans le multiplier par le pourcentage", () => {
    expect(computeDamage({ base: 100, stat: 0, percentDmg: 50, flatDmg: 10 })).toBe(160);
  });

  it("traite une stat négative comme zéro", () => {
    const negative = computeDamage({ base: 100, stat: -50 });
    const zero = computeDamage({ base: 100, stat: 0 });
    expect(negative).toBe(100);
    expect(negative).toBe(zero);
  });
});

describe("computeDamage — résistances", () => {
  it("plafonne la résistance pourcentage d'un joueur à 50", () => {
    expect(computeDamage({ base: 100, stat: 0, pctRes: 80, isPlayer: true })).toBe(50);
  });

  it("ne plafonne pas la résistance pourcentage d'un monstre", () => {
    expect(computeDamage({ base: 100, stat: 0, pctRes: 80, isPlayer: false })).toBe(20);
  });

  it("renvoie 0 quand la résistance fixe dépasse les dégâts", () => {
    expect(computeDamage({ base: 10, stat: 0, flatRes: 100 })).toBe(0);
  });

  it("combine armure et résistance fixe avant la résistance pourcentage", () => {
    const dmg = computeDamage({ base: 100, stat: 0, armor: 20, flatRes: 30, pctRes: 50 });
    expect(dmg).toBe(25);
  });
});

describe("computeCritDenominator — 1/X (SPELL-03)", () => {
  it("30 de base et 100 d'Agilité ⇒ X = 19, soit 1 chance sur 19", () => {
    // PARITÉ: SPELL-03, fiche 1.29 : X = floor(base × e × 1,1 / ln(Agi + 12)).
    expect(computeCritDenominator({ baseCrit: 30, bonusCrit: 0, agility: 100 })).toBe(19);
  });

  it("le +CC d'équipement se retire AVANT l'Agilité : 20 − 10 ⇒ X = 6", () => {
    // PARITÉ: SPELL-03, base = critRate − bonusCrit.
    expect(computeCritDenominator({ baseCrit: 20, bonusCrit: 10, agility: 100 })).toBe(6);
  });

  it("12 de base à 8 d'Agilité ⇒ X = 11 (le seuil est atteint, pas dépassé)", () => {
    // PARITÉ: SPELL-03, l'Agilité ne compte qu'à partir de 8.
    expect(computeCritDenominator({ baseCrit: 12, bonusCrit: 0, agility: 8 })).toBe(11);
  });

  it("plafonne le taux à 1 chance sur 2 (X = 2), jamais 2 %", () => {
    // PARITÉ: SPELL-03, X = 2 est un PLAFOND de chance, pas un plancher.
    expect(computeCritDenominator({ baseCrit: 2, bonusCrit: 0, agility: 0 })).toBe(2);
    expect(computeCritDenominator({ baseCrit: 10, bonusCrit: 8, agility: 100 })).toBe(2);
    expect(computeCritDenominator({ baseCrit: 5, bonusCrit: 20, agility: 100 })).toBe(2);
    expect(computeCritDenominator({ baseCrit: 3, bonusCrit: 0, agility: 1000 })).toBe(2);
  });

  it("renvoie l'écart brut quand l'Agilité est inférieure à 8", () => {
    expect(computeCritDenominator({ baseCrit: 30, bonusCrit: 0, agility: 5 })).toBe(30);
  });

  it("applique la courbe logarithmique d'Agilité : 50 à 100 d'Agi ⇒ X = 31", () => {
    expect(computeCritDenominator({ baseCrit: 50, bonusCrit: 0, agility: 100 })).toBe(31);
  });

  it("158 n'est jamais garanti : X = 100, soit 1 chance sur 100", () => {
    // PARITÉ: SPELL-03, 158 = 1/100 pas garanti.
    expect(computeCritDenominator({ baseCrit: 157, bonusCrit: 0, agility: 100 })).toBe(99);
    expect(computeCritDenominator({ baseCrit: 158, bonusCrit: 0, agility: 100 })).toBe(100);
  });
});

describe("computeCritRate — dérivé d'affichage de 1/X", () => {
  it("vaut 100 / X, pour l'affichage seulement", () => {
    // PARITÉ: SPELL-03, une seule formule : le pourcentage ne fait que diviser 100 par X.
    expect(computeCritRate({ baseCrit: 30, bonusCrit: 0, agility: 100 })).toBeCloseTo(100 / 19);
    expect(computeCritRate({ baseCrit: 2, bonusCrit: 0, agility: 0 })).toBe(50);
  });
});

describe("computeApMpLossChance — bornes", () => {
  it("borne à 0.10 face à une sagesse cible très élevée", () => {
    const input = { casterWisdom: 0, targetWisdom: 1000, remaining: 1, max: 10 };
    expect(computeApMpLossChance(input)).toBe(0.1);
  });

  it("borne à 0.90 face à une sagesse lanceur très élevée", () => {
    const input = { casterWisdom: 1000, targetWisdom: 0, remaining: 10, max: 10 };
    expect(computeApMpLossChance(input)).toBe(0.9);
  });

  it("calcule une chance intermédiaire de 0.5 à sagesses égales", () => {
    const input = { casterWisdom: 100, targetWisdom: 100, remaining: 10, max: 10 };
    expect(computeApMpLossChance(input)).toBe(0.5);
  });
});

describe("computeApMpLossChance — pondération", () => {
  it("pondère par les PA/PM restants", () => {
    const input = { casterWisdom: 60, targetWisdom: 80, remaining: 7, max: 10 };
    expect(computeApMpLossChance(input)).toBeCloseTo(0.2625, 10);
  });

  it("ajoute les bonus de fuite et de retrait", () => {
    const input = { casterWisdom: 0, targetWisdom: 0, remaining: 10, max: 10 };
    const boosted = { ...input, bonusDodge: 25, bonusRetrait: 25 };
    expect(computeApMpLossChance(boosted)).toBe(0.5);
  });
});

describe("computePushbackDamage", () => {
  it("inflige 8 dégâts au niveau 1 sur une case avec un roll de 1", () => {
    expect(computePushbackDamage({ casterLevel: 1, roll: 1, remainingCells: 1 })).toBe(8);
  });

  it("multiplie par le nombre de cases restantes", () => {
    expect(computePushbackDamage({ casterLevel: 50, roll: 4, remainingCells: 3 })).toBe(36);
  });

  it("divise par deux pour une cible secondaire", () => {
    const input = { casterLevel: 50, roll: 4, remainingCells: 3, isSecondaryTarget: true };
    expect(computePushbackDamage(input)).toBe(18);
  });

  it("arrondit à l'inférieur la cible secondaire", () => {
    const input = { casterLevel: 1, roll: 1, remainingCells: 1, isSecondaryTarget: true };
    expect(computePushbackDamage(input)).toBe(4);
  });
});

describe("computeTackleEscapePercent", () => {
  it("renvoie 0 % quand la fuite est nulle face à un tacle énorme", () => {
    expect(computeTackleEscapePercent({ fleeAgility: 0, tackleAgility: 1000 })).toBe(0);
  });

  it("renvoie 100 % quand la fuite écrase le tacle", () => {
    expect(computeTackleEscapePercent({ fleeAgility: 1000, tackleAgility: 0 })).toBe(100);
  });

  it("renvoie 50 % à agilités égales", () => {
    expect(computeTackleEscapePercent({ fleeAgility: 100, tackleAgility: 100 })).toBe(50);
  });

  it("calcule une valeur intermédiaire chiffrée", () => {
    const percent = computeTackleEscapePercent({ fleeAgility: 200, tackleAgility: 100 });
    expect(percent).toBeCloseTo(92.8571428571, 8);
  });
});

describe("computeInitiative", () => {
  it("somme les stats et le bonus à PV pleins", () => {
    const input = { strength: 10, intelligence: 20, chance: 30, agility: 40 };
    const initiative = computeInitiative({ ...input, bonusInitiative: 50, currentHp: 50, maxHp: 50 });
    expect(initiative).toBe(150);
  });

  it("divise par deux à moitié de PV", () => {
    const input = { strength: 25, intelligence: 25, chance: 25, agility: 25 };
    const initiative = computeInitiative({ ...input, currentHp: 25, maxHp: 50 });
    expect(initiative).toBe(50);
  });

  it("arrondit à l'inférieur", () => {
    const input = { strength: 100, intelligence: 0, chance: 0, agility: 0 };
    expect(computeInitiative({ ...input, currentHp: 1, maxHp: 3 })).toBe(33);
  });

  it("renvoie 0 à 0 PV", () => {
    const input = { strength: 100, intelligence: 100, chance: 100, agility: 100 };
    expect(computeInitiative({ ...input, currentHp: 0, maxHp: 50 })).toBe(0);
  });
});
