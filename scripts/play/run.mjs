#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { parseArgs } from "./args.mjs";
import { attachRecorder, createRecorder } from "./collect.mjs";
import { assertPortFree, findFreePort } from "./ports.mjs";
import { buildErrors, buildReport, printSummary, writeArtifacts } from "./report.mjs";
import { runSteps } from "./runner.mjs";
import { assertOwnApp, startVite, stopVite, waitForServer } from "./server.mjs";
import { createSession } from "./session.mjs";
import { STEPS } from "./steps.mjs";
import { classify, verdict } from "./verdict.mjs";

const LOCAL_HOST = "127.0.0.1";
const NAV_TIMEOUT_MS = 15_000;
/** Chromium headless n'a pas de GPU : SwiftShader doit être autorisé explicitement. */
const LAUNCH_ARGS = ["--enable-unsafe-swiftshader"];

let activeServer = null;

function installCleanup() {
  process.on("exit", () => stopVite(activeServer));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stopVite(activeServer));
}

async function resolvePort(requested) {
  if (requested !== null) {
    await assertPortFree(requested);
    return requested;
  }
  const port = await findFreePort();
  await assertPortFree(port);
  return port;
}

async function playInPage({ browser, args, outDir, baseUrl, recorder }) {
  const context = await browser.newContext({ viewport: args.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);
  attachRecorder(page, recorder);
  return runSteps(STEPS, createSession({ page, baseUrl, outDir, recorder }));
}

async function finalize({ steps, recorder, outDir, baseUrl, port, serverLog, started, viewport }) {
  const buckets = classify(recorder);
  const result = verdict(buckets);
  const meta = { baseUrl, port, viewport, durationMs: Date.now() - started };
  const report = buildReport({ steps, result, meta, serverLog });
  const errors = buildErrors({ ...buckets, counts: result.counts });
  await writeArtifacts({ outDir, report, errors, consoleEntries: recorder.console });
  printSummary({ report, errors, result, outDir });
  return result.code;
}

async function playWithBrowser({ args, outDir, baseUrl, port, serverLog, started }) {
  const recorder = createRecorder();
  const browser = await chromium.launch({ headless: args.headless, args: LAUNCH_ARGS });
  try {
    const steps = await playInPage({ browser, args, outDir, baseUrl, recorder });
    return await finalize({ steps, recorder, outDir, baseUrl, port, serverLog, started, viewport: args.viewport });
  } finally {
    await browser.close();
  }
}

async function play({ args, outDir, port, serverLog }) {
  const started = Date.now();
  const baseUrl = `http://${LOCAL_HOST}:${port}`;
  await waitForServer(baseUrl);
  await assertOwnApp(baseUrl);
  return playWithBrowser({ args, outDir, baseUrl, port, serverLog, started });
}

async function main() {
  const args = parseArgs(process.argv.slice(2), process.env);
  const outDir = path.resolve(process.cwd(), args.out);
  await fs.mkdir(outDir, { recursive: true });
  const port = await resolvePort(args.port);
  const serverLog = [];
  installCleanup();
  activeServer = startVite({ port, cwd: process.cwd(), lines: serverLog });
  try {
    return await play({ args, outDir, port, serverLog });
  } finally {
    stopVite(activeServer);
    activeServer = null;
  }
}

main()
  .then((code) => { process.exitCode = code; })
  .catch((error) => {
    console.error(`\n❌ npm run play a échoué : ${error.message}`);
    process.exitCode = 1;
  });
