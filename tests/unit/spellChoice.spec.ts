import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { initCombat } from "../../src/engine/combatLoop/init";
import { createHero } from "../../src/engine/createHero";
import { allPositions } from "../../src/engine/combatLoop/cells";
import { parseAsciiMap, rangeDistance, samePosition, isWalkableCell } from "../../src/engine/grid";
import type { Position } from "../../src/engine/grid";
import type { BattleState, CombatantLike } from "../../src/engine/multiCombat";
import { battleViewModel } from "../../src/renderer/battleViewModel";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import { battleSpellSlots, heroCombatant } from "../../src/store/battleSpells";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import { battleAttackButton, battleSelfButton } from "../../src/ui/battle/attackButtonState";
import { BattleSpellSlotsView } from "../../src/ui/components/BattleSpellSlots";
import { CombatantList } from "../../src/ui/components/battle";
import { dockSurface } from "../../src/ui/dockGate";

/**
 * SPELL-04 — en salle (1vN), le joueur doit choisir **n'importe quel sort
 * lançable** du héros. Avant ce correctif : 3 sorts connus, 1 seul réellement
 * lancé (`heroDamageSpell()` = Pression), aucune barre de sorts en donjon et
 * `Bond` armait un sort que rien ne savait résoudre.
 *
 * Les valeurs sont exactes et viennent de `data/spells.yaml` :
 * - Pression : 3 PA, 8–12 Terre, portée 1–2 ;
 * - Épée du Destin : 4 PA, 10–14 Feu, portée 1–3, poussée 1 ;
 * - Bond : 5 PA, `kind: teleport` (aucun chemin 1vN) ;
 * - Mot Curatif : 6 PA, soin 5–11 sur soi ;
 * - Coup de Couvercle : 3 PA, `castsPerTurn: 1`, `cooldown: 2` ;
 * - Morsure Tétanos : 3 PA, `castsPerTurn: 2`.
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

const DUNGEON_ID = "fer_donjon_casse_vis_sans_fin";

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
  return found;
}

function roomOne() {
  const dungeon: DungeonDef = mustFind(dungeons, DUNGEON_ID);
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

function state() {
  return useCombatStore.getState();
}

function battleOrThrow(): BattleState {
  const battle = state().battle;
  if (battle === null) throw new Error("aucune salle ouverte");
  return battle;
}

/** Le héros ouvre : la salle rend la main aux monstres à l'initiative égale. */
function heroHand(battle: BattleState): BattleState {
  return { ...battle, activeIndex: Math.max(0, battle.order.indexOf("player")) };
}

function openRoom(): BattleState {
  state().startDungeonRoom({ room: roomOne() });
  useCombatStore.setState({ battle: heroHand(battleOrThrow()) });
  return battleOrThrow();
}

function ofSide(battle: BattleState, side: "player" | "enemy"): CombatantLike {
  const found = battle.combatants.find((entry) => entry.side === side);
  if (found === undefined) throw new Error(`combattant ${side} absent`);
  return found;
}

const ELEMENTS = ["earth", "fire", "water", "air", "neutral"] as const;

function zeroResistances() {
  const flat = Object.fromEntries(ELEMENTS.map((element) => [element, 0]));
  const percent = Object.fromEntries(ELEMENTS.map((element) => [element, 0]));
  return { flat, percent } as CombatantLike["resistances"];
}

function zeroStats(): CombatantLike["stats"] {
  return { strength: 0, intelligence: 0, chance: 0, agility: 0, wisdom: 0 };
}

/** Case libre et praticable à exactement `distance` cases (Chebyshev) du héros. */
function freeCell(battle: BattleState, distance: number): Position {
  const hero = ofSide(battle, "player");
  const map = battle.map;
  if (map === undefined) return { x: hero.position.x + distance, y: hero.position.y };
  const taken = battle.combatants.filter((entry) => entry.id !== hero.id).map((entry) => entry.position);
  const free = (cell: Position) => isWalkableCell(map, cell) && !taken.some((pos) => samePosition(pos, cell));
  const found = allPositions(map).find((cell) => rangeDistance(cell, hero.position) === distance && free(cell));
  if (found === undefined) throw new Error(`aucune case libre à distance ${distance}`);
  return found;
}

