import type { Position } from "../grid";
import { buildGroup } from "./groups";
import type { ExplorationState, InitExplorationInput, MonsterGroup } from "./types";

const INIT_LOG = "Le héros arrive sur la carte.";

function requireSpawn(spawns: Position[], label: string): Position {
  const spawn = spawns[0];
  if (spawn === undefined) throw new Error(`exploration: aucun placement ${label}`);
  return spawn;
}

/**
 * Une carte d'extérieur peut ne porter aucun `M` : les monstres viennent de
 * `data/spawns.yaml`, pas de la grille. Sans emplacement, aucun groupe n'est
 * posé — jamais une exception qui rendrait la carte injouable.
 */
function monsterGroupsFor(input: InitExplorationInput): MonsterGroup[] {
  const spawn = input.map.monsterSpawns[0];
  return spawn === undefined ? [] : [buildGroup(input, "group-1", spawn)];
}

export function initExploration(input: InitExplorationInput): ExplorationState {
  const playerPos = requireSpawn(input.map.playerSpawns, "joueur (P)");
  return { map: input.map, playerPos, monsterGroups: monsterGroupsFor(input), log: [INIT_LOG] };
}
