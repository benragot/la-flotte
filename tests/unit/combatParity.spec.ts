import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { castSpell } from "../../src/engine/combatLoop/cast";
import { initCombat } from "../../src/engine/combatLoop/init";
import { moveActiveEntity } from "../../src/engine/combatLoop/move";
import { beginCombat, openingPhase } from "../../src/engine/combatLoop/opening";
import { resolveCombatRewards } from "../../src/engine/combatLoop/rewards";
import type { CombatStats, CombatState, Rng } from "../../src/engine/combatLoop/types";
import { createHero } from "../../src/engine/createHero";
import { parseAsciiMap } from "../../src/engine/grid";
import type { StorageLike } from "../../src/engine/save";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseProgressionYaml } from "../../src/schemas/progressionSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";

/**
 * GOLDEN 1v1 — DEC-12, étape 1 : figer le comportement **actuel** de
 * `src/engine/combatLoop/` avant de l'unifier dans `multiCombat`.
 *
 * Ces tests décrivent le moteur d'exploration tel qu'il est, pas tel qu'il
 * devrait être. Ils doivent rester verts **sans toucher à `src/`** : le jour où
 * l'un rougit, c'est qu'une règle a bougé et que la migration doit être
 * consciente de ce changement.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const progression = parseProgressionYaml(read("progression.yaml"));

const alwaysZero: Rng = () => 0;
const alwaysHigh: Rng = () => 0.99;
const NO_STATS: CombatStats = { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`introuvable: ${id}`);
  return found;
}

const iopHero = () => createHero("Balthazar", mustFind(classes, "iop"));
const piou = () => mustFind(monsters, "piou_mazoute");

/** Carte de test : `P` et `M` fixes, aucune donnée de `maps.yaml` modifiée. */
function buildState(rows: readonly string[]): CombatState {
  return initCombat({ map: parseAsciiMap([...rows]), hero: iopHero(), monster: piou(), spells });
}

function withStats(state: CombatState, player: CombatStats, enemy: CombatStats): CombatState {
  const hp = { hp: 100, maxHp: 100 };
  return { ...state, player: { ...state.player, ...hp, stats: player }, enemy: { ...state.enemy, ...hp, stats: enemy } };
}

function withEarthResistance(state: CombatState, flat: number, percent: number): CombatState {
  const resistances = state.enemy.resistances;
  const next = { flat: { ...resistances.flat, earth: flat }, percent: { ...resistances.percent, earth: percent } };
  return { ...state, enemy: { ...state.enemy, resistances: next } };
}

/** Cible fixe (2,0) : Pression est le sort de dégâts du Iop, portée 2. */
function castPression(state: CombatState, rng: Rng = alwaysZero): CombatState {
  return castSpell({ state, spellId: "pression", target: { x: 2, y: 0 }, rng });
}

function countingRng(value: number): { rng: Rng; calls: () => number } {
  let calls = 0;
  const rng = () => {
    calls += 1;
    return value;
  };
  return { rng, calls: () => calls };
}

describe("PARITÉ 1v1 — initiative et ordre d'ouverture", () => {
  it("le héros plus rapide ouvre et l'état est rendu par identité", () => {
    // PARITÉ: l'ouverture par initiative (`computeInitiative`) et l'identité quand le héros ouvre survivent au moteur unifié.
    const state = withStats(buildState(["PM.."]), { ...NO_STATS, strength: 10 }, { ...NO_STATS, strength: 5 });
    expect(openingPhase(state)).toBe("player_turn");
    expect(beginCombat(state, alwaysZero)).toBe(state);
  });

  it("à initiative égale le héros ouvre : le départage est fixe", () => {
    // PARITÉ: à initiative égale, le départage reste le héros, jamais l'id du monstre.
    const state = withStats(buildState(["PM.."]), { ...NO_STATS, strength: 10 }, { ...NO_STATS, strength: 10 });
    expect(openingPhase(state)).toBe("player_turn");
  });

  it("un monstre strictement plus rapide ouvre, journalise 15 vs 0, tour 1", () => {
    // PARITÉ: le monstre plus rapide joue son tour d'ouverture, le tour reste 1 et le journal nomme l'initiative.
    const state = withStats(buildState(["P...", "..M."]), NO_STATS, { ...NO_STATS, strength: 15 });
    expect(openingPhase(state)).toBe("enemy_turn");
    const next = beginCombat(state, alwaysZero);
    expect(next.log).toContain("Piou Mazouté joue en premier (initiative 15 vs 0).");
    expect(next.turn).toBe(1);
    expect(next.phase).toBe("player_turn");
  });
});

