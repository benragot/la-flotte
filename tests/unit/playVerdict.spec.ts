import { describe, expect, it } from "vitest";
import { classify, verdict } from "../../scripts/play/verdict.mjs";
import type {
  ConsoleEntry,
  PageErrorEntry,
  Recorder,
  RequestEntry,
  StepOutcome,
} from "../../scripts/play/verdict.mjs";

/**
 * La logique de verdict est ce qui rend `npm run play` utilisable comme
 * garde-fou : sans ces tests, une étape cassée ou un sélecteur renommé sortait
 * en `exit 0` — le faux vert que l'instrument est censé supprimer.
 */

function recorder(overrides: Partial<Recorder> = {}): Recorder {
  const base: Recorder = { step: "01", console: [], pageErrors: [], failedRequests: [] };
  return { ...base, ...overrides };
}

function consoleEntry(level: string, text: string): ConsoleEntry {
  return { step: "01", level, text, location: null };
}

function pageError(message: string): PageErrorEntry {
  return { step: "01", message, stack: `Error: ${message}\n    at src/renderer/scene.ts:1:1` };
}

function failedRequest(overrides: Partial<RequestEntry> = {}): RequestEntry {
  return { step: "01", url: "/assets/sprites/iop.svg", status: 404, resourceType: "image", failure: null, ...overrides };
}

function step(status: StepOutcome["status"], extra: Partial<StepOutcome> = {}): StepOutcome {
  return { step: "05-combat-donjon", status, skipId: null, ...extra };
}

function codeOf(input: Recorder, steps: readonly StepOutcome[] = []): number {
  return verdict(classify(input), steps).code;
}

describe("verdict : erreurs bloquantes", () => {
  it("un pageerror fait échouer la session", () => {
    expect(codeOf(recorder({ pageErrors: [pageError("Cannot read properties of null")] }))).toBe(1);
  });

  it("une réponse 4xx fait échouer la session", () => {
    expect(codeOf(recorder({ failedRequests: [failedRequest()] }))).toBe(1);
  });

  it("un console.error fait échouer la session", () => {
    expect(codeOf(recorder({ console: [consoleEntry("error", "Uncaught TypeError: boom")] }))).toBe(1);
  });

  it("une étape failed fait échouer la session, même sans erreur console", () => {
    expect(codeOf(recorder(), [step("failed")])).toBe(1);
  });

  it("un skip non documenté fait échouer la session", () => {
    expect(codeOf(recorder(), [step("skipped", { skipId: "raison-inventee" })])).toBe(1);
  });
});

describe("verdict : exceptions documentées", () => {
  it("le repli SwiftShader de Chromium headless est toléré", () => {
    const text = "Automatic fallback to software WebGL has been deprecated. Please use the --enable-unsafe-swiftshader flag.";
    expect(codeOf(recorder({ console: [consoleEntry("error", text)] }))).toBe(0);
  });

  it("une requête de document annulée par le scénario est tolérée", () => {
    const aborted = failedRequest({ status: null, resourceType: "document", failure: "net::ERR_ABORTED" });
    expect(codeOf(recorder({ failedRequests: [aborted] }))).toBe(0);
  });

  it("une requête d’asset annulée reste bloquante", () => {
    const aborted = failedRequest({ status: null, resourceType: "image", failure: "net::ERR_ABORTED" });
    expect(codeOf(recorder({ failedRequests: [aborted] }))).toBe(1);
  });

  it("un skip explicitement documenté est toléré", () => {
    const documented = { "dungeon-room-indisponible": "salle absente du build" };
    const steps = [step("skipped", { skipId: "dungeon-room-indisponible" })];
    expect(verdict(classify(recorder()), steps, documented).code).toBe(0);
  });
});

describe("verdict : session saine", () => {
  it("une session propre sort en 0 et compte les warnings sans bloquer", () => {
    const input = recorder({ console: [consoleEntry("warning", "[.WebGL] GPU stall due to ReadPixels")] });
    const result = verdict(classify(input), [step("ok")]);
    expect(result.code).toBe(0);
    expect(result.counts.warnings).toBe(1);
  });
});
