/**
 * Hash entier déterministe d'une case. Le rendu ne tire jamais au hasard : le
 * grain du sable, les galets et l'eau dépendent uniquement de `(x, y, salt)`.
 */
function mix32(value: number): number {
  let hash = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function hashInt(x: number, y: number, salt = 0): number {
  const seed = Math.imul(x + 0x9e37, 0x85ebca6b) ^ Math.imul(y + 0x7f4a, 0xc2b2ae35);
  return mix32(seed ^ Math.imul(salt + 1, 0x27d4eb2f));
}

/** Hash normalisé dans `[0, 1)` : variation de teinte, jitter des motifs. */
export function hashUnit(x: number, y: number, salt = 0): number {
  return hashInt(x, y, salt) / 0x100000000;
}