describe("PARITÉ 1v1 — dégâts d'un sort", () => {
  it("rng 0 : Pression inflige 8 dégâts et coûte 3 PA (35 → 27 PV)", () => {
    // PARITÉ: le jet de base min..max, la stat d'élément et la résistance du monstre donnent le même chiffre.
    const state = buildState(["P.M."]);
    const cast = castPression(state);
    expect(cast.enemy.hp).toBe(27);
    expect(cast.enemy.maxHp).toBe(35);
    expect(cast.player.ap).toBe(3);
    expect(cast.log.at(-1)).toBe("Balthazar lance Pression : 8 dégâts.");
  });

  it("les résistances fixes passent avant le pourcentage : 8 → 4 PV", () => {
    // PARITÉ: ordre fixes puis pourcentage, arrondi plancher, jamais de dégât négatif.
    // (8 − 2 fixes) × (100 − 25) % = floor(4,5) = 4.
    const state = withEarthResistance(buildState(["P.M."]), 2, 25);
    expect(castPression(state).enemy.hp).toBe(31);
  });

  it("rng proche de 1 : la borne haute du sort reste 12 (35 → 23 PV)", () => {
    // PARITÉ: la borne haute du sort reste exacte, aucun dégât hors plage.
    const cast = castPression(buildState(["P.M."]), alwaysHigh);
    expect(cast.enemy.hp).toBe(23);
  });
});

describe("PARITÉ 1v1 — le coup critique n'existe PAS hors donjon", () => {
  it("un seul jet aléatoire, même avec 100 000 d'Agilité : aucun tirage de CC", () => {
    // PARITÉ: après unification, le CC 1vN s'appliquera ici ; l'ancien 1v1 ne consomme qu'un jet et n'a aucun multiplicateur.
    // En 1vN, `rollsCritical` consomme un second `rng()` et applique un
    // `critDamagePct`. Ici `castSpell` ne fait que `rollDamage` : 1 jet, 8 PV.
    const base = buildState(["P.M."]);
    const agile = { ...base, player: { ...base.player, stats: { ...base.player.stats, agility: 100000 } } };
    const counter = countingRng(0);
    const cast = castPression(agile, counter.rng);
    expect(counter.calls()).toBe(1);
    expect(cast.enemy.hp).toBe(27);
    expect(cast.floats?.at(-1)?.amount).toBe(8);
  });
});

describe("PARITÉ 1v1 — le tacle n'existe PAS hors donjon", () => {
  it("collé au monstre, le héros s'éloigne et ne paie que le chemin", () => {
    // PARITÉ: ce cas changera sciemment à l'étape 2 (tacle partagé), jamais par accident.
    // En 1vN, `moveHero` juge `tackleCheck` à chaque pas : un tacle raté arrête
    // la marche et prélève 1 PM. Ici `moveActiveEntity` n'a même pas de `rng`.
    const state = buildState(["PM..", "...."]);
    const moved = moveActiveEntity(state, { x: 0, y: 1 });
    expect(moved.player.position).toEqual({ x: 0, y: 1 });
    expect(moved.player.mp).toBe(2);
    expect(moved.player.ap).toBe(state.player.ap);
    expect(moved.log.at(-1)).toBe("Balthazar se déplace de 1 case(s).");
  });
});

describe("PARITÉ 1v1 — déplacement DEC-10", () => {
  it("un pas orthogonal coûte 1 PM", () => {
    // PARITÉ: 1 PM par pas orthogonal (DEC-10), facture partagée via `grid`.
    const state = buildState(["P...", "...."]);
    const moved = moveActiveEntity(state, { x: 1, y: 0 });
    expect(moved.player.mp).toBe(2);
    expect(moved.log.at(-1)).toBe("Balthazar se déplace de 1 case(s).");
  });

  it("un pas diagonal coûte 2 PM", () => {
    // PARITÉ: 2 PM par pas diagonal (DEC-10), même facture des deux côtés.
    const state = buildState(["P...", "...."]);
    const moved = moveActiveEntity(state, { x: 1, y: 1 });
    expect(moved.player.position).toEqual({ x: 1, y: 1 });
    expect(moved.player.mp).toBe(1);
    expect(moved.log.at(-1)).toBe("Balthazar se déplace de 2 case(s).");
  });

  it("deux diagonales (4 PM) sont refusées : 3 PM ne suffisent pas", () => {
    // PARITÉ: hors budget, le 1v1 refuse le chemin en bloc et ne facture rien.
    const state = buildState(["P...", "....", "...."]);
    expect(moveActiveEntity(state, { x: 2, y: 2 })).toBe(state);
  });
});

