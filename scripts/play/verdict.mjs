/**
 * Verdict objectif du harnais. Le rapport est un instrument de diagnostic :
 * il ne « corrige » rien, il exige zéro erreur d'exécution.
 */

/**
 * Exceptions EXPLICITEMENT documentées, uniquement pour `console.error`.
 * Chacune est bornée par une expression et justifiée : la liste doit rester
 * courte et lisible, sinon elle masque de vraies régressions.
 */
const DOCUMENTED_CONSOLE_ERRORS = [
  {
    pattern: /Automatic fallback to software WebGL has been deprecated/i,
    reason: "Chromium headless sans GPU : Pixi obtient un contexte SwiftShader (--enable-unsafe-swiftshader).",
  },
];

/** Requêtes annulées par le scénario lui-même (navigation vers l'étape suivante). */
const IGNORED_REQUESTS = [
  { pattern: /ERR_ABORTED/, reason: "requête annulée par une navigation du scénario" },
];

export const DOCUMENTED_RULES = DOCUMENTED_CONSOLE_ERRORS.map((rule) => ({
  pattern: String(rule.pattern),
  reason: rule.reason,
}));

export const IGNORED_RULES = IGNORED_REQUESTS.map((rule) => ({
  pattern: String(rule.pattern),
  reason: rule.reason,
}));

function isDocumentedConsoleError(entry) {
  return DOCUMENTED_CONSOLE_ERRORS.some((rule) => rule.pattern.test(entry.text));
}

function isIgnoredRequest(entry) {
  const text = entry.failure ?? "";
  return IGNORED_REQUESTS.some((rule) => rule.pattern.test(text));
}

function consoleErrorsOf(entries) {
  return entries.filter((entry) => entry.level === "error");
}

/** Répartit les observations brutes en « bloquant » et « excusé » (traçable). */
export function classify(recorder) {
  const consoleErrors = consoleErrorsOf(recorder.console);
  return {
    pageErrors: recorder.pageErrors,
    consoleErrors: consoleErrors.filter((entry) => !isDocumentedConsoleError(entry)),
    documentedConsoleErrors: consoleErrors.filter(isDocumentedConsoleError),
    failedRequests: recorder.failedRequests.filter((entry) => !isIgnoredRequest(entry)),
    ignoredRequests: recorder.failedRequests.filter(isIgnoredRequest),
  };
}

function countsOf(buckets) {
  return {
    pageErrors: buckets.pageErrors.length,
    consoleErrors: buckets.consoleErrors.length,
    failedRequests: buckets.failedRequests.length,
    documentedConsoleErrors: buckets.documentedConsoleErrors.length,
    ignoredRequests: buckets.ignoredRequests.length,
  };
}

function reasonsOf(counts) {
  const reasons = [];
  if (counts.pageErrors > 0) reasons.push(`${counts.pageErrors} pageerror`);
  if (counts.failedRequests > 0) reasons.push(`${counts.failedRequests} requête(s) en échec`);
  if (counts.consoleErrors > 0) reasons.push(`${counts.consoleErrors} console.error`);
  return reasons;
}

/** exit 0 seulement sans pageerror, sans requête en échec et sans console.error. */
export function verdict(buckets) {
  const counts = countsOf(buckets);
  const reasons = reasonsOf(counts);
  return { code: reasons.length === 0 ? 0 : 1, reasons, counts };
}
