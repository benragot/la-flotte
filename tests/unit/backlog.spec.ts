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
const DEBT_SEVERITIES = ["low", "medium", "high"];
const TASK_KEYS = ["id", "title", "status", "owner", "priority", "updated_at"];
const INBOX_KEYS = ["id", "title", "created_at"];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WAVE_ID_PATTERN = /^wave-\d+(?:\.\d+)?$/;
const PHASE_ID_PATTERN = /^\d(?:\.\d)?[A-D]$/;
const TASK_ID_PATTERN = /^\d(?:\.\d)?[A-D]-[a-z0-9-]+$/;
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
  notes?: string;
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
  owner?: string;
  notes?: string;
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

function phaseById(backlog: Backlog, id: string): Phase | undefined {
  return allPhases(backlog).find((phase) => phase.id === id);
}

function taskById(backlog: Backlog, id: string): Task | undefined {
  return allTasks(backlog).find((task) => task.id === id);
}

function debtById(backlog: Backlog, id: string): Debt | undefined {
  return backlog.debts.find((debt) => debt.id === id);
}

function taskIdsOf(backlog: Backlog, phaseId: string): string[] {
  return (phaseById(backlog, phaseId)?.tasks ?? []).map((task) => task.id);
}

/** Phases ET tâches terminées : une dette qui vise l'une d'elles est périmée. */
function doneIds(backlog: Backlog): Set<string> {
  const phases = allPhases(backlog).filter((phase) => phase.status === "done").map((phase) => phase.id);
  const tasks = allTasks(backlog).filter((task) => task.status === "done").map((task) => task.id);
  return new Set([...phases, ...tasks]);
}

function debtsTargetingDone(backlog: Backlog): Debt[] {
  const done = doneIds(backlog);
  return backlog.debts.filter((debt) => done.has(String(debt.target)));
}