describe("PARITÉ 1v1 — victoire : XP, butin, niveau suivant, 0 kamas", () => {
  const rewards = (rng: Rng) =>
    resolveCombatRewards({ heroXp: 0, hero: buildState(["P.M."]).player, monster: piou(), progression, rng });

  it("Piou Mazouté : 120 XP, niveau 2, gain de niveau et prospection 100", () => {
    // PARITÉ: formule XP (H=M), courbe et gain de niveau réutilisés tels quels.
    const result = rewards(alwaysZero);
    expect(result.xpGained).toBe(120);
    expect(result.totalXp).toBe(120);
    expect(result.level).toBe(2);
    expect(result.levelUp).toEqual({ hp: 5, capitalPoints: 5, spellPoints: 1 });
    expect(result.prospection).toBe(100);
  });

  it("butin : deux entrées tombent à rng 0, aucune à rng 0,99", () => {
    // PARITÉ: un tirage par entrée de butin, dans l'ordre du YAML, avec prospection.
    expect(rewards(alwaysZero).drops).toEqual(["plume_mazoutee", "fer_goutte_mazout"]);
    expect(rewards(alwaysHigh).drops).toEqual([]);
  });

  it("kamas = 0 en 1v1 : aucun champ de récompense ne porte de kamas", () => {
    // PARITÉ: ne pas remplacer ce zéro implicite par une règle kamas inventée en douce.
    expect(Object.keys(rewards(alwaysZero))).toEqual([
      "xpGained",
      "totalXp",
      "level",
      "levelUp",
      "prospection",
      "drops",
    ]);
  });
});

describe("PARITÉ 1v1 — défaite : PV restaurés, aucun 0 persisté", () => {
  beforeEach(() => {
    useGameStore.getState().resetGame();
    useGameStore.getState().createCharacter({ name: "Anselme", classId: "iop" });
    useCombatStore.getState().resetCombat();
  });

  it("le retour sur la carte soigne le héros et sauvegarde un vivant", () => {
    // PARITÉ: la défaite restaure les PV max et persiste un vivant, jamais un 0.
    const storage = new MemoryStorage();
    useCombatStore.getState().startDemoCombat();
    useCombatStore.setState({ combat: weakened(combatOrThrow()) });
    useGameStore.setState({ hero: { ...heroOrThrow(), hp: 1 } });
    useCombatStore.getState().endTurn();
    expect(useCombatStore.getState().combat?.phase).toBe("defeat");
    expect(useCombatStore.getState().combat?.player.hp).toBe(0);
    useCombatStore.getState().returnToMap();
    expect(useCombatStore.getState().combat).toBeNull();
    expect(useCombatStore.getState().mode).toBe("exploration");
    expect(heroOrThrow().hp).toBe(heroOrThrow().maxHp);
    expect(useGameStore.getState().saveGame(storage)).toBe(true);
    useGameStore.getState().resetGame();
    expect(useGameStore.getState().loadGame(storage)).toBe(true);
    expect(heroOrThrow().hp).toBeGreaterThan(0);
  });
});

/** Même leurre que la production : Piou au contact, héros à 1 PV, tour joueur. */
function weakened(combat: CombatState): CombatState {
  const player = { ...combat.player, hp: 1 };
  const enemy = { ...combat.enemy, position: { x: player.position.x + 1, y: player.position.y } };
  return { ...combat, player, enemy };
}

function combatOrThrow(): CombatState {
  const { combat } = useCombatStore.getState();
  if (combat === null) throw new Error("combat de démonstration absent");
  return combat;
}

function heroOrThrow() {
  const { hero } = useGameStore.getState();
  if (hero === null) throw new Error("héros absent");
  return hero;
}

/** Stockage mémoire minimal : la défaite doit persister un héros vivant. */
class MemoryStorage implements StorageLike {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}
