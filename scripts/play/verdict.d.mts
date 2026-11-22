/**
 * Types du harnais `scripts/play/` (JavaScript pur, non compilé).
 * `tsc` résout `verdict.mjs` vers ce fichier : les tests unitaires vérifient
 * la logique de verdict sans dupliquer le code de production.
 */

export interface ConsoleEntry {
  step: string;
  level: string;
  text: string;
  location: string | null;
}

export interface PageErrorEntry {
  step: string;
  message: string;
  stack: string | null;
}

export interface RequestEntry {
  step: string;
  url: string;
  status: number | null;
  resourceType: string;
  failure: string | null;
}

export interface Recorder {
  step: string;
  console: ConsoleEntry[];
  pageErrors: PageErrorEntry[];
  failedRequests: RequestEntry[];
}

export type StepStatus = "ok" | "skipped" | "failed";

/** Forme minimale d'une étape jouée, telle que `runner.mjs` l'enregistre. */
export interface StepOutcome {
  step: string;
  status: StepStatus;
  skipId?: string | null;
  /** Zones clés absentes du DOM : leur absence fait échouer la session. */
  missing?: readonly string[];
  /** Captures produites par l'étape (au moins une par étape en pratique). */
  screenshots?: readonly string[];
}

/** Zones absentes regroupées par étape, pour `errors.json` et le résumé. */
export interface MissingZones {
  step: string;
  zones: string[];
}

export interface Buckets {
  pageErrors: PageErrorEntry[];
  consoleErrors: ConsoleEntry[];
  documentedConsoleErrors: ConsoleEntry[];
  failedRequests: RequestEntry[];
  ignoredRequests: RequestEntry[];
  warnings: ConsoleEntry[];
}

export interface Counts {
  pageErrors: number;
  consoleErrors: number;
  failedRequests: number;
  documentedConsoleErrors: number;
  ignoredRequests: number;
  warnings: number;
  failedSteps: number;
  undocumentedSkips: number;
  missingZones: number;
}

export interface Verdict {
  code: 0 | 1;
  reasons: string[];
  counts: Counts;
  missing: MissingZones[];
  /** Non bloquant : signale un coût suspect (readback par frame), jamais un échec. */
  advisories: string[];
}

export type DocumentedSkips = Record<string, string>;

export const DOCUMENTED_RULES: ReadonlyArray<{ pattern: string; reason: string }>;
export const IGNORED_RULES: ReadonlyArray<{ pattern: string; reason: string }>;
export const DOCUMENTED_SKIPS: DocumentedSkips;

export function classify(recorder: Recorder): Buckets;

export function verdict(
  buckets: Buckets,
  steps?: readonly StepOutcome[],
  documentedSkips?: DocumentedSkips,
): Verdict;
