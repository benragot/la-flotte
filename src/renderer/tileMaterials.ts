import type { CellType } from "../schemas/mapSchema";
import { hashUnit } from "./cellHash";

/** Matériaux de sol dessinés procéduralement, jamais des aplats uniformes. */
export type TileMaterial = "sable" | "galets" | "eau" | "ponton" | "pierre";

export const MATERIAL_KINDS: readonly TileMaterial[] = ["sable", "galets", "eau", "ponton", "pierre"];

/** Palette : sable clair, galets gris-beige, eau bleu-vert, planches, pierre. */
export const MATERIAL_COLORS: Record<TileMaterial, number> = {
  sable: 0xd8bd82,
  galets: 0xb7a98c,
  eau: 0x2e7d86,
  ponton: 0x8b6a43,
  pierre: 0x6f7883,
};

/** Deux tons d'eau alternés par case, comme la mer de Dofus 1.29. */
export const WATER_TONES: readonly [number, number] = [0x2e7d86, 0x2a6f7c];

export function waterTone(x: number, y: number): number {
  return (x + y) % 2 === 0 ? WATER_TONES[0] : WATER_TONES[1];
}

function groundMaterial(nearWater: boolean, isPontoon: boolean): TileMaterial {
  if (isPontoon) return "ponton";
  return nearWater ? "galets" : "sable";
}

/** Matériau d'une case : mur > eau > ponton > galets de rivage > sable. */
export function materialAt(cell: CellType, nearWater: boolean, isPontoon: boolean): TileMaterial {
  if (cell === "#" || cell === "~") return cell === "#" ? "pierre" : "eau";
  return groundMaterial(nearWater, isPontoon);
}

function channel(color: number, shift: number): number {
  return (color >> shift) & 0xff;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/** Décale les trois canaux d'un même delta, sans sortir de `[0, 255]`. */
export function shiftColor(color: number, delta: number): number {
  const red = clampByte(channel(color, 16) + delta);
  const green = clampByte(channel(color, 8) + delta);
  const blue = clampByte(channel(color, 0) + delta);
  return (red << 16) | (green << 8) | blue;
}

/** Teinte finale d'une case : ton d'eau alterné ou matériau nu, légèrement varié. */
export function groundColor(material: TileMaterial, x: number, y: number): number {
  const base = material === "eau" ? waterTone(x, y) : MATERIAL_COLORS[material];
  const delta = Math.round((hashUnit(x, y, 11) - 0.5) * 16);
  return shiftColor(base, delta);
}
