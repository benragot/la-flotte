/**
 * Sélecteurs repris **tels quels** de `tests/ui/layout.spec.ts` et des
 * `aria-label` de `src/ui/` : le harnais ne réinvente aucun sélecteur, il ne
 * dépend donc pas de `data-testid` qui n'existent pas.
 */

export const CREATION_SHEET = 'section[aria-label="Création de personnage"]';
export const CREATION_TITLE = `${CREATION_SHEET} h1`;
export const CLASS_CARDS = `${CREATION_SHEET} button[aria-pressed]`;
export const CREATE_BUTTON = `${CREATION_SHEET} button:has-text("Créer")`;
export const IOP_CARD = `${CREATION_SHEET} button[aria-pressed]:has-text("Iop")`;

export const ARENA = 'main[aria-label="Terrain de combat"]';
export const ARENA_SECTION = 'section[aria-label="Zone jouable"]';
export const ARENA_CANVAS = `${ARENA} canvas`;

export const EXPLORATION_JOURNAL = 'aside[aria-label="Journal d’exploration"]';
export const EXPLORATION_BANNER = 'header:has-text("Mode Exploration")';
export const HERO_DOCK = '[role="group"][aria-label="Dock du héros"]';

export const ACCESS_INVENTORY = 'button:has-text("Inventaire")';
export const ACCESS_HERO_SHEET = 'button:has-text("Fiche perso")';
export const ACCESS_DUNGEONS = 'button:has-text("Donjons")';

export const SPELLS = 'section[aria-label="Sorts disponibles"]';
export const TURN_BUTTON = 'button:has-text("Passer")';
export const DUNGEON_END_TURN_BUTTON = 'button:has-text("Terminer le tour")';
export const TIMELINE = 'aside[aria-label="Ordre de jeu"]';
export const COMBAT_JOURNAL = 'section[aria-label="Journal de combat"]';
export const VITALS = 'section[aria-label="Ressources du héros"]';
/** Bandeau du HUD : il porte `Carte N · Tour N` et le libellé de phase. */
export const COMBAT_BANNER = 'header[data-zone="header"]';

export const DUNGEON_ENTRY_SHEET = 'section[aria-label="Donjons disponibles"]';
export const DUNGEON_REFUSAL = 'p[role="alert"][aria-label="Refus d’entrée"]';
export const BATTLE_PANEL = 'section[aria-label="Combat de salle"]';

export const INVENTORY = 'section[aria-label="Inventaire"]';
export const BACKPACK = 'ul[aria-label="Objets du sac"]';
export const BACKPACK_ITEM = `${BACKPACK} button`;
export const ITEM_DETAIL = 'section[aria-label="Détail de l’objet"]';

/** Zones mesurées à chaque étape, pour l'entrée `boxes` du rapport. */
export const STEP_SELECTORS = {
  "01-ecran-creation": {
    sheet: CREATION_SHEET,
    title: CREATION_TITLE,
    firstClassCard: CLASS_CARDS,
    createButton: CREATE_BUTTON,
  },
  "02-creation-iop": {
    arena: ARENA,
    arenaSection: ARENA_SECTION,
    journal: EXPLORATION_JOURNAL,
    dock: HERO_DOCK,
  },
  "03-exploration": {
    arena: ARENA,
    arenaSection: ARENA_SECTION,
    canvas: ARENA_CANVAS,
    journal: EXPLORATION_JOURNAL,
    banner: EXPLORATION_BANNER,
    dock: HERO_DOCK,
    accessInventory: ACCESS_INVENTORY,
    accessHeroSheet: ACCESS_HERO_SHEET,
    accessDungeons: ACCESS_DUNGEONS,
  },
  "04-combat-1v1": {
    arena: ARENA,
    banner: COMBAT_BANNER,
    spells: SPELLS,
    turnButton: TURN_BUTTON,
    timeline: TIMELINE,
    journal: COMBAT_JOURNAL,
    vitals: VITALS,
  },
  "05-combat-donjon": {
    arena: ARENA,
    battlePanel: BATTLE_PANEL,
    endTurnButton: DUNGEON_END_TURN_BUTTON,
  },
  "06-inventaire": {
    inventory: INVENTORY,
    backpack: BACKPACK,
    itemDetail: ITEM_DETAIL,
  },
};
