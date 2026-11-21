export interface DamageInput {
  base: number;
  stat: number;
  percentDmg?: number;
  flatDmg?: number;
  flatRes?: number;
  armor?: number;
  pctRes?: number;
  isPlayer?: boolean;
}

const PLAYER_PCT_RES_CAP = 50;

function scaledBase(base: number, stat: number, percentDmg: number): number {
  return Math.floor((base * (100 + Math.max(0, stat) + percentDmg)) / 100);
}

function rawDamage(input: DamageInput): number {
  const scaled = scaledBase(input.base, input.stat, input.percentDmg ?? 0);
  return scaled + (input.flatDmg ?? 0);
}

function flatReduction(input: DamageInput): number {
  return (input.flatRes ?? 0) + (input.armor ?? 0);
}

function effectivePctResistance(input: DamageInput): number {
  const pct = input.pctRes ?? 0;
  return input.isPlayer === true ? Math.min(PLAYER_PCT_RES_CAP, pct) : pct;
}

function applyPercentResistance(amount: number, pctRes: number): number {
  return Math.max(0, Math.floor((amount * (100 - pctRes)) / 100));
}

export function computeDamage(input: DamageInput): number {
  const afterFlat = Math.max(0, rawDamage(input) - flatReduction(input));
  return applyPercentResistance(afterFlat, effectivePctResistance(input));
}