function externalDebtsWithoutOwner(backlog: Backlog): Debt[] {
  return backlog.debts.filter((debt) => debt.target === "external" && !isFilled(debt.owner));
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

function invalidDebtSeverities(backlog: Backlog): string[] {
  const valid = new Set(DEBT_SEVERITIES);
  return backlog.debts.filter((debt) => !valid.has(debt.severity)).map((debt) => debt.id);
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

describe("backlog — garde-fous de dépendance sur fixtures", () => {
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

});

describe("backlog — garde-fous de traçabilité sur fixtures", () => {
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

describe("backlog — vague 3.5 look & feel", () => {
  it("enregistre les quatre livraisons et le câblage final", () => {
    const wave = readBacklog().waves.find((entry) => entry.id === "wave-3.5");
    expect(wave?.title).toBe("Look & Feel Dofus 1.29");
    const tasks = (wave?.phases ?? []).flatMap((phase) => phase.tasks ?? []);
    const expected = ["3.5A-exploration", "3.5A-iso-grid", "3.5A-dofus-hud", "3.5B-wiring"];
    expect(tasks.map((task) => task.id)).toEqual(expect.arrayContaining(expected));
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

describe("backlog — dette D48 soldée", () => {
  it("ne trouve plus la dette de clef de donjon, livrée en 5B", () => {
    const debt = readBacklog().debts.find((entry) => entry.id === "D48");
    expect(debt).toBeUndefined();
  });

  it("ne cite plus la clef comme manquante dans les dettes", () => {
    expect(rawBacklog()).not.toContain("cle_donjon_ile_de_la_ferraille");
  });
});

describe("backlog — vague 4D wiring", () => {
  it("enregistre la tâche de câblage App et ouvre la phase 4D", () => {
    const backlog = readBacklog();
    const task = taskById(backlog, "4D-wiring");
    expect(task?.status).toBe("approved");
    expect(task?.pr).toBe(34);
    expect(task?.owner).toBe("tdd-coder");
    expect(phaseById(backlog, "4D")?.status).toBe("in_progress");
  });
});

describe("backlog — vague 5A livrée", () => {
  const MERGED = ["5A-craft", "5A-multicombat", "5A-dungeon", "5A-preview"];

  it("enregistre les quatre modules headless mergés en done", () => {
    const backlog = readBacklog();
    expect(taskIdsOf(backlog, "5A")).toEqual(expect.arrayContaining(MERGED));
    const merged = allTasks(backlog).filter((task) => MERGED.includes(task.id));
    expect(merged.filter((task) => task.status !== "done")).toEqual([]);
    expect(phaseById(backlog, "5A")?.status).toBe("done");
  });

  it("pointe la reprise de l'orchestrateur vers 5B", () => {
    expect(readBacklog().meta.next).toBe("5B");
  });
});

describe("backlog — dettes d'outillage", () => {
  const HARNESS = ["D49", "D50", "D51", "D52", "D53"];

  it("enregistre les cinq nouvelles dettes", () => {
    const debts = HARNESS.map((id) => debtById(readBacklog(), id));
    expect(debts.filter((debt) => debt === undefined)).toEqual([]);
  });

  it("cible 5B et 5C quand la dette reste dans le périmètre projet", () => {
    const backlog = readBacklog();
    expect(debtById(backlog, "D49")?.target).toBe("5B");
    expect(debtById(backlog, "D53")?.target).toBe("5C");
  });

  it("externalise les dettes d'outillage hors périmètre agent", () => {
    const targets = ["D50", "D51", "D52"].map((id) => debtById(readBacklog(), id));
    expect(targets.map((debt) => debt?.target)).toEqual(["external", "external", "external"]);
    expect(targets.map((debt) => debt?.owner)).toEqual(["user", "user", "user"]);
  });

  it("grade les dettes bloquantes en high", () => {
    expect(debtById(readBacklog(), "D51")?.severity).toBe("high");
  });
});

describe("backlog — cibles des dettes", () => {
  it("ne cible jamais une phase terminée", () => {
    const orphans = debtsTargetingDone(readBacklog());
    expect(orphans.map((debt) => debt.id)).toEqual([]);
  });

  it("exige un owner sur chaque dette externalisée", () => {
    const orphans = externalDebtsWithoutOwner(readBacklog());
    expect(orphans.map((debt) => debt.id)).toEqual([]);
  });

  it("détecte une dette qui vise une phase done sur fixtures", () => {
    const clean = fixtureBacklog([fixturePhase("5B", "in_progress")]);
    clean.debts = [{ id: "D01", title: "Dette ouverte", severity: "low", target: "5B" }];
    expect(debtsTargetingDone(clean).map((debt) => debt.id)).toEqual([]);
    const stale = fixtureBacklog([fixturePhase("5B", "done")]);
    stale.debts = [{ id: "D01", title: "Dette périmée", severity: "low", target: "5B" }];
    expect(debtsTargetingDone(stale).map((debt) => debt.id)).toEqual(["D01"]);
  });

  it("détecte aussi une dette qui vise une tâche done sur fixtures", () => {
    const phase = (status: string) => fixturePhase("5D", "in_progress", { tasks: [fixtureTask("5D-a", status, 46)] });
    const clean = fixtureBacklog([phase("todo")]);
    clean.debts = [{ id: "D01", title: "Dette ouverte", severity: "low", target: "5D-a" }];
    expect(debtsTargetingDone(clean).map((debt) => debt.id)).toEqual([]);
    const stale = fixtureBacklog([phase("done")]);
    stale.debts = [{ id: "D01", title: "Dette périmée", severity: "low", target: "5D-a" }];
    expect(debtsTargetingDone(stale).map((debt) => debt.id)).toEqual(["D01"]);
  });
});

describe("backlog — vague 5B livrée", () => {
  const MERGED: Array<[string, number]> = [
    ["5B-a", 36],
    ["5B-b", 37],
    ["5B-c", 38],
    ["5B-d", 39],
    ["5B-e", 40],
    ["5B-f", 41],
  ];

  function undelivered(backlog: Backlog): string[] {
    return MERGED.flatMap(([id, pr]) => {
      const task = taskById(backlog, id);
      return task?.status === "done" && task.pr === pr ? [] : [`${id}:${task?.status ?? "absent"}`];
    });
  }

  it("enregistre les six livraisons mergées de la 5B", () => {
    const backlog = readBacklog();
    expect(undelivered(backlog)).toEqual([]);
    expect(phaseById(backlog, "5B")?.status).toBe("in_progress");
  });

  it("ouvre 5B-g en revue avec la PR #43 et la rattache à 5B-f", () => {
    const task = taskById(readBacklog(), "5B-g");
    expect(task?.status).toBe("needs_review");
    expect(task?.pr).toBe(43);
    expect(task?.depends_on).toEqual(["5B-f"]);
  });

  it("versionne le backlog en 17", () => {
    expect(readBacklog().meta.version).toBe(17);
  });
});

describe("backlog — dettes versées en v15", () => {
  const VERSED = ["D55", "D56", "D57", "D58"];

  it("enregistre les quatre dettes de la 5B", () => {
    expect(VERSED.flatMap((id) => (debtById(readBacklog(), id) ? [] : [id]))).toEqual([]);
  });

  it("grade chaque dette sur l'échelle low/medium/high", () => {
    expect(invalidDebtSeverities(readBacklog())).toEqual([]);
  });

  it("détecte une sévérité hors échelle sur fixture", () => {
    const fixture = fixtureBacklog([fixturePhase("5B", "in_progress")]);
    fixture.debts = [{ id: "D01", title: "Dette mal gradée", severity: "critical", target: "5B" }];
    expect(invalidDebtSeverities(fixture)).toEqual(["D01"]);
  });
});

const DELIVERED_5C: Array<[string, number, string]> = [
  ["5C-a", 44, "f6a113e"],
  ["5C-e", 45, "8a84b15"],
  ["5C-b", 46, "32ae2a3"],
  ["5C-c", 48, "74e739d"],
];

function deliveryGaps(backlog: Backlog): string[] {
  return DELIVERED_5C.flatMap(([id, pr, squash]) => {
    const task = taskById(backlog, id);
    const ok = task?.status === "done" && task.pr === pr && (task.notes ?? "").includes(squash);
    return ok ? [] : [`${id}:${task?.status ?? "absent"}`];
  });
}

describe("backlog — vague 5C/5D après les merges #46 et #48", () => {
  it("enregistre les livraisons 5C-a, 5C-b, 5C-c et 5C-e avec leur squash", () => {
    expect(deliveryGaps(readBacklog())).toEqual([]);
  });

  it("garde 5C ouverte sur la seule tâche 5C-d après les merges #46 et #48", () => {
    const backlog = readBacklog();
    expect(taskById(backlog, "5C-d")?.status).toBe("todo");
    expect(taskIdsOf(backlog, "5C").filter((id) => taskById(backlog, id)?.status !== "done")).toEqual([
      "5C-d",
    ]);
  });

  it("ouvre les tâches 5C-b, 5C-c, 5C-d et 5D-a", () => {
    const backlog = readBacklog();
    expect(taskIdsOf(backlog, "5C")).toEqual(expect.arrayContaining(["5C-b", "5C-c", "5C-d"]));
    expect(taskIdsOf(backlog, "5D")).toEqual(expect.arrayContaining(["5D-a"]));
  });

  it("déclare les dépendances de la suite", () => {
    const backlog = readBacklog();
    expect(taskById(backlog, "5C-c")?.depends_on).toEqual(["5C-b", "5C-a"]);
    expect(taskById(backlog, "5C-d")?.depends_on).toEqual(["5C-a"]);
    expect(taskById(backlog, "5D-a")?.depends_on).toEqual(["5C-c", "5C-d", "5B-g"]);
  });

  it("exige une PR ouverte sur 5C-d (symétrique de 5B-g)", () => {
    const task = taskById(readBacklog(), "5C-d");
    expect(task?.status).toBe("todo");
    expect(task?.pr).toBeUndefined();
  });
});

describe("backlog — dettes des audits #44/#45", () => {
  const AUDITS: Array<[string, string, string]> = [
    ["D59", "medium", "5B"],
    ["D60", "low", "5C"],
    ["D62", "low", "5C"],
    ["D63", "medium", "5C"],
    ["D64", "high", "5C-d"],
  ];

  function auditGaps(backlog: Backlog): string[] {
    return AUDITS.flatMap(([id, severity, target]) => {
      const debt = debtById(backlog, id);
      return debt?.severity === severity && debt.target === target ? [] : [id];
    });
  }

  it("verse les six dettes avec leur sévérité et leur cible", () => {
    expect(auditGaps(readBacklog())).toEqual([]);
  });

  it("joint une note factuelle à chaque dette versée", () => {
    const missing = AUDITS.filter(([id]) => !isFilled(debtById(readBacklog(), id)?.notes)).map(([id]) => id);
    expect(missing).toEqual([]);
  });
});

describe("backlog — dette D61 caduque", () => {
  it("ne traîne plus la dette de non-riposte, soldée par #48", () => {
    expect(debtById(readBacklog(), "D61")).toBeUndefined();
    expect(rawBacklog()).not.toContain("aucun avertissement de riposte");
  });
});

const WAVE6_SPEC = "docs/design/specs/effects-engine.md";
const WAVE6_TASKS: Array<[string, string[]]> = [
  ["6A-effects-schema", []],
  ["6A-timed-effects", ["6A-effects-schema"]],
  ["6A-apmp-retrait", ["6A-timed-effects"]],
  ["6A-heal-armor", ["6A-timed-effects"]],
  ["6B-zone-geometry", ["6A-timed-effects"]],
  ["6B-cast-riders", ["6A-apmp-retrait", "6A-heal-armor", "6B-zone-geometry"]],
  ["6C-push-fidelity", []],
  ["6C-combatants-list", ["6C-push-fidelity"]],
  ["6D-summon", ["6B-cast-riders", "6C-combatants-list"]],
  ["6D-boss-carapace", ["6D-summon"]],
];

function wave6Gaps(backlog: Backlog): string[] {
  return WAVE6_TASKS.flatMap(([id, deps]) => {
    const task = taskById(backlog, id);
    if (task === undefined) return [`${id}:absent`];
    const statuses = task.status === "todo" ? [] : [`${id}:${task.status}`];
    const spec = (task.notes ?? "").includes(WAVE6_SPEC) ? [] : [`${id}:notes`];
    const wired = JSON.stringify(task.depends_on ?? []) === JSON.stringify(deps) ? [] : [`${id}:depends_on`];
    return [...statuses, ...spec, ...wired];
  });
}

describe("backlog — vague 6 moteur d'effets", () => {
  it("déclare les dix tâches en todo, notées vers la spec", () => {
    expect(wave6Gaps(readBacklog())).toEqual([]);
  });

  it("les répartit dans les phases existantes 6A à 6D", () => {
    const backlog = readBacklog();
    expect(taskIdsOf(backlog, "6A")).toEqual([
      "6A-effects-schema",
      "6A-timed-effects",
      "6A-apmp-retrait",
      "6A-heal-armor",
    ]);
    expect(taskIdsOf(backlog, "6B")).toEqual(["6B-zone-geometry", "6B-cast-riders"]);
    expect(taskIdsOf(backlog, "6C")).toEqual(["6C-push-fidelity", "6C-combatants-list"]);
    expect(taskIdsOf(backlog, "6D")).toEqual(["6D-summon", "6D-boss-carapace"]);
  });

  it("n'ouvre aucune phase 6E ni suffixe hors motif A-D", () => {
    const backlog = readBacklog();
    const phases = allPhases(backlog).map((phase) => phase.id).filter((id) => id.startsWith("6"));
    expect(phases).toEqual(["6A", "6B", "6C", "6D"]);
    const prefixes = new Set(allTasks(backlog).filter((task) => task.id.startsWith("6")).map((task) => task.id.slice(0, 2)));
    expect([...prefixes].sort()).toEqual(["6A", "6B", "6C", "6D"]);
  });
});

const AUDITS_22_11: Array<[string, string, string, string]> = [
  ["D65", "medium", "6A-effects-schema", "cooldown"],
  ["D66", "medium", "6B-cast-riders", "coup_daile_gras"],
  ["D67", "medium", "5D-a", "recommendedLevel"],
];

function audit22Gaps(backlog: Backlog): string[] {
  return AUDITS_22_11.flatMap(([id, severity, target, keyword]) => {
    const debt = debtById(backlog, id);
    if (debt === undefined) return [`${id}:absent`];
    const graded = debt.severity === severity && debt.target === target ? [] : [`${id}:${debt.severity}->${debt.target}`];
    const noted = (debt.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    return [...graded, ...noted];
  });
}

describe("backlog — dettes des audits du 22/11", () => {
  it("verse D65, D66 et D67 avec sévérité, cible et note factuelle", () => {
    expect(audit22Gaps(readBacklog())).toEqual([]);
  });
});