interface StageInput {
  spellIds: string[];
  ap: number;
  heroHp?: number;
  distance?: number;
}

/**
 * Duel contrôlé dans la vraie carte de la salle : héros sans stat ni
 * équipement, monstre sans résistance, à la distance demandée. Le jet `rng: 0`
 * donne exactement le minimum de la fourchette YAML.
 */
function staged(input: StageInput): BattleState {
  const base = openRoom();
  const hero = ofSide(base, "player");
  const enemy = ofSide(base, "enemy");
  const combatants = [
    { ...hero, ap: input.ap, maxAp: 20, hp: input.heroHp ?? hero.hp, stats: zeroStats(), percentDmg: 0, spellIds: input.spellIds },
    { ...enemy, position: freeCell(base, input.distance ?? 1), hp: 500, maxHp: 500, resistances: zeroResistances(), armor: 0, percentDmg: 0 },
  ];
  const battle = { ...base, turn: 1, spellUsage: {}, combatants };
  useCombatStore.setState({ battle });
  return battle;
}

/**
 * Même duel, timeline réduite à [héros, ennemi] : deux `advanceBattleTurn`
 * ramènent la main au héros en incrémentant le tour, comme la cadence réelle.
 */
function orderedDuel(input: StageInput): BattleState {
  const base = staged(input);
  const battle = { ...base, order: [ofSide(base, "player").id, ofSide(base, "enemy").id], activeIndex: 0 };
  useCombatStore.setState({ battle });
  return battle;
}

function slot(spellId: string, list = battleSpellSlots({ battle: battleOrThrow(), spells, selectedSpellId: state().selectedSpellId })) {
  const found = list.find((entry) => entry.spellId === spellId);
  if (found === undefined) throw new Error(`sort ${spellId} absent des cases`);
  return found;
}

function enemyId(): string {
  return ofSide(battleOrThrow(), "enemy").id;
}

function heroAp(battle: BattleState): number {
  return ofSide(battle, "player").ap;
}

function enemyHp(battle: BattleState): number {
  return ofSide(battle, "enemy").hp;
}

