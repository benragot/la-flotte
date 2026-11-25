import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CombatState } from "../../src/engine/combatLoop/types";
import { initCombat } from "../../src/engine/combatLoop/init";
import { createHero } from "../../src/engine/createHero";
import type { CombatantLike } from "../../src/engine/multiCombat";
import type { BattleState } from "../../src/engine/multiCombat";
import type { Position } from "../../src/engine/grid";
import { parseAsciiMap, rangeDistance, samePosition, isWalkableCell } from "../../src/engine/grid";
import { allPositions } from "../../src/engine/combatLoop/cells";
import { parseClassesYaml } from "../../src/schemas/classSchema";
import type { DungeonDef } from "../../src/schemas/dungeonSchema";
import { parseDungeonsYaml } from "../../src/schemas/dungeonSchema";
import { parseMapsYaml } from "../../src/schemas/mapSchema";
import { parseMonstersYaml } from "../../src/schemas/monsterSchema";
import { parseSpellsYaml } from "../../src/schemas/spellSchema";
import * as battleSpellsModule from "../../src/store/battleSpells";
import { battleSpellSlots } from "../../src/store/battleSpells";
import { useCombatStore } from "../../src/store/useCombatStore";
import { useGameStore } from "../../src/store/useGameStore";
import { BattleSpellSlotsView } from "../../src/ui/components/BattleSpellSlots";
import SpellSlots from "../../src/ui/components/SpellSlots";
import { dockHidden, dockSurface } from "../../src/ui/dockGate";
import { shortcutForKey } from "../../src/ui/useGlobalShortcuts";

/**
 * DEC-12, étape 3b-1 : le combat d'exploration unifié doit exposer **les mêmes
 * sorts** que le 1v1, sans réécrire une règle. La barre lit `BattleState` via un
 * sélecteur pur, les deux chemins partagent la même présentation, et un sort
 * non lançable n'est jamais sélectionnable (pas de clic mort, exigence #156).
 */
const read = (file: string) => readFileSync(join(process.cwd(), "data", file), "utf8");
const classes = parseClassesYaml(read("classes.yaml"));
const maps = parseMapsYaml(read("maps.yaml"));
const monsters = parseMonstersYaml(read("monsters.yaml"));
const spells = parseSpellsYaml(read("spells.yaml"));
const dungeons = parseDungeonsYaml(read("dungeons.yaml"));

function mustFind<T extends { id: string }>(list: readonly T[], id: string): T {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`${id} absent de data/`);
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

function combatantOf(input: Partial<CombatantLike> & { id: string; side: CombatantLike["side"] }): CombatantLike {
  const base = {
    name: input.id,
    level: 1,
    hp: 100,
    maxHp: 100,
    ap: 6,
    maxAp: 6,
    mp: 3,
    maxMp: 3,
    position: { x: 0, y: 0 },
    stats: zeroStats(),
    resistances: zeroResistances(),
    spellIds: [],
    initiative: 10,
  };
  return { ...base, ...input };
}

const HERO_CELL = { x: 0, y: 0 };
const ENEMY_CELL = { x: 1, y: 0 };

function duelBattle(overrides: Partial<BattleState> = {}): BattleState {
  const hero = combatantOf({
    id: "hero",
    side: "player",
    ap: 12,
    maxAp: 12,
    spellIds: ["pression", "epee_du_destin", "bond", "gueule_de_bois", "glyphe_agressif"],
    position: HERO_CELL,
  });
  const enemy = combatantOf({ id: "enemy", side: "enemy", hp: 300, maxHp: 300, position: ENEMY_CELL });
  return { turn: 1, order: ["hero", "enemy"], activeIndex: 0, combatants: [hero, enemy], log: [], ...overrides };
}

function slot(str: string, slots: ReturnType<typeof battleSpellSlots>) {
  const found = slots.find((entry) => entry.spellId === str);
  if (found === undefined) throw new Error(`sort ${str} absent des slots`);
  return found;
}

/** `null` = la valeur n'est pas un sort du héros : l'appel doit être refusé. */
function slotOrNull(str: string, slots: ReturnType<typeof battleSpellSlots>) {
  return slots.find((entry) => entry.spellId === str) ?? null;
}

