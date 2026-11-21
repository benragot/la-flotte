import type { CellType } from "../../schemas/mapSchema";

export interface Position {
  x: number;
  y: number;
}

export interface AsciiMap {
  width: number;
  height: number;
  cells: CellType[][];
  playerSpawns: Position[];
  monsterSpawns: Position[];
}

const WALKABLE: Record<CellType, boolean> = {
  ".": true,
  "P": true,
  "M": true,
  "#": false,
  "~": false,
};

const SIGHT_BLOCKING: Record<CellType, boolean> = {
  ".": false,
  "P": false,
  "M": false,
  "#": true,
  "~": false,
};

export function isWalkable(cell: CellType): boolean {
  return WALKABLE[cell];
}

export function isSightBlocking(cell: CellType): boolean {
  return SIGHT_BLOCKING[cell];
}

export function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function getCell(map: AsciiMap, position: Position): CellType | undefined {
  return map.cells[position.y]?.[position.x];
}

export function isWalkableCell(map: AsciiMap, position: Position): boolean {
  const cell = getCell(map, position);
  return cell !== undefined && isWalkable(cell);
}

function toCells(rows: string[]): CellType[][] {
  return rows.map((row) => [...row] as CellType[]);
}

function findPositions(cells: CellType[][], target: CellType): Position[] {
  const positions: Position[] = [];
  cells.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (cell === target) positions.push({ x, y });
    });
  });
  return positions;
}

export function parseAsciiMap(rows: string[]): AsciiMap {
  const cells = toCells(rows);
  return {
    width: cells[0]?.length ?? 0,
    height: cells.length,
    cells,
    playerSpawns: findPositions(cells, "P"),
    monsterSpawns: findPositions(cells, "M"),
  };
}