beforeEach(() => {
  vi.stubEnv("VITE_COMBAT_ENGINE", "unified");
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter({ name: "Balthazar", classId: "iop" });
  state().resetCombat();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* ------------------------------ sélection du sort --------------------------- */

describe("SPELL-04 — le dock de salle expose tous les sorts connus", () => {
  it("liste les trois sorts du héros, la téléportation désactivée avec sa raison", () => {
    staged({ spellIds: ["pression", "bond", "epee_du_destin"], ap: 6 });
    expect(heroCombatant(battleOrThrow())?.spellIds).toEqual(["pression", "bond", "epee_du_destin"]);
    const slots = battleSpellSlots({ battle: battleOrThrow(), spells, selectedSpellId: null });
    expect(slots.map((entry) => entry.spellId)).toEqual(["pression", "bond", "epee_du_destin"]);
    expect(slot("pression", slots)).toMatchObject({ state: "disponible", disabled: false });
    expect(slot("epee_du_destin", slots)).toMatchObject({ state: "disponible", disabled: false });
    expect(slot("bond", slots)).toMatchObject({
      state: "non-supporte",
      disabled: true,
      reason: "Téléportation pas encore gérée en salle",
    });
  });

  it("un sort utilitaire non implémenté reste désactivé avec sa raison", () => {
    staged({ spellIds: ["pression", "gueule_de_bois", "contre"], ap: 12 });
    expect(slot("contre")).toMatchObject({ state: "non-supporte", disabled: true, badge: "à venir" });
    expect(slot("contre").reason).toBe("Effet pas encore implémenté");
    expect(slot("gueule_de_bois")).toMatchObject({ state: "non-supporte", disabled: true, badge: "état non géré" });
    expect(slot("gueule_de_bois").reason).toBe("État non géré par le moteur");
  });

  it("une salle de donjon reçoit le dock de sorts, pas le dock d'exploration", () => {
    const battle = openRoom();
    expect(dockSurface({ mode: "exploration", combat: null, battle })).toBe("unified-spells");
    expect(dockSurface({ mode: "exploration", combat: null, battle: null })).toBe("legacy");
  });

  it("un sort sans cible à portée porte l'état hors portée et reste désactivé", () => {
    staged({ spellIds: ["pression", "epee_du_destin"], ap: 12, distance: 5 });
    expect(slot("pression")).toMatchObject({ state: "hors-portee", disabled: true, reason: "Hors portée" });
    expect(slot("epee_du_destin").state).toBe("hors-portee");
  });
});

/* ------------------------------- armement ---------------------------------- */

describe("SPELL-04 — armer un sort", () => {
  it("ne coûte aucun PA, n'écrit aucun journal et garde l'état de jeu", () => {
    const battle = staged({ spellIds: ["pression", "epee_du_destin"], ap: 6 });
    const logLength = battle.log.length;
    state().selectSpell("epee_du_destin");
    expect(state().selectedSpellId).toBe("epee_du_destin");
    expect(heroAp(battleOrThrow())).toBe(6);
    expect(battleOrThrow().log).toHaveLength(logLength);
    expect(slot("epee_du_destin").state).toBe("selectionne");
  });

  it("refuse un sort à PA insuffisants : aucune sélection, aucun PA, aucun journal", () => {
    const battle = staged({ spellIds: ["pression", "epee_du_destin"], ap: 2 });
    state().selectSpell("epee_du_destin");
    expect(state().selectedSpellId).toBeNull();
    expect(battleOrThrow()).toBe(battle);
    expect(heroAp(battleOrThrow())).toBe(2);
  });

  it("refuse un sort hors tour : la timeline reste maîtresse", () => {
    const battle = staged({ spellIds: ["pression"], ap: 12 });
    const enemyHand = { ...battle, activeIndex: battle.order.indexOf(enemyId()) };
    useCombatStore.setState({ battle: enemyHand });
    state().selectSpell("pression");
    expect(state().selectedSpellId).toBeNull();
    expect(battleOrThrow()).toBe(enemyHand);
  });

  it("refuse un sort hors de portée : pas d'armement sans retour visuel", () => {
    staged({ spellIds: ["pression"], ap: 12, distance: 5 });
    state().selectSpell("pression");
    expect(state().selectedSpellId).toBeNull();
  });
});

/* -------------------------------- lancement -------------------------------- */

describe("SPELL-04 — c'est le sort armé qui part", () => {
  it("Épée du Destin frappe à ses valeurs (10 Feu, 4 PA) et nomme le sort", () => {
    staged({ spellIds: ["pression", "epee_du_destin"], ap: 12 });
    state().selectSpell("epee_du_destin");
    const performed = state().battleSpellAttack({ targetId: enemyId(), rng: () => 0 });
    const after = battleOrThrow();
    expect(performed).toBe(true);
    expect(enemyHp(after)).toBe(490);
    expect(heroAp(after)).toBe(8);
    expect(after.log.at(-1)).toContain("Épée du Destin");
    expect(state().selectedSpellId).toBeNull();
  });

  it("changer de sort entre deux lancers reste possible dans le même tour", () => {
    staged({ spellIds: ["pression", "epee_du_destin"], ap: 20 });
    state().selectSpell("pression");
    state().battleSpellAttack({ targetId: enemyId(), rng: () => 0 });
    expect(enemyHp(battleOrThrow())).toBe(492);
    state().selectSpell("epee_du_destin");
    expect(state().selectedSpellId).toBe("epee_du_destin");
    state().battleSpellAttack({ targetId: enemyId(), rng: () => 0 });
    const after = battleOrThrow();
    expect(enemyHp(after)).toBe(482);
    expect(heroAp(after)).toBe(13);
  });
});

/* ------------------------------ soin et buffs ------------------------------- */

describe("SPELL-04 — un soin armé se lance sur soi", () => {
  it("rend son minimum (5 PV, 6 PA) et se désarme", () => {
    staged({ spellIds: ["pression", "epee_du_destin", "mot_curatif"], ap: 20, heroHp: 40 });
    state().selectSpell("mot_curatif");
    expect(slot("mot_curatif").state).toBe("selectionne");
    const performed = state().battleSpellAttack({ targetId: "player", rng: () => 0 });
    const after = battleOrThrow();
    expect(performed).toBe(true);
    expect(ofSide(after, "player").hp).toBe(45);
    expect(heroAp(after)).toBe(14);
    expect(after.log.at(-1)).toContain("soigne");
  });
});

/* --------------------------------- quotas ---------------------------------- */

describe("SPELL-04 — quotas après changement de sort", () => {
  it("cooldown: 2 et castsPerTurn: 1 ferment leur case sans bloquer les autres sorts", () => {
    staged({ spellIds: ["fer_spell_projection_de_mazout", "fer_spell_lancer_decrou"], ap: 20, distance: 4 });
    state().selectSpell("fer_spell_projection_de_mazout");
    state().battleSpellAttack({ targetId: enemyId(), rng: () => 0 });
    expect(slot("fer_spell_projection_de_mazout")).toMatchObject({
      state: "quota-epuise",
      disabled: true,
      badge: "Recharge (3)",
    });
    state().selectSpell("fer_spell_projection_de_mazout");
    expect(state().selectedSpellId).toBeNull();
    state().selectSpell("fer_spell_lancer_decrou");
    expect(state().selectedSpellId).toBe("fer_spell_lancer_decrou");
    state().battleSpellAttack({ targetId: enemyId(), rng: () => 0 });
    expect(enemyHp(battleOrThrow())).toBe(500 - 5 - 9);
  });

  it("la recharge se rouvre au tour annoncé par le moteur", () => {
    staged({ spellIds: ["fer_spell_projection_de_mazout"], ap: 20, distance: 4 });
    state().selectSpell("fer_spell_projection_de_mazout");
    state().battleSpellAttack({ targetId: enemyId(), rng: () => 0 });
    const closed = battleOrThrow();
    for (const turn of [2, 3]) {
      useCombatStore.setState({ battle: { ...closed, turn } });
      expect(slot("fer_spell_projection_de_mazout").disabled).toBe(true);
    }
    useCombatStore.setState({ battle: { ...closed, turn: 4 } });
    expect(slot("fer_spell_projection_de_mazout").state).toBe("disponible");
  });
});

/* ----------------------------------- UI ------------------------------------ */

function buttonOf(html: string, text: string): string {
  const match = new RegExp(`<button[^>]*>(?:(?!</button>).)*${text}(?:(?!</button>).)*</button>`, "s").exec(html);
  if (match === null) throw new Error(`bouton « ${text} » absent`);
  return match[0];
}

describe("SPELL-04 — la barre et le panneau reflètent l'état réel", () => {
  it("la case Bond est rendue désactivée et nomme la téléportation", () => {
    const battle = openRoom();
    const html = renderToStaticMarkup(createElement(BattleSpellSlotsView, { battle, selectedSpellId: null, spells }));
    const bond = buttonOf(html, "Bond");
    expect(bond).toContain("disabled");
    expect(bond).toContain("Téléportation pas encore gérée en salle");
  });

  it("un soin armé remplace l'attaque des ennemis par un bouton sur le héros", () => {
    const battle = staged({ spellIds: ["pression", "mot_curatif"], ap: 20, heroHp: 40 });
    const html = renderToStaticMarkup(
      createElement(CombatantList, {
        views: battleViewModel(battle),
        attack: battleAttackButton(battle, "mot_curatif"),
        self: battleSelfButton(battle, "mot_curatif"),
        onAttack: () => undefined,
      }),
    );
    expect(html).toContain("Se soigner (6 PA)");
    expect(buttonOf(html, "Soin armé")).toContain("disabled");
  });
});

/* --------------------------- changement de tour ---------------------------- */

/** Deux pas de timeline : héros → ennemi → héros (tour 2), aucun sort armé. */
function finishTurn(): BattleState {
  state().advanceBattleTurn();
  state().advanceBattleTurn();
  return battleOrThrow();
}

describe("SPELL-04 — le changement de tour restaure la portée par défaut", () => {
  it("Épée du Destin (1–3) rendue à Pression (1–2) : la cible à 3 cases n'est plus attaquable", () => {
    orderedDuel({ spellIds: ["pression", "epee_du_destin"], ap: 12, distance: 3 });
    state().selectSpell("epee_du_destin");
    expect(battleOrThrow().castRange).toEqual({ min: 1, max: 3, requiresLos: true });
    const after = finishTurn();
    expect(state().selectedSpellId).toBeNull();
    expect(after.castRange).toEqual({ min: 1, max: 2, requiresLos: true });
    const target = battleViewModel(after).find((view) => view.id === enemyId());
    expect(target?.blockedReason).toBe("out-of-range");
    expect(target?.isTargetable).toBe(false);
    const views = battleViewModel(after);
    const html = renderToStaticMarkup(
      createElement(CombatantList, { views, attack: battleAttackButton(after), onAttack: () => undefined }),
    );
    expect(html).not.toContain("Attaquer");
  });

  it("Mot Curatif (0–0) rendue à Pression (1–2) : l'ennemi adjacent redevient ciblable", () => {
    orderedDuel({ spellIds: ["pression", "mot_curatif"], ap: 20, distance: 1 });
    state().selectSpell("mot_curatif");
    expect(battleOrThrow().castRange).toEqual({ min: 0, max: 0, requiresLos: false });
    const after = finishTurn();
    expect(state().selectedSpellId).toBeNull();
    expect(after.castRange).toEqual({ min: 1, max: 2, requiresLos: true });
    const target = battleViewModel(after).find((view) => view.id === enemyId());
    expect(target?.blockedReason).toBeNull();
    expect(target?.isTargetable).toBe(true);
  });

});

describe("SPELL-04 — ouvrir une salle neuve désarme le sort précédent", () => {
  it("la salle suivante repart sans sort armé et à la portée du défaut", () => {
    staged({ spellIds: ["pression", "epee_du_destin"], ap: 12 });
    state().selectSpell("epee_du_destin");
    expect(state().selectedSpellId).toBe("epee_du_destin");
    state().startDungeonRoom({ room: roomOne() });
    expect(state().selectedSpellId).toBeNull();
    expect(battleOrThrow().castRange).toEqual({ min: 1, max: 2, requiresLos: true });
  });
});

/* ------------------------------- 1v1 legacy -------------------------------- */

function legacyCombat(): CombatState {
  return initCombat({
    map: parseAsciiMap(mustFind(maps, "ferraille_plage_01").grid),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "fer_rat_de_cale"),
    spells,
  });
}

describe("SPELL-04 — le 1v1 legacy ne bouge pas", () => {
  it("garde son dock et sa sélection de sort", () => {
    const combat = legacyCombat();
    useCombatStore.setState({ battle: null, combat, mode: "combat", selectedSpellId: null });
    expect(dockSurface({ mode: "combat", combat, battle: null })).toBe("legacy");
    state().selectSpell("epee_du_destin");
    expect(state().selectedSpellId).toBe("epee_du_destin");
    expect(state().combat?.player.ap).toBe(combat.player.ap);
  });
});
