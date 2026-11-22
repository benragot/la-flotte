import type { Position } from "../grid";
import { createSeededRng, placeGroups } from "./placement";
import type { Placement } from "./placement";
import type { ExplorationState, InitExplorationInput, SpawnPlan } from "./types";

const INIT_LOG = "Le héros arrive sur la carte.";

/** Graine du chemin sans plan (carte d'extérieur sans zone) : aucun aléa. */
const LEGACY_SEED = 0;

function requireSpawn(spawns: Position[], label: string): Position {
  const spawn = spawns[0];
  if (spawn === undefined) throw new Error(`exploration: aucun placement ${label}`);
  return spawn;
}

/**
 * Zone muette : un groupe d'un monstre, exactement le comportement d'avant la
 * donnée `groups`. Le vivier d'une entrée unique ne tire jamais au hasard.
 */
function legacyPlan(input: InitExplorationInput): SpawnPlan {
  const roster = [{ monsterId: input.monsterId, monsterName: input.monsterName, level: input.level, weight: 1 }];
  return { groups: { min: 1, max: 1 }, members: { min: 1, max: 1 }, roster };
}

/** Carte trop petite : on place ce qu'on peut, mais le joueur est prévenu. */
function shortageLine(placement: Placement): string | null {
  const placed = placement.groups.length;
  if (placed >= placement.requested) return null;
  return `Placement incomplet : ${placed} groupe(s) sur ${placement.requested} — la carte est trop petite.`;
}

function logOf(line: string | null): string[] {
  return line === null ? [INIT_LOG] : [INIT_LOG, line];
}

/**
 * Cases d'entrée = départ `P` de la carte + sorties fournies par l'appelant.
 * La disposition ne dépend QUE de la carte et de la graine : revenir par une
 * autre sortie ne déplace aucun groupe.
 */
function entryPointsOf(input: InitExplorationInput, playerPos: Position): Position[] {
  return [playerPos, ...(input.safeCells ?? [])];
}

/**
 * Une carte d'extérieur peut ne porter aucun `M` : les monstres viennent de
 * `data/spawns.yaml`, pas de la grille. Le plan de la zone décide du compte et
 * du vivier ; sans plan, un seul groupe suffit.
 */
export function initExploration(input: InitExplorationInput): ExplorationState {
  const playerPos = requireSpawn(input.map.playerSpawns, "joueur (P)");
  const plan = input.plan ?? legacyPlan(input);
  const rng = input.rng ?? createSeededRng(LEGACY_SEED);
  const entryPoints = entryPointsOf(input, playerPos);
  const placement = placeGroups({ map: input.map, entryPoints, plan, rng });
  const log = logOf(shortageLine(placement));
  return { map: input.map, playerPos, monsterGroups: placement.groups, log };
}
