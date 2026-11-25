/**
 * Multiplicateurs de confort **dev uniquement** (XP et drop), lus depuis
 * `import.meta.env` hors du moteur : `src/engine/` reçoit la valeur en
 * paramètre et reste pur.
 *
 * Seul `mode === "development"` (serveur Vite) active le boost. Sous Vitest,
 * `DEV` vaut `true` mais `MODE` vaut « test » : les tests 1.29 restent à ×1.
 */
export interface DevMultipliers {
  xp: number;
  drop: number;
}

export interface DevEnv {
  mode: string;
  /** `import.meta.env.DEV` — informatif, jamais suffisant pour activer. */
  dev: boolean;
  xp?: string | number | undefined;
  drop?: string | number | undefined;
}

/** Réglage de dev, surchargeable par `VITE_DEV_XP_MULTIPLIER` / `..._DROP_MULTIPLIER`. */
const DEV_DEFAULT_MULTIPLIER = 10;

const NEUTRAL: DevMultipliers = { xp: 1, drop: 1 };

/** Une valeur absente ou invalide (`"abc"`, 0, négatif) retombe sur `fallback`. */
function parseMultiplier(raw: string | number | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function resolveDevMultipliers(env: DevEnv): DevMultipliers {
  if (env.mode !== "development") return NEUTRAL;
  return {
    xp: parseMultiplier(env.xp, DEV_DEFAULT_MULTIPLIER),
    drop: parseMultiplier(env.drop, DEV_DEFAULT_MULTIPLIER),
  };
}

function readEnv(): DevEnv {
  const env = import.meta.env;
  return {
    mode: env.MODE,
    dev: env.DEV,
    xp: env.VITE_DEV_XP_MULTIPLIER as string | undefined,
    drop: env.VITE_DEV_DROP_MULTIPLIER as string | undefined,
  };
}

/** Wrapper fin : lit l'environnement Vite, la logique vit dans la fonction pure. */
export function devMultipliers(): DevMultipliers {
  return resolveDevMultipliers(readEnv());
}
