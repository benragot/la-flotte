/**
 * Verdict objectif du harnais. Le rapport est un instrument de diagnostic :
 * il ne « corrige » rien, il exige zéro erreur d'exécution **et** un scénario
 * réellement joué — une étape `failed` (sélecteur cassé, timeout) est un faux
 * vert si elle n'apparaît pas dans les raisons. De même, une étape `status:
 * "ok"` dont une zone clé manque (`missing`) n'a rien prouvé : elle échoue.
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

/** Requêtes annulées par le scénario lui-même : la navigation vers l'étape suivante. */
const IGNORED_REQUESTS = [
  {
    pattern: /ERR_ABORTED/,
    resourceType: "document",
    reason: "navigation interrompue par le scénario lui-même",
  },
];

/**
 * Un skip n'est toléré que s'il est déclaré ici, avec sa raison. La table est
 * VIDE : les six étapes sont atteignables, donc tout skip est un scénario cassé.
 * Une exception future devra être ajoutée explicitement, pas silencieusement.
 */
export const DOCUMENTED_SKIPS = {};

/** Mots des raisons d'échec, dans l'ordre de lecture du résumé. */
const REASON_LABELS = [
  ["pageErrors", (count) => `${count} pageerror`],
  ["failedSteps", (count) => `${count} étape(s) en échec`],
  ["missingZones", (count) => `${count} zone(s) absente(s)`],
  ["undocumentedSkips", (count) => `${count} skip(s) non documenté(s)`],
  ["failedRequests", (count) => `${count} requête(s) en échec`],
  ["consoleErrors", (count) => `${count} console.error`],
];

/**
 * Seuil du bruit `console.warn` : deux warnings par capture est le maximum
 * attendu (les captures déclenchent un ReadPixels WebGL). Au-delà, c'est un
 * readback par frame — donc un coût réel — mais **pas** une erreur : le seuil
 * produit un avertissement, jamais un `exit 1`.
 */
const WARNING_BUDGET_PER_CAPTURE = 2;

function rulesOf(rules) {
  return rules.map((rule) => ({ pattern: String(rule.pattern), reason: rule.reason }));
}

export const DOCUMENTED_RULES = rulesOf(DOCUMENTED_CONSOLE_ERRORS);

export const IGNORED_RULES = IGNORED_REQUESTS.map((rule) => ({
  pattern: String(rule.pattern),
  resourceType: rule.resourceType,
  reason: rule.reason,
}));

function isDocumentedConsoleError(entry) {
  return DOCUMENTED_CONSOLE_ERRORS.some((rule) => rule.pattern.test(entry.text));
}

function isIgnoredRequest(entry) {
  const text = entry.failure ?? "";
  return IGNORED_REQUESTS.some((rule) => rule.resourceType === entry.resourceType && rule.pattern.test(text));
}

function withLevel(entries, level) {
  return entries.filter((entry) => entry.level === level);
}

/** Répartit les observations brutes en « bloquant » et « excusé » (traçable). */
export function classify(recorder) {
  const consoleErrors = withLevel(recorder.console, "error");
  return {
    pageErrors: recorder.pageErrors,
    consoleErrors: consoleErrors.filter((entry) => !isDocumentedConsoleError(entry)),
    documentedConsoleErrors: consoleErrors.filter(isDocumentedConsoleError),
    failedRequests: recorder.failedRequests.filter((entry) => !isIgnoredRequest(entry)),
    ignoredRequests: recorder.failedRequests.filter(isIgnoredRequest),
    warnings: withLevel(recorder.console, "warning"),
  };
}

function arrayCounts(buckets) {
  return {
    pageErrors: buckets.pageErrors.length,
    consoleErrors: buckets.consoleErrors.length,
    failedRequests: buckets.failedRequests.length,
    documentedConsoleErrors: buckets.documentedConsoleErrors.length,
    ignoredRequests: buckets.ignoredRequests.length,
    warnings: buckets.warnings.length,
  };
}

function statusCount(steps, status) {
  return steps.filter((step) => step.status === status).length;
}

function isDocumentedSkip(step, documentedSkips) {
  if (step.status !== "skipped") return true;
  return Object.hasOwn(documentedSkips, step.skipId ?? "");
}

function stepsCounts(steps, documentedSkips) {
  return {
    failedSteps: statusCount(steps, "failed"),
    undocumentedSkips: steps.filter((step) => !isDocumentedSkip(step, documentedSkips)).length,
  };
}

function zonesOf(step) {
  return [...(step.missing ?? [])];
}

/** Zones clés absentes, par étape : le détail qui explique la raison. */
function missingOf(steps) {
  return steps
    .filter((step) => zonesOf(step).length > 0)
    .map((step) => ({ step: step.step, zones: zonesOf(step) }));
}

function missingCount(steps) {
  return missingOf(steps).reduce((total, entry) => total + entry.zones.length, 0);
}

/** Chaque étape produit au moins une capture, même quand elle échoue. */
function shotsOf(step) {
  return Math.max(1, (step.screenshots ?? []).length);
}

function captureCount(steps) {
  return steps.reduce((total, step) => total + shotsOf(step), 0);
}

/** Non bloquant : borne le bruit, ne juge pas. */
function warningsAdvisory(counts, steps) {
  const captures = captureCount(steps);
  const budget = WARNING_BUDGET_PER_CAPTURE * captures;
  if (counts.warnings <= budget) return [];
  return [`${counts.warnings} warnings pour ${captures} capture(s), seuil ${budget} : readback GPU probablement par frame`];
}

function countsOf(buckets, steps, documentedSkips) {
  return { ...arrayCounts(buckets), ...stepsCounts(steps, documentedSkips), missingZones: missingCount(steps) };
}

/** Une raison par compteur non nul : le résumé dit toujours POURQUOI il sort en 1. */
function reasonsOf(counts) {
  return REASON_LABELS
    .filter(([key]) => counts[key] > 0)
    .map(([key, label]) => label(counts[key]));
}

/** exit 0 seulement si le scénario s'est joué, sans erreur **et sans zone absente**. */
export function verdict(buckets, steps = [], documentedSkips = DOCUMENTED_SKIPS) {
  const counts = countsOf(buckets, steps, documentedSkips);
  const reasons = reasonsOf(counts);
  const missing = missingOf(steps);
  const advisories = warningsAdvisory(counts, steps);
  return { code: reasons.length === 0 ? 0 : 1, reasons, counts, missing, advisories };
}