describe("battleSpellSlots — sorts disponibles", () => {
  const input = { spells, selectedSpellId: null };

  it("un sort payable et hors quota est disponible, avec son coût PA", () => {
    const slots = battleSpellSlots({ ...input, battle: duelBattle() });
    expect(slot("pression", slots)).toMatchObject({ apCost: 3, state: "disponible", disabled: false });
  });

  it("un sort sélectionné porte l'état selectionne", () => {
    const slots = battleSpellSlots({ ...input, battle: duelBattle(), selectedSpellId: "pression" });
    expect(slot("pression", slots).state).toBe("selectionne");
  });

  it("PA insuffisants : le sort est désactivé et nommé", () => {
    const battle = duelBattle();
    const hero = battle.combatants[0] as CombatantLike;
    const slots = battleSpellSlots({ ...input, battle: { ...battle, combatants: [{ ...hero, ap: 2 }, battle.combatants[1] as CombatantLike] } });
    expect(slot("pression", slots)).toMatchObject({ state: "pa-insuffisants", disabled: true });
  });

  it("quota épuisé : `castsPerTurn` déjà consommé sur ce tour", () => {
    const hero = combatantOf({ id: "hero", side: "player", ap: 12, spellIds: ["fer_spell_coup_daile_gras"] });
    const enemy = combatantOf({ id: "enemy", side: "enemy", position: ENEMY_CELL });
    const usage = { "hero:fer_spell_coup_daile_gras": { casts: 1, turn: 1, readyAt: 0 } };
    const battle: BattleState = { turn: 1, order: ["hero", "enemy"], activeIndex: 0, combatants: [hero, enemy], log: [], spellUsage: usage };
    expect(slot("fer_spell_coup_daile_gras", battleSpellSlots({ ...input, battle }))).toMatchObject({
      state: "quota-epuise",
      disabled: true,
    });
  });
});

describe("battleSpellSlots — verrous et exclusions", () => {
  const input = { spells, selectedSpellId: null };

  it("pas son tour : la timeline donne la main au monstre", () => {
    const slots = battleSpellSlots({ ...input, battle: duelBattle({ activeIndex: 1 }) });
    expect(slots.map((entry) => entry.state)).toEqual(["pas-son-tour", "pas-son-tour"]);
    expect(slots.every((entry) => entry.disabled)).toBe(true);
  });

  it("salle terminée : plus aucun ennemi vivant, tous les sorts sont clos", () => {
    const battle = duelBattle();
    const enemy = battle.combatants[1] as CombatantLike;
    const slots = battleSpellSlots({ ...input, battle: { ...battle, combatants: [battle.combatants[0] as CombatantLike, { ...enemy, hp: 0 }] } });
    expect(slots.map((entry) => entry.state)).toEqual(["salle-terminee", "salle-terminee"]);
  });

  it("exclut les sorts non implémentés et ceux que le clic unifié ne sait pas résoudre", () => {
    const slots = battleSpellSlots({ ...input, battle: duelBattle() });
    expect(slots.map((entry) => entry.spellId)).toEqual(["pression", "epee_du_destin"]);
    expect(slotOrNull("bond", slots)).toBeNull();
    expect(slotOrNull("gueule_de_bois", slots)).toBeNull();
    expect(slotOrNull("glyphe_agressif", slots)).toBeNull();
  });
});

/* ------------------------------- store unifié ------------------------------- */

const HERO = { name: "Balthazar", classId: "iop" };
const STEADY_RNG = () => 0.2;

function unified(): void {
  vi.stubEnv("VITE_COMBAT_ENGINE", "unified");
}

function state() {
  return useCombatStore.getState();
}

function newSession(): void {
  useGameStore.getState().resetGame();
  useGameStore.getState().createCharacter(HERO);
  state().resetCombat();
  state().startExploration(STEADY_RNG);
}

function groupCell(): Position {
  const group = state().exploration?.monsterGroups[0];
  if (group === undefined) throw new Error("aucun groupe d'exploration");
  return group.pos;
}

function enteredBattle(): BattleState {
  state().clickCell(groupCell());
  const battle = state().battle;
  if (battle === null) throw new Error("aucun battle unifié");
  return battle;
}

function adjacent(cell: Position): Position {
  return { x: cell.x + 1, y: cell.y };
}

/**
 * Duel contrôlé : héros sans force ni équipement, monstre sans résistance, à
 * portée de Pression. Le jet `rng: () => 0` donne exactement 8 dégâts (min de
 * `data/spells.yaml`), sans géométrie pour isoler la règle du sort.
 */
function stageDuel(ap: number): BattleState {
  const base = enteredBattle();
  const hero = base.combatants.find((entry) => entry.side === "player");
  const enemy = base.combatants.find((entry) => entry.side === "enemy");
  if (hero === undefined || enemy === undefined) throw new Error("duel incomplet");
  const battle: BattleState = {
    ...base,
    map: undefined,
    turn: 1,
    spellUsage: {},
    combatants: [
      { ...hero, ap, maxAp: 12, stats: zeroStats(), percentDmg: 0, spellIds: ["pression", "epee_du_destin", "gueule_de_bois"] },
      { ...enemy, position: adjacent(hero.position), hp: 300, maxHp: 300, resistances: zeroResistances(), armor: 0, percentDmg: 0 },
    ],
    activeIndex: base.order.indexOf(hero.id),
  };
  useCombatStore.setState({ battle });
  return battle;
}

