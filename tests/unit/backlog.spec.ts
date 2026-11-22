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
const PRIORITIES = ["high", "medium", "low"];
const TASK_KEYS = ["id", "title", "status", "owner", "priority", "updated_at"];
const INBOX_KEYS = ["id", "title", "created_at"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WAVE_ID_PATTERN = /^wave-\d+$/;
const PHASE_ID_PATTERN = /^\d[A-D]$/;
const TASK_ID_PATTERN = /^\d[A-D]-[a-z0-9-]+$/;
const DEBT_ID_PATTERN = /^D\d{2}$/;

interface Task {
  id: string;
  title: string;
  status: string;
  owner?: string;
  priority?: string;
  updated_at?: string;
  pr?: number;
  depends_on?: string[];
}

interface Phase {
  id: string;
  title?: string;
  status?: string;
  tasks?: Task[];
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

interface Meta {
  version: number;
  updated_at: string;
  updated_by: string;
  statuses: string[];
  status_definitions: Record<string, string>;
  update_rules: string[];
  /** Phase réellement suivante ; sert de pointeur de reprise à l'orchestrateur. */
  next?: string;
}

interface Backlog {
  meta: Meta;
  inbox: unknown[];
  waves: Wave[];
  debts: Debt[];
}

function rawBacklog(): string {
  return readFileSync(join(process.cwd(), BACKLOG_PATH), "utf8");
}

function readBacklog(): Backlog {
  return load(rawBacklog()) as Backlog;
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

function duplicated(ids: string[]): string[] {
  return ids.filter((id, index) => ids.indexOf(id) !== index);
}

function isFilled(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function dependencyRefs(entry: { id: string; depends_on?: string[] }): string[] {
  return (entry.depends_on ?? []).map((ref) => `${entry.id} -> ${ref}`);
}

function phaseRefEntries(backlog: Backlog): string[] {
  return allPhases(backlog).flatMap((phase) => dependencyRefs(phase));
}

function taskRefEntries(backlog: Backlog): string[] {
  return allTasks(backlog).flatMap((task) => dependencyRefs(task));
}

function debtRefEntries(backlog: Backlog): string[] {
  return backlog.debts.map((debt) => `${debt.id} -> ${debt.target}`);
}

function filterDangling(entries: string[], known: Set<string>): string[] {
  return entries.filter((entry) => {
    const ref = entry.split(" -> ")[1] ?? "";
    return !FREE_TARGETS.includes(ref) && !known.has(ref);
  });
}

function danglingPhaseRefs(backlog: Backlog): string[] {
  const entries = [...phaseRefEntries(backlog), ...debtRefEntries(backlog)];
  return filterDangling(entries, new Set(knownRefs(backlog)));
}

function danglingTaskRefs(backlog: Backlog): string[] {
  return filterDangling(taskRefEntries(backlog), new Set(knownRefs(backlog)));
}

/** Statuts de TOUTES les entités référençables : vagues, phases et tâches. */
function statusById(backlog: Backlog): Map<string, string> {
  const waves = backlog.waves.map((wave) => [wave.id, wave.status] as const);
  const phases = allPhases(backlog).map((phase) => [phase.id, phase.status ?? ""] as const);
  const tasks = allTasks(backlog).map((task) => [task.id, task.status] as const);
  return new Map([...waves, ...phases, ...tasks]);
}

function unsatisfiedRefs(phase: Phase, statuses: Map<string, string>): string[] {
  return (phase.depends_on ?? []).filter((ref) => statuses.get(ref) !== "done");
}

function blockedWithoutGap(backlog: Backlog): string[] {
  const statuses = statusById(backlog);
  return allPhases(backlog)
    .filter((phase) => phase.status === "blocked")
    .filter((phase) => unsatisfiedRefs(phase, statuses).length === 0)
    .map((phase) => phase.id);
}

function prematurePhases(backlog: Backlog): string[] {
  const statuses = statusById(backlog);
  return allPhases(backlog)
    .filter((phase) => phase.status !== "blocked")
    .filter((phase) => unsatisfiedRefs(phase, statuses).length > 0)
    .map((phase) => `${phase.id}:${phase.status ?? "?"}`);
}

function taskKeyGaps(backlog: Backlog): string[] {
  return allTasks(backlog).flatMap((task) => {
    const values: Record<string, string | undefined> = {
      id: task.id,
      title: task.title,
      status: task.status,
      owner: task.owner,
      priority: task.priority,
      updated_at: task.updated_at,
    };
    return TASK_KEYS.filter((key) => !isFilled(values[key])).map((key) => `${task.id}:${key}`);
  });
}

function invalidPriorities(backlog: Backlog): string[] {
  const valid = new Set(PRIORITIES);
  return allTasks(backlog).filter((task) => !valid.has(task.priority ?? "")).map((task) => task.id);
}

function missingPrTasks(backlog: Backlog, statuses: string[]): string[] {
  const tracked = new Set(statuses);
  return allTasks(backlog)
    .filter((task) => tracked.has(task.status))
    .filter((task) => !Number.isInteger(task.pr))
    .map((task) => `${task.id}:${task.status}`);
}

function inProgressWithPr(backlog: Backlog): string[] {
  return allTasks(backlog)
    .filter((task) => task.status === "in_progress" && task.pr !== undefined)
    .map((task) => task.id);
}

function isWaveInconsistent(wave: Wave): boolean {
  const open = wave.phases.filter((phase) => phase.status !== "done");
  return wave.status === "done" ? open.length > 0 : open.length === 0;
}

/** Une vague `done` n'a que des phases `done` ; une vague `in_progress` en garde une ouverte. */
function wavePhaseMismatches(backlog: Backlog): string[] {
  const tracked = backlog.waves.filter((wave) => wave.status === "done" || wave.status === "in_progress");
  return tracked.filter(isWaveInconsistent).map((wave) => wave.id);
}

function fixturePhase(id: string, status: string, extra: Partial<Phase> = {}): Phase {
  return { id, title: `Phase ${id}`, status, ...extra };
}

function fixtureTask(id: string, status: string, pr?: number): Task {
  return { id, title: `Tâche ${id}`, status, owner: "tdd-coder", priority: "medium", updated_at: "2026-11-22", pr };
}

function fixtureBacklog(phases: Phase[], waveStatus = "todo"): Backlog {
  const meta = { version: 3, updated_at: "2026-11-22", updated_by: "integrator", statuses: REQUIRED_STATUSES };
  const wave: Wave = { id: "wave-1", title: "Fixture", status: waveStatus, phases };
  return { meta: { ...meta, status_definitions: {}, update_rules: [] }, inbox: [], waves: [wave], debts: [] };
}

function isInboxEntry(entry: unknown): boolean {
  if (typeof entry !== "object" || entry === null) return false;
  const record = entry as Record<string, unknown>;
  const filled = INBOX_KEYS.every((key) => isFilled(record[key] as string | undefined));
  return filled && DATE_PATTERN.test(String(record["created_at"]));
}

function invalidInboxEntries(entries: unknown[]): unknown[] {
  return entries.filter((entry) => !isInboxEntry(entry));
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

  it("versionne le format et date la dernière mise à jour", () => {
    const { version, updated_at } = readBacklog().meta;
    expect(Number.isInteger(version)).toBe(true);
    expect(version).toBeGreaterThanOrEqual(3);
    expect(updated_at).toMatch(DATE_PATTERN);
  });

  it("expose un inbox pour les demandes improvisées", () => {
    expect(Array.isArray(readBacklog().inbox)).toBe(true);
  });
});

describe("backlog — sémantique des statuts", () => {
  it("définit la sémantique de chaque statut déclaré", () => {
    const { statuses, status_definitions: definitions } = readBacklog().meta;
    expect(Object.keys(definitions).sort()).toEqual([...statuses].sort());
    expect(Object.values(definitions).filter((text) => !isFilled(text))).toEqual([]);
  });

  it("documente les règles de mise à jour", () => {
    const { update_rules: rules } = readBacklog().meta;
    expect(rules.length).toBeGreaterThanOrEqual(3);
    expect(rules.join(" ")).toContain("integrator");
    expect(rules.join(" ")).toContain("updated_at");
    expect(rules.join(" ")).toContain("depends_on");
  });

  it("n'attribue jamais l'écriture à l'orchestrateur", () => {
    expect(readBacklog().meta.updated_by).not.toBe("orchestrator");
  });

  it("n'attache aucune PR ouverte à une tâche in_progress", () => {
    expect(inProgressWithPr(readBacklog())).toEqual([]);
  });
});

describe("backlog — vagues et phases", () => {
  it("décrit chaque vague avec id, titre et statut", () => {
    const waves = readBacklog().waves;
    const broken = waves.filter((wave) => !wave.id || !wave.title || !wave.status);
    expect(broken.map((wave) => wave.id)).toEqual([]);
    expect(waves.filter((wave) => !WAVE_ID_PATTERN.test(wave.id))).toEqual([]);
  });

  it("donne un id, un titre et un statut à chaque phase", () => {
    const phases = allPhases(readBacklog());
    const broken = phases.filter((phase) => !phase.id || !phase.title || !phase.status);
    expect(broken.map((phase) => phase.id)).toEqual([]);
    expect(phases.filter((phase) => !PHASE_ID_PATTERN.test(phase.id))).toEqual([]);
  });

  it("n'utilise que des statuts déclarés dans meta.statuses", () => {
    const backlog = readBacklog();
    const allowed = new Set(backlog.meta.statuses);
    const unknown = collectedStatuses(backlog).filter((status) => !allowed.has(status));
    expect(unknown).toEqual([]);
  });
});

describe("backlog — invariant blocked", () => {
  it("n'a aucune phase blocked sans dépendance non satisfaite", () => {
    expect(blockedWithoutGap(readBacklog())).toEqual([]);
  });

  it("n'a aucune phase non blocked avec une dépendance non satisfaite", () => {
    expect(prematurePhases(readBacklog())).toEqual([]);
  });
});

describe("backlog — identifiants", () => {
  it("n'a aucun id de vague ou de phase en double", () => {
    const backlog = readBacklog();
    const ids = [
      ...backlog.waves.map((wave) => wave.id),
      ...allPhases(backlog).map((phase) => phase.id),
    ];
    expect(duplicated(ids)).toEqual([]);
  });

  it("n'a aucun id de tâche ou de dette en double", () => {
    const backlog = readBacklog();
    const taskIds = allTasks(backlog).map((task) => task.id);
    const debtIds = backlog.debts.map((debt) => debt.id);
    expect(duplicated([...taskIds, ...debtIds])).toEqual([]);
    expect(taskIds.filter((id) => !TASK_ID_PATTERN.test(id))).toEqual([]);
    expect(debtIds.filter((id) => !DEBT_ID_PATTERN.test(id))).toEqual([]);
  });
});

describe("backlog — références", () => {
  it("ne référence que des ids existants depuis les phases et les dettes", () => {
    expect(danglingPhaseRefs(readBacklog())).toEqual([]);
  });

  it("ne référence que des ids existants depuis les tâches", () => {
    expect(danglingTaskRefs(readBacklog())).toEqual([]);
  });
});

describe("backlog — clé de dépendance unifiée", () => {
  it("n'utilise plus la clé blocked_by, ni en texte ni en objet", () => {
    const entries = [...allPhases(readBacklog()), ...allTasks(readBacklog())];
    expect(rawBacklog()).not.toContain("blocked_by");
    expect(entries.filter((entry) => Object.hasOwn(entry, "blocked_by"))).toEqual([]);
  });
});

describe("backlog — propriété et fraîcheur des tâches", () => {
  it("renseigne id, titre, statut, owner, priority et updated_at", () => {
    const backlog = readBacklog();
    expect(allTasks(backlog).length).toBeGreaterThan(0);
    expect(taskKeyGaps(backlog)).toEqual([]);
    const badDates = allTasks(backlog).filter((task) => !DATE_PATTERN.test(task.updated_at ?? ""));
    expect(badDates.map((task) => task.id)).toEqual([]);
  });

  it("n'utilise que les priorités high, medium ou low", () => {
    expect(invalidPriorities(readBacklog())).toEqual([]);
  });
});

describe("backlog — traçabilité des PR", () => {
  it("cite la PR qui a livré chaque tâche done", () => {
    expect(missingPrTasks(readBacklog(), ["done"])).toEqual([]);
  });

  it("cite une PR ouverte pour chaque tâche approved ou needs_review", () => {
    expect(missingPrTasks(readBacklog(), ["approved", "needs_review"])).toEqual([]);
  });

  it("référence les PR par des entiers positifs", () => {
    const prs = allTasks(readBacklog()).flatMap((task) => (task.pr === undefined ? [] : [task.pr]));
    expect(prs.length).toBeGreaterThan(0);
    expect(prs.filter((pr) => !Number.isInteger(pr) || pr < 1)).toEqual([]);
  });
});

describe("backlog — inbox", () => {
  it("accepte une entrée complète et rejette une entrée incomplète", () => {
    const valid = { id: "IN-01", title: "Demande improvisée", created_at: "2026-11-22" };
    const withoutDate = { id: "IN-02", title: "Sans date" };
    const emptyTitle = { id: "IN-03", title: "", created_at: "2026-11-22" };
    expect(isInboxEntry(valid)).toBe(true);
    expect(isInboxEntry(withoutDate)).toBe(false);
    expect(isInboxEntry(emptyTitle)).toBe(false);
  });

  it("valide chaque entrée réelle de l'inbox", () => {
    expect(invalidInboxEntries(readBacklog().inbox)).toEqual([]);
  });
});

describe("backlog — garde-fous sur fixtures synthétiques", () => {
  it("détecte une phase non blocked dont la dépendance n'est pas done", () => {
    const done = fixtureBacklog([
      fixturePhase("4A", "done", { tasks: [fixtureTask("4A-a", "done", 3)] }),
      fixturePhase("4B", "todo", { depends_on: ["4A-a"] }),
    ]);
    expect(prematurePhases(done)).toEqual([]);
    const early = fixtureBacklog([
      fixturePhase("4A", "todo", { tasks: [fixtureTask("4A-a", "todo")] }),
      fixturePhase("4B", "todo", { depends_on: ["4A-a"] }),
    ]);
    expect(prematurePhases(early)).toEqual(["4B:todo"]);
  });

  it("résout aussi une dépendance pointant vers une phase", () => {
    const satisfied = fixtureBacklog([
      fixturePhase("4A", "done"),
      fixturePhase("4B", "todo", { depends_on: ["4A"] }),
    ]);
    expect(prematurePhases(satisfied)).toEqual([]);
    const gap = fixtureBacklog([
      fixturePhase("4A", "todo"),
      fixturePhase("4B", "todo", { depends_on: ["4A"] }),
    ]);
    expect(prematurePhases(gap)).toEqual(["4B:todo"]);
  });

  it("exige une PR sur les tâches done, approved et needs_review", () => {
    const ok = fixtureBacklog([
      fixturePhase("4A", "done", {
        tasks: [fixtureTask("4A-a", "done", 3), fixtureTask("4A-b", "approved", 4)],
      }),
    ]);
    expect(missingPrTasks(ok, ["done"])).toEqual([]);
    expect(missingPrTasks(ok, ["approved", "needs_review"])).toEqual([]);
    const gap = fixtureBacklog([
      fixturePhase("4A", "done", {
        tasks: [fixtureTask("4A-a", "done"), fixtureTask("4A-b", "needs_review")],
      }),
    ]);
    expect(missingPrTasks(gap, ["done"])).toEqual(["4A-a:done"]);
    expect(missingPrTasks(gap, ["approved", "needs_review"])).toEqual(["4A-b:needs_review"]);
  });

  it("interdit de citer une PR sur une tâche in_progress", () => {
    const ok = fixtureBacklog([fixturePhase("4A", "todo", { tasks: [fixtureTask("4A-a", "in_progress")] })]);
    expect(inProgressWithPr(ok)).toEqual([]);
    const bad = fixtureBacklog([fixturePhase("4A", "todo", { tasks: [fixtureTask("4A-a", "in_progress", 9)] })]);
    expect(inProgressWithPr(bad)).toEqual(["4A-a"]);
  });

  it("détecte une vague done avec une phase non done", () => {
    expect(wavePhaseMismatches(fixtureBacklog([fixturePhase("4A", "done")], "done"))).toEqual([]);
    const bad = fixtureBacklog([fixturePhase("4A", "done"), fixturePhase("4B", "todo")], "done");
    expect(wavePhaseMismatches(bad)).toEqual(["wave-1"]);
  });

  it("exige une phase ouverte dans une vague in_progress", () => {
    const ok = fixtureBacklog([fixturePhase("4A", "done"), fixturePhase("4B", "todo")], "in_progress");
    expect(wavePhaseMismatches(ok)).toEqual([]);
    const bad = fixtureBacklog([fixturePhase("4A", "done")], "in_progress");
    expect(wavePhaseMismatches(bad)).toEqual(["wave-1"]);
  });
});

describe("backlog — cohérence vagues / phases", () => {
  it("garde chaque vague alignée sur l'état de ses phases", () => {
    expect(wavePhaseMismatches(readBacklog())).toEqual([]);
  });
});

describe("backlog — pointeur de reprise", () => {
  it("pointe vers une phase existante et non terminée", () => {
    const backlog = readBacklog();
    const next = backlog.meta.next;
    expect(typeof next).toBe("string");
    const target = allPhases(backlog).find((phase) => phase.id === next);
    expect(target).toBeDefined();
    expect(target?.status).not.toBe("done");
  });
});
