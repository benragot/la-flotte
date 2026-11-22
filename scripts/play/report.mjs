import fs from "node:fs/promises";
import path from "node:path";
import { DOCUMENTED_RULES, IGNORED_RULES } from "./verdict.mjs";

const REPORT_FILE = "report.json";
const ERRORS_FILE = "errors.json";
const CONSOLE_FILE = "console.log";
const ICONS = { ok: "✅", skipped: "⚠️", failed: "❌" };
const MAX_SERVER_LINES = 40;

function statusCounts(steps) {
  const count = (status) => steps.filter((step) => step.status === status).length;
  return { ok: count("ok"), skipped: count("skipped"), failed: count("failed") };
}

export function buildReport({ steps, result, meta, serverLog }) {
  return {
    generatedAt: new Date().toISOString(),
    ...meta,
    verdict: { code: result.code, reasons: result.reasons },
    errors: result.counts,
    totals: statusCounts(steps),
    steps,
    server: serverLog.slice(-MAX_SERVER_LINES),
  };
}

/** `errors.json` = tout ce qui casse la partie, plus ce qui a été explicitement excusé. */
export function buildErrors(buckets) {
  return {
    generatedAt: new Date().toISOString(),
    counts: buckets.counts,
    documentedConsoleErrors: DOCUMENTED_RULES,
    ignoredRequests: IGNORED_RULES,
    pageErrors: buckets.pageErrors,
    consoleErrors: buckets.consoleErrors,
    failedRequests: buckets.failedRequests,
    excusedConsoleErrors: buckets.documentedConsoleErrors,
    excusedRequests: buckets.ignoredRequests,
    /** Non bloquants, mais visibles : un contexte WebGL perdu arrive en `warning`. */
    warnings: buckets.warnings,
  };
}

function formatConsole(entries) {
  const lines = entries.map((entry) => `[${entry.step}] ${entry.level.toUpperCase().padEnd(5)} ${entry.text}`);
  return `${lines.join("\n")}\n`;
}

export async function writeArtifacts({ outDir, report, errors, consoleEntries }) {
  await Promise.all([
    fs.writeFile(path.join(outDir, REPORT_FILE), `${JSON.stringify(report, null, 2)}\n`),
    fs.writeFile(path.join(outDir, ERRORS_FILE), `${JSON.stringify(errors, null, 2)}\n`),
    fs.writeFile(path.join(outDir, CONSOLE_FILE), formatConsole(consoleEntries)),
  ]);
}

function stepLine(step) {
  const suffix = step.reason === null || step.reason === undefined ? "" : ` — ${step.reason}`;
  return `${ICONS[step.status]} ${step.step} (${step.durationMs} ms)${suffix}`;
}

function printTotals(totals, counts) {
  console.log(`\nÉtapes : ${totals.ok} ok · ${totals.skipped} skipped · ${totals.failed} failed`);
  const errors = `${counts.pageErrors} pageerror · ${counts.consoleErrors} console.error · ${counts.failedRequests} requête(s) en échec`;
  console.log(`Erreurs : ${errors}`);
  console.log(`Skips non documentés : ${counts.undocumentedSkips} · warnings (non bloquants) : ${counts.warnings}`);
  console.log(`Excusé (commenté) : ${counts.documentedConsoleErrors} console.error · ${counts.ignoredRequests} requête(s)`);
}

function printPageErrors(entries) {
  for (const entry of entries) {
    console.log(`   ❌ pageerror [${entry.step}] ${entry.message}`);
    if (entry.stack !== null) console.log(`      ${entry.stack.split("\n").slice(1, 4).join("\n      ")}`);
  }
}

function printDetails(errors) {
  printPageErrors(errors.pageErrors);
  for (const entry of errors.consoleErrors) console.log(`   ❌ console.error [${entry.step}] ${entry.text}`);
  for (const entry of errors.failedRequests) {
    console.log(`   ❌ requête [${entry.step}] ${entry.status ?? entry.failure} ${entry.url}`);
  }
}

function verdictLine(result) {
  if (result.code === 0) return "✅ Verdict : aucune erreur console, aucune requête en échec — exit 0";
  return `❌ Verdict : ${result.reasons.join(", ")} — exit 1`;
}

export function printSummary({ report, errors, result, outDir }) {
  console.log("\n──────── Session jouée ────────");
  for (const step of report.steps) console.log(stepLine(step));
  printTotals(report.totals, errors.counts);
  printDetails(errors);
  console.log(`\nCaptures   : ${path.join(outDir, "*.png")}`);
  console.log(`Rapport    : ${path.join(outDir, REPORT_FILE)} · ${path.join(outDir, ERRORS_FILE)}`);
  console.log(verdictLine(result));
}
