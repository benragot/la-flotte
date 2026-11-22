import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { load } from "js-yaml";
import { describe, expect, it } from "vitest";

const BACKLOG_PATH = "docs/design/backlog.yaml";
const REQUIRED_STATUSES = [
  "todo",
  "in_progress",
  "needs_review",
  "approved",
  "blocked",
  "done",
  "dropped",
];
const FREE_TARGETS = ["external", "blocked"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TASK_ID_PATTERN = /^\d[A-D]-[a-z0-9-]+$/;
const DEBT_ID_PATTERN = /^D\d{2}$/;

interface Task {
  id: string;
  title: string;
  status: string;
  pr?: number;
}

interface Phase {
  id: string;
  status?: string;
  tasks?: Task[];
  blocked_by?: string[];
  depends_on?: string[];
}

interface Wave {
  id: string;
  title: string;
  status: string;
  phases: Phase[];
}

interface Debt {
  id: string;
  title: string;
  severity: string;
  target: string;
}

interface Backlog {
  meta: { statuses: string[]; updated_at: string };
  inbox: unknown[];
  waves: Wave[];
  debts: Debt[];
}

function readBacklog(): Backlog {
  const raw = readFileSync(join(process.cwd(), BACKLOG_PATH), "utf8");
  return load(raw) as Backlog;
}

function allPhases(backlog: Backlog): Phase[] {
  return backlog.waves.flatMap((wave) => wave.phases);
}

function allTasks(backlog: Backlog): Task[] {
  return allPhases(backlog).flatMap((phase) => phase.tasks ?? []);
}

function phaseStatuses(backlog: Backlog): string[] {
  return allPhases(backlog).flatMap((phase) => (phase.status ? [phase.status] : []));
}

function collectedStatuses(backlog: Backlog): string[] {
  const waveStatuses = backlog.waves.map((wave) => wave.status);
  const taskStatuses = allTasks(backlog).map((task) => task.status);
  return [...waveStatuses, ...phaseStatuses(backlog), ...taskStatuses];
}

function knownRefs(backlog: Backlog): string[] {
  return [
    ...backlog.waves.map((wave) => wave.id),
    ...allPhases(backlog).map((phase) => phase.id),
    ...allTasks(backlog).map((task) => task.id),
    ...backlog.debts.map((debt) => debt.id),
  ];
}

function phaseRefEntries(backlog: Backlog): string[] {
  return allPhases(backlog).flatMap((phase) => {
    const refs = [...(phase.blocked_by ?? []), ...(phase.depends_on ?? [])];
    return refs.map((ref) => `${phase.id} -> ${ref}`);
  });
}

function danglingRefs(backlog: Backlog): string[] {
  const known = new Set(knownRefs(backlog));
  const debtRefs = backlog.debts.map((debt) => `${debt.id} -> ${debt.target}`);
  return [...phaseRefEntries(backlog), ...debtRefs].filter((entry) => {
    const ref = entry.split(" -> ")[1] ?? "";
    return !FREE_TARGETS.includes(ref) && !known.has(ref);
  });
}

describe("backlog — fichier et métadonnées", () => {
  it("existe hors de data/ et se parse en YAML", () => {
    expect(existsSync(join(process.cwd(), BACKLOG_PATH))).toBe(true);
    expect(BACKLOG_PATH.startsWith("data/")).toBe(false);
    const backlog = readBacklog();
    expect(backlog.meta).toBeTypeOf("object");
    expect(backlog.waves.length).toBeGreaterThan(0);
  });

  it("déclare les sept statuts dans meta.statuses", () => {
    const { statuses } = readBacklog().meta;
    expect(statuses).toHaveLength(REQUIRED_STATUSES.length);
    for (const status of REQUIRED_STATUSES) expect(statuses).toContain(status);
  });

  it("expose un inbox pour les demandes improvisées", () => {
    expect(Array.isArray(readBacklog().inbox)).toBe(true);
  });

  it("date la dernière mise à jour au format YYYY-MM-DD", () => {
    expect(readBacklog().meta.updated_at).toMatch(DATE_PATTERN);
  });
});

describe("backlog — vagues et phases", () => {
  it("décrit chaque vague avec id, titre et statut", () => {
    const waves = readBacklog().waves;
    const broken = waves.filter((wave) => !wave.id || !wave.title || !wave.status);
    expect(broken.map((wave) => wave.id)).toEqual([]);
    expect(waves.length).toBeGreaterThanOrEqual(4);
  });

  it("décrit chaque phase avec un id et un statut ou une liste de tâches", () => {
    const phases = allPhases(readBacklog());
    expect(phases.filter((phase) => !phase.id)).toEqual([]);
    const missing = phases.filter((phase) => !phase.status && !Array.isArray(phase.tasks));
    expect(missing.map((phase) => phase.id)).toEqual([]);
  });

  it("n'utilise que des statuts déclarés dans meta.statuses", () => {
    const backlog = readBacklog();
    const allowed = new Set(backlog.meta.statuses);
    const unknown = collectedStatuses(backlog).filter((status) => !allowed.has(status));
    expect(unknown).toEqual([]);
  });
});

describe("backlog — identifiants et références", () => {
  it("n'a aucun identifiant de tâche ou de dette en double", () => {
    const backlog = readBacklog();
    const taskIds = allTasks(backlog).map((task) => task.id);
    const debtIds = backlog.debts.map((debt) => debt.id);
    const everyId = [...taskIds, ...debtIds];
    expect(new Set(everyId).size).toBe(everyId.length);
    expect(taskIds.filter((id) => !TASK_ID_PATTERN.test(id))).toEqual([]);
    expect(debtIds.filter((id) => !DEBT_ID_PATTERN.test(id))).toEqual([]);
  });

  it("référence les PR par des entiers positifs", () => {
    const prs = allTasks(readBacklog()).flatMap((task) => (task.pr === undefined ? [] : [task.pr]));
    expect(prs.length).toBeGreaterThan(0);
    expect(prs.filter((pr) => !Number.isInteger(pr) || pr < 1)).toEqual([]);
  });

  it("ne référence que des identifiants existants dans blocked_by, depends_on et target", () => {
    expect(danglingRefs(readBacklog())).toEqual([]);
  });
});
