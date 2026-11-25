import type { BattleState, CombatantLike } from "../engine/multiCombat";
import type { FloatingEvent } from "../engine/combat";

/**
 * Verbe d'une action de salle, lu dans le journal du moteur. `hit` n'est pas une
 * action : c'est la **réaction** de la cible, dérivée de `targetId` par le rendu.
 */
export type BattleActionKind = "attack" | "spell" | "move";

/**
 * Dernière action lisible d'une salle, **dérivée du journal existant** : aucun
 * second historique n'est créé, aucune règle de combat n'est recalculée.
 */
export interface BattleLastAction {
  readonly kind: BattleActionKind;
  readonly actorId: string;
  readonly targetId?: string;
  /** Tour du combat au moment du rendu : le journal du moteur ne porte pas le tour. */
  readonly at: number;
  /** Clé de rejeu : index de la ligne, croît même quand l'action identique se répète. */
  readonly signature: string;
}

interface ActionLine {
  index: number;
  line: string;
}

const MOVE_MARKER = " se déplace de ";
const HIT_MARKER = " frappe ";
const SPELL_MARKER = " avec ";
const TELEPORT_MARKER = " se téléporte";
const TARGET_END_MARKERS = [" avec ", " (critique)", " : "];

function hitKind(line: string): BattleActionKind {
  return line.includes(SPELL_MARKER) ? "spell" : "attack";
}

/** Verbe de la ligne ; `null` pour une ouverture, un refus ou un dégagement. */
function kindOf(line: string): BattleActionKind | null {
  if (line.includes(MOVE_MARKER)) return "move";
  if (line.includes(TELEPORT_MARKER)) return "spell";
  return line.includes(HIT_MARKER) ? hitKind(line) : null;
}

/** Dernière ligne d'action : les refus journalisés après elle ne la remplacent pas. */
function lastActionLine(log: readonly string[]): ActionLine | null {
  for (let index = log.length - 1; index >= 0; index -= 1) {
    const line = log[index];
    if (line !== undefined && kindOf(line) !== null) return { index, line };
  }
  return null;
}

function byNameLength(a: CombatantLike, b: CombatantLike): number {
  return b.name.length - a.name.length;
}

/** Acteur par préfixe de nom ; le nom le plus long gagne (aucun préfixe ambigu). */
function actorOf(state: BattleState, line: string): CombatantLike | null {
  const candidates = [...state.combatants].sort(byNameLength);
  return candidates.find((entry) => line.startsWith(`${entry.name} `)) ?? null;
}

/** Nom de la cible entre `frappe ` et ` avec ` / ` (critique)` / ` : `. */
function targetName(line: string, actorName: string): string | null {
  const rest = line.slice(`${actorName}${HIT_MARKER}`.length);
  const ends = TARGET_END_MARKERS.map((marker) => rest.indexOf(marker)).filter((index) => index >= 0);
  const cut = ends.length === 0 ? rest.length : Math.min(...ends);
  return rest.slice(0, cut);
}

function namedTarget(state: BattleState, name: string | null): CombatantLike | null {
  if (name === null) return null;
  return state.combatants.find((entry) => entry.name === name) ?? null;
}

/** Dernier coup reçu, `null` tant que le tampon est vide. */
function lastFloat(state: BattleState): FloatingEvent | null {
  const floats = state.floats ?? [];
  return floats[floats.length - 1] ?? null;
}

/** Le nombre flottant porte l'id exact, même si deux monstres ont le même nom. */
function floatTarget(state: BattleState): CombatantLike | null {
  const event = lastFloat(state);
  if (event === null) return null;
  return state.combatants.find((entry) => entry.id === event.targetId) ?? null;
}

function targetOf(state: BattleState, line: string, actor: CombatantLike): CombatantLike | null {
  const named = namedTarget(state, targetName(line, actor.name));
  const floated = floatTarget(state);
  if (floated === null || named === null) return named;
  return floated.name === named.name ? floated : named;
}

function actionFor(state: BattleState, found: ActionLine, kind: BattleActionKind): BattleLastAction | null {
  const actor = actorOf(state, found.line);
  if (actor === null) return null;
  const target = kind === "move" ? undefined : targetOf(state, found.line, actor);
  return { kind, actorId: actor.id, targetId: target?.id, at: state.turn, signature: `log-${found.index}` };
}

/** Dernière action d'une salle de donjon, ou `null` tant que le journal n'en porte aucune. */
export function lastActionFromBattle(state: BattleState): BattleLastAction | null {
  const found = lastActionLine(state.log);
  if (found === null) return null;
  const kind = kindOf(found.line);
  if (kind === null) return null;
  return actionFor(state, found, kind);
}