function ofSide(battle: BattleState, side: "player" | "enemy"): CombatantLike {
  const found = battle.combatants.find((entry) => entry.side === side);
  if (found === undefined) throw new Error(`combattant ${side} absent`);
  return found;
}

/** Main au monstre : la timeline désigne l'ennemi, sans toucher aux positions. */
function withEnemyHand(battle: BattleState): BattleState {
  return { ...battle, activeIndex: battle.order.indexOf(ofSide(battle, "enemy").id) };
}

/** Monstre volontairement hors de portée de Pression (1–2), carte conservée. */
function stageDistantEnemy(): BattleState {
  const base = enteredBattle();
  const hero = ofSide(base, "player");
  const enemy = ofSide(base, "enemy");
  const far = { x: hero.position.x + 5, y: hero.position.y };
  const combatants = [{ ...hero, ap: 12, spellIds: ["pression"] }, { ...enemy, position: far, hp: 300, maxHp: 300 }];
  const battle = { ...base, activeIndex: base.order.indexOf(hero.id), combatants };
  useCombatStore.setState({ battle });
  return battle;
}

describe("exploration unifiée — sélection d'un sort", () => {
  beforeEach(() => {
    unified();
    newSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("un sort non lançable n'est jamais sélectionnable (pas de clic mort)", () => {
    stageDuel(3);
    state().selectSpell("epee_du_destin");
    expect(state().selectedSpellId).toBeNull();
    state().selectSpell("pression");
    expect(state().selectedSpellId).toBe("pression");
    state().selectSpell("epee_du_destin");
    expect(state().selectedSpellId).toBe("pression");
  });

  it("un sort non implémenté ne se sélectionne pas", () => {
    stageDuel(12);
    state().selectSpell("gueule_de_bois");
    expect(state().selectedSpellId).toBeNull();
  });
});

describe("exploration unifiée — lancement d'un sort", () => {
  beforeEach(() => {
    unified();
    newSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("un sort armé puis cliqué inflige exactement ses dégâts et consomme ses PA", () => {
    stageDuel(12);
    state().selectSpell("pression");
    expect(state().selectedSpellId).toBe("pression");
    const before = state().battle as BattleState;
    state().battleMove({ to: ofSide(before, "enemy").position, rng: () => 0 });
    const after = state().battle as BattleState;
    expect(ofSide(after, "enemy").hp).toBe(292);
    expect(ofSide(after, "player").ap).toBe(9);
    expect(state().selectedSpellId).toBeNull();
  });
});

describe("exploration unifiée — changement de tour et refus", () => {
  beforeEach(() => {
    unified();
    newSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("le pas de cadence de useCombatBeat désarme le sort armé", () => {
    stageDuel(12);
    state().selectSpell("pression");
    const armed = state().battle as BattleState;
    state().playEnemyStepOnce({ rng: () => 0 });
    expect(state().battle).not.toBe(armed);
    expect(state().selectedSpellId).toBeNull();
  });

  it("un refus géométrique (hors portée) conserve le sort armé", () => {
    const battle = stageDistantEnemy();
    state().selectSpell("pression");
    state().battleMove({ to: ofSide(battle, "enemy").position, rng: () => 0 });
    const after = state().battle as BattleState;
    expect(state().selectedSpellId).toBe("pression");
    expect(after.log.at(-1)).toContain("hors portée");
    expect(ofSide(after, "enemy").hp).toBe(300);
    expect(ofSide(after, "player").ap).toBe(12);
  });
});

describe("exploration unifiée — garde de camp", () => {
  beforeEach(() => {
    unified();
    newSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("armedBattleSpell exige la main du héros", () => {
    const guard = battleSpellsModule.armedBattleSpell;
    expect(guard).toBeDefined();
    const armed = { battle: duelBattle(), spells, selectedSpellId: "pression" };
    expect(guard(armed)?.id).toBe("pression");
    const enemyHand = { ...armed.battle, activeIndex: 1 };
    expect(guard({ ...armed, battle: enemyHand })).toBeNull();
  });

  it("un clic sur le monstre pendant le tour adverse ne change rien", () => {
    const battle = stageDuel(12);
    state().selectSpell("pression");
    useCombatStore.setState({ battle: withEnemyHand(battle) });
    const before = state().battle;
    state().battleMove({ to: ofSide(battle, "enemy").position, rng: () => 0 });
    expect(state().battle).toBe(before);
    expect(state().selectedSpellId).toBe("pression");
  });
});

describe("raccourcis — la barre unifiée répond aux touches", () => {
  beforeEach(() => {
    unified();
    newSession();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("la touche 1 arme le premier sort de la barre unifiée", () => {
    stageDuel(12);
    const effect = shortcutForKey({ code: "Digit1" }, shortcutContext());
    expect(effect).not.toBeNull();
    effect?.();
    expect(state().selectedSpellId).toBe("pression");
  });

  it("aucune touche n'arme un sort non lançable", () => {
    stageDuel(0);
    expect(shortcutForKey({ code: "Digit1" }, shortcutContext())).toBeNull();
  });
});

function shortcutContext() {
  return {
    phase: "player_turn" as const,
    mode: "combat" as const,
    combat: null,
    battle: state().battle,
    selectedSpellId: state().selectedSpellId,
    selectSpell: state().selectSpell,
    endTurn: () => undefined,
  };
}

/* --------------------------------- portillon -------------------------------- */

function dungeonRoomOne() {
  const dungeon: DungeonDef = mustFind(dungeons, "fer_donjon_casse_vis_sans_fin");
  const room = dungeon.rooms[0];
  if (room === undefined) throw new Error("salle 1 absente");
  return room;
}

describe("dock — le combat unifié reçoit la barre, le donjon garde son dock", () => {
  it("un battle d'exploration unifié ouvre le dock de sorts", () => {
    const battle = duelBattle();
    const input = { mode: "combat" as const, combat: null, battle };
    expect(dockSurface(input)).toBe("unified-spells");
    expect(dockHidden(input)).toBe(true);
  });

  it("une salle de donjon (mode exploration, combat nul) garde son dock complet", () => {
    unified();
    newSession();
    state().startDungeonRoom({ room: dungeonRoomOne() });
    const battle = state().battle;
    expect(state().mode).toBe("exploration");
    expect(state().combat).toBeNull();
    const input = { mode: "exploration" as const, combat: state().combat, battle };
    expect(dockSurface(input)).toBe("legacy");
    expect(dockHidden(input)).toBe(false);
    vi.unstubAllEnvs();
  });
});

/* ------------------------- présentation partagée ---------------------------- */

function legacyCombat(): CombatState {
  const base = initCombat({
    map: parseAsciiMap(mustFind(maps, "ferraille_plage_01").grid),
    hero: createHero("Balthazar", mustFind(classes, "iop")),
    monster: mustFind(monsters, "fer_rat_de_cale"),
    spells,
  });
  return reachable(base);
}

/** Case libre à portée 1 du monstre : Pression y est lançable (« disponible »). */
function reachable(base: CombatState): CombatState {
  const enemy = base.enemy.position;
  const cell = allPositions(base.map).find((candidate) => {
    const free = isWalkableCell(base.map, candidate) && !samePosition(candidate, enemy);
    return free && rangeDistance(candidate, enemy) <= 1;
  });
  if (cell === undefined) throw new Error("aucune case libre à portée");
  return { ...base, player: { ...base.player, position: cell, ap: 12 } };
}

function slotButton(html: string, spellName: string): string {
  const match = new RegExp(`<button[^>]*>(?:(?!</button>).)*${spellName}(?:(?!</button>).)*</button>`, "s").exec(html);
  if (match === null) throw new Error(`case « ${spellName} » absente`);
  return match[0];
}

describe("barre de sorts — même présentation dans les deux chemins", () => {
  it("une case lançable rend exactement le même bouton qu'en 1v1", () => {
    const legacy = renderToStaticMarkup(createElement(SpellSlots, { combat: legacyCombat(), selectedSpellId: null }));
    const unifiedHtml = renderToStaticMarkup(
      createElement(BattleSpellSlotsView, { battle: duelBattle(), selectedSpellId: null, spells }),
    );
    expect(slotButton(unifiedHtml, "Pression")).toBe(slotButton(legacy, "Pression"));
  });

  it("une case à PA insuffisants rend la même face désactivée et la même cause", () => {
    const starved = { ...legacyCombat(), player: { ...legacyCombat().player, ap: 0 } };
    const legacy = renderToStaticMarkup(createElement(SpellSlots, { combat: starved, selectedSpellId: null }));
    const hero = duelBattle().combatants[0] as CombatantLike;
    const battle = duelBattle();
    const unifiedHtml = renderToStaticMarkup(
      createElement(BattleSpellSlotsView, {
        battle: { ...battle, combatants: [{ ...hero, ap: 0 }, battle.combatants[1] as CombatantLike] },
        selectedSpellId: null,
        spells,
      }),
    );
    expect(slotButton(unifiedHtml, "Pression")).toBe(slotButton(legacy, "Pression"));
  });
});
