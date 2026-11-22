import type { Position } from "../grid";
import { buildGroup } from "./groups";
import type { ExplorationState, InitExplorationInput } from "./types";

const INIT_LOG = "Le héros arrive sur la carte.";

function requireSpawn(spawns: Position[], label: string): Position {
  const spawn = spawns[0];
  if (spawn === undefined) throw new Error(`exploration: aucun placement ${label}`);
  return spawn;
}

export function initExploration(input: InitExplorationInput): ExplorationState {
  const playerPos = requireSpawn(input.map.playerSpawns, "joueur (P)");
  const monsterPos = requireSpawn(input.map.monsterSpawns, "monstre (M)");
  const group = buildGroup(input, "group-1", monsterPos);
  return { map: input.map, playerPos, monsterGroups: [group], log: [INIT_LOG] };
}
