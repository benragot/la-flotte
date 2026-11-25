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
const WAVE_ID_PATTERN = /^wave-\d+(?:\.\d+)?$/;
const PHASE_ID_PATTERN = /^\d(?:\.\d)?[A-D]$/;
const TASK_ID_PATTERN = /^\d(?:\.\d)?[A-D]-[a-z0-9-]+$/;
/** `D96`→`D99` épuisent les deux chiffres ; trois chiffres dès `D100`, sans zéro de tête. */
const DEBT_ID_PATTERN = /^D(?:0[1-9]|[1-9]\d{1,2})$/;

interface Task {
  id: string;
  title: string;
  status: string;
  owner?: string;
  priority?: string;
  updated_at?: string;
  pr?: number;
  depends_on?: string[];
  /** Périmètre d'écriture : `external` renvoie l'action à `owner` (humain). */
  target?: string;
  notes?: string;
}

interface Phase {
  id: string;
  title?: string;
  status?: string;
  tasks?: Task[];
  depends_on?: string[];
  notes?: string;
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
  /** `blocked` : dépend d'un arbitrage ou d'un recalibrage hors périmètre agent. */
  status?: string;
  notes?: string;
}

interface Meta {
  version: number;
  updated_at: string;
  updated_by: string;
  statuses: string[];
  /** Échelle de sévérité des dettes, déclarée dans le fichier (dette D60). */
  debt_severities: string[];
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
  const valid = new Set(backlog.meta.debt_severities);
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
  const meta = {
    version: 3,
    updated_at: "2026-11-22",
    updated_by: "integrator",
    statuses: REQUIRED_STATUSES,
    debt_severities: ["low", "medium", "high"],
  };
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

/**
 * Un id de dette n'a qu'UNE graphie : la garde anti-doublon compare des chaînes
 * brutes, donc `D096` est un alias de `D96` et échapperait à la détection.
 */
const INVALID_DEBT_IDS = ["D1", "d100", "D-1", "D1000", "D0123", "XD100", "D100 ", "D000", "D096"];

function acceptedInvalidDebtIds(): string[] {
  return INVALID_DEBT_IDS.filter((id) => DEBT_ID_PATTERN.test(id));
}

describe("backlog — une seule graphie par id de dette", () => {
  it("rejette les zéros de tête, les alias à trois chiffres, les préfixes et les espaces", () => {
    expect(acceptedInvalidDebtIds()).toEqual([]);
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

describe("backlog — dette D55 soldée", () => {
  it("ne trouve plus la dette du coffre non persisté, soldée par la PR #87", () => {
    expect(debtById(readBacklog(), "D55")).toBeUndefined();
    expect(rawBacklog()).not.toContain("Le coffre de banque n'est pas persisté");
  });
});

describe("backlog — dette D84 soldée", () => {
  it("ne trouve plus la dette de la mesure unique du canvas, soldée par la stabilisation du harnais", () => {
    expect(debtById(readBacklog(), "D84")).toBeUndefined();
    expect(rawBacklog()).not.toContain("`boxOf` mesure une seule fois");
  });
});

describe("backlog — dette D98 soldée", () => {
  it("ne trouve plus la dette du clamp x-only, soldée par le clamp vertical des étiquettes", () => {
    expect(debtById(readBacklog(), "D98")).toBeUndefined();
    expect(rawBacklog()).not.toContain("le clamp des étiquettes est x-only");
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

  it("cible 5B et une tâche d'interface quand la dette reste dans le périmètre projet", () => {
    const backlog = readBacklog();
    expect(debtById(backlog, "D49")?.target).toBe("5B");
    expect(debtById(backlog, "D53")?.target).toBe("5C-cast-preview");
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
});

describe("backlog — dettes versées en v15", () => {
  const VERSED = ["D56", "D57", "D58"];

  it("enregistre les trois dettes restantes de la 5B", () => {
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

  it("lit l'échelle dans meta et non dans une constante du test", () => {
    const fixture = fixtureBacklog([fixturePhase("5B", "in_progress")]);
    fixture.meta.debt_severities = ["low", "high"];
    fixture.debts = [{ id: "D01", title: "Dette medium hors d'une échelle rétrécie", severity: "medium", target: "5B" }];
    expect(invalidDebtSeverities(fixture)).toEqual(["D01"]);
  });
});

/**
 * Un tuple = une tâche, sa PR et **la liste des squashes** qu'elle doit citer.
 * Une liste, et pas un sha seul : `5C-path-8dirs` est close par deux livraisons
 * — `c5b8867` (PR #108, le moteur) et `65e194a` (PR #113, le TC3 et le §1 de la
 * spec alignés sur DEC-10) — et coller `65e194a` à la PR #108 faisait mentir la
 * table. Toute la liste est exigée, pas seulement le premier sha.
 */
const DELIVERED_5C: Array<[string, number, string[]]> = [
  ["5C-a", 44, ["f6a113e"]],
  ["5C-e", 45, ["8a84b15"]],
  ["5C-b", 46, ["32ae2a3"]],
  ["5C-c", 48, ["74e739d"]],
  ["5C-explore-hp", 109, ["2793727"]],
  ["5C-hover-highlight", 110, ["326988d"]],
  ["5C-cast-cadence", 111, ["b1bf9a8"]],
  ["5C-path-8dirs", 108, ["c5b8867", "65e194a"]],
  ["5C-heal-between-rooms", 80, ["576181f"]],
];

const OPEN_5C = [
  "5C-actor-ring",
  "5C-hover-hp",
  "5C-pm-zone",
  "5C-hero-move",
  "5C-cast-preview",
  "5C-turn-rail",
  "5C-info-panel",
  "5C-group-stars",
  "5C-log-channel",
  "5C-set-panoplies",
  "5C-equip-requirements",
  "5C-spell-range-rebalance",
];

function deliveryGaps(backlog: Backlog): string[] {
  return DELIVERED_5C.flatMap(([id, pr, squashes]) => {
    const task = taskById(backlog, id);
    const notes = task?.notes ?? "";
    const ok = task?.status === "done" && task.pr === pr && squashes.every((sha) => notes.includes(sha));
    const missing = squashes.filter((sha) => !notes.includes(sha));
    return ok ? [] : [`${id}:${task?.status ?? "absent"}:${missing.join("+")}`];
  });
}

describe("backlog — vague 5C/5D après les merges #46 et #48", () => {
  it("enregistre chaque livraison 5C avec sa PR et toute sa liste de squashes", () => {
    expect(deliveryGaps(readBacklog())).toEqual([]);
  });

  it("garde 5C ouverte sur les douze tâches restantes, 5C-d livrée par #50", () => {
    const backlog = readBacklog();
    expect(taskById(backlog, "5C-d")?.status).toBe("done");
    const open = taskIdsOf(backlog, "5C").filter((id) => taskById(backlog, id)?.status !== "done");
    expect(open).toEqual(OPEN_5C);
  });

  it("référence 5C-b, 5C-c, 5C-d et 5D-a dans les bonnes phases", () => {
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

  it("exige que 5C-d soit livrée par la PR #50 (portée et LoS)", () => {
    const task = taskById(readBacklog(), "5C-d");
    expect(task?.status).toBe("done");
    expect(task?.pr).toBe(50);
    expect(task?.notes ?? "").toContain("c45708f");
  });
});

describe("backlog — dettes des audits #44/#45", () => {
  const AUDITS: Array<[string, string, string]> = [
    ["D59", "medium", "5B"],
    ["D62", "low", "5C-hover-hp"],
    ["D63", "medium", "5C-turn-rail"],
  ];

  function auditGaps(backlog: Backlog): string[] {
    return AUDITS.flatMap(([id, severity, target]) => {
      const debt = debtById(backlog, id);
      return debt?.severity === severity && debt.target === target ? [] : [id];
    });
  }

  it("verse les dettes restantes avec leur sévérité et leur cible", () => {
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
  ["D67", "medium", "external", "recommendedLevel"],
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

const UI_SPEC = "docs/design/specs/ui-dofus-retro.md";
const ROADMAP = "docs/design/ROADMAP_AUTONOME.md";
const UI_TASKS: Array<[string, string, string[]]> = [
  ["5C-actor-ring", "5C", []],
  ["5C-hover-hp", "5C", ["5C-actor-ring"]],
  ["5C-pm-zone", "5C", ["5C-actor-ring"]],
  ["5C-hero-move", "5C", ["5C-path-8dirs"]],
  ["5C-cast-preview", "5C", ["5C-pm-zone", "5C-path-8dirs"]],
  ["5C-turn-rail", "5C", ["5C-actor-ring"]],
  ["5C-info-panel", "5C", ["5C-actor-ring"]],
  ["5C-group-stars", "5C", []],
  ["5C-log-channel", "5C", []],
  ["5C-set-panoplies", "5C", []],
  ["5D-hud-bar", "5D", ["5C-turn-rail"]],
  ["5D-death-end", "5D", []],
];
const UI_RULES = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];

function uiTaskGaps(backlog: Backlog): string[] {
  return UI_TASKS.flatMap(([id, phaseId, deps]) => {
    const task = taskById(backlog, id);
    if (task === undefined) return [`${id}:absent`];
    const status = task.status === "todo" ? [] : [`${id}:${task.status}`];
    const notes = task.notes ?? "";
    const spec = notes.includes(UI_SPEC) ? [] : [`${id}:notes`];
    const section = /§\d/.test(notes) ? [] : [`${id}:section`];
    const wired = JSON.stringify(task.depends_on ?? []) === JSON.stringify(deps) ? [] : [`${id}:depends_on`];
    const placed = taskIdsOf(backlog, phaseId).includes(id) ? [] : [`${id}:phase`];
    return [...status, ...spec, ...section, ...wired, ...placed];
  });
}

function uiNoteText(backlog: Backlog): string {
  return UI_TASKS.map(([id]) => taskById(backlog, id)?.notes ?? "").join(" | ");
}

function uncitedRules(backlog: Backlog): string[] {
  const notes = uiNoteText(backlog);
  return UI_RULES.filter((rule) => !notes.includes(rule));
}

function uncheckedRoadmapLines(): string[] {
  return readFileSync(join(process.cwd(), ROADMAP), "utf8").split("\n");
}

describe("backlog — spec UI Dofus Retro", () => {
  it("écrit la spec avec ses métadonnées et ses onze sections", () => {
    const text = readFileSync(join(process.cwd(), UI_SPEC), "utf8");
    expect(text).toContain("title: Interface Dofus 1.29 / Retro — exploration et combat");
    expect(text).toContain("status: spec");
    expect(text).toContain("tags: [ui, retrospective, fidelity]");
    const sections = Array.from({ length: 11 }, (_, index) => `## ${index + 1}.`);
    expect(sections.filter((heading) => !text.includes(heading))).toEqual([]);
  });

  it("déclare les huit règles d'état R1 à R8", () => {
    const text = readFileSync(join(process.cwd(), UI_SPEC), "utf8");
    expect(UI_RULES.filter((rule) => !text.includes(`${rule}.`))).toEqual([]);
  });
});

describe("backlog — tâches d'interface Dofus Retro", () => {
  it("ouvre les douze tâches en todo dans 5C et 5D", () => {
    expect(uiTaskGaps(readBacklog())).toEqual([]);
  });

  it("acte 5C-path-8dirs done sans perdre sa spec ni sa section", () => {
    const task = taskById(readBacklog(), "5C-path-8dirs");
    expect(task?.status).toBe("done");
    const notes = task?.notes ?? "";
    expect(notes).toContain(UI_SPEC);
    expect(notes).toMatch(/§\d/);
  });

  it("renvoie chaque tâche vers la spec et cite les règles R1 à R8", () => {
    const backlog = readBacklog();
    expect(uncitedRules(backlog)).toEqual([]);
  });

  it("inscrit les tâches décochées dans la roadmap", () => {
    const lines = uncheckedRoadmapLines();
    const missing = UI_TASKS.filter(([id]) => !lines.some((line) => line.startsWith(`- [ ] ${id}`)));
    expect(missing.map(([id]) => id)).toEqual([]);
    expect(lines.join("\n")).toContain(UI_SPEC);
  });

  it("documente le sprite procédural de l'anneau plutôt qu'une dépendance spritesheets", () => {
    const task = taskById(readBacklog(), "5C-actor-ring");
    expect(task?.notes ?? "").toContain("procédural");
    expect(task?.depends_on ?? []).not.toContain("7A-spritesheets");
  });
});

describe("backlog — dettes de l'audit UI et donjon du 22/11", () => {
  const UI_DEBTS: Array<[string, string, string, string]> = [
    ["D70", "medium", "5C-hero-move", "resolveTackle"],
    ["D71", "high", "5C-set-panoplies", "panoplies"],
    ["D72", "medium", "5C-set-panoplies", "minRange"],
    ["D73", "high", "6C-combatants-list", "findSpell"],
  ];

  function uiDebtGaps(backlog: Backlog): string[] {
    return UI_DEBTS.flatMap(([id, severity, target, keyword]) => {
      const debt = debtById(backlog, id);
      if (debt === undefined) return [`${id}:absent`];
      const graded = debt.severity === severity && debt.target === target ? [] : [`${id}:${debt.severity}->${debt.target}`];
      const noted = (debt.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
      return [...graded, ...noted];
    });
  }

  it("verse D70 à D73 avec sévérité, cible et note factuelle", () => {
    expect(uiDebtGaps(readBacklog())).toEqual([]);
  });

  it("grade en high D71 et D73", () => {
    const backlog = readBacklog();
    expect(debtById(backlog, "D71")?.severity).toBe("high");
    expect(debtById(backlog, "D73")?.severity).toBe("high");
  });

  it("solde D68 et D69 avec la tâche moteur 5C-path-8dirs", () => {
    const backlog = readBacklog();
    expect(debtById(backlog, "D68")).toBeUndefined();
    expect(debtById(backlog, "D69")).toBeUndefined();
    expect(taskById(backlog, "5C-path-8dirs")?.status).toBe("done");
  });
});

describe("backlog — dette D64 soldée", () => {
  it("ne trouve plus la dette de portée et de LoS, livrée par la PR #50", () => {
    expect(debtById(readBacklog(), "D64")).toBeUndefined();
  });

  it("n'exige plus le contrôle de portée absent dans les dettes", () => {
    expect(rawBacklog()).not.toContain("le joueur frappe à distance infinie");
  });
});

const DUNGEON_TASKS: Array<[string, number, string]> = [
  ["5D-a", 56, "0030f74"],
  ["5D-b", 57, "ec0e42c"],
];

describe("backlog — jalon « donjon jouable » (v19)", () => {
  it("enregistre 5D-a et 5D-b en done avec leur PR et leur squash", () => {
    const backlog = readBacklog();
    const gaps = DUNGEON_TASKS.flatMap(([id, pr, squash]) => {
      const task = taskById(backlog, id);
      const ok = task?.status === "done" && task.pr === pr && (task.notes ?? "").includes(squash);
      return ok ? [] : [id];
    });
    expect(gaps).toEqual([]);
  });

  it("compte les 451 lignes réelles du walkthrough play.spec.ts", () => {
    expect(taskById(readBacklog(), "5D-b")?.notes ?? "").toContain("451");
  });

  it("ouvre la phase 5D et acte le donjon jouable depuis l'exploration", () => {
    const phase = phaseById(readBacklog(), "5D");
    expect(phase?.status).toBe("in_progress");
    expect((phase?.tasks ?? []).map((task) => task.id)).toEqual(expect.arrayContaining(["5D-a", "5D-b"]));
    expect(phase?.notes ?? "").toContain("Donjons");
    expect(phase?.notes ?? "").toContain("jouable");
  });

  it("versionne le backlog en 32", () => {
    expect(readBacklog().meta.version).toEqual(32);
  });
});

const FOLLOW_UP_TASKS: Array<[string, string[]]> = [
  ["5C-hero-move", ["5C-path-8dirs"]],
  ["5C-set-panoplies", []],
];

describe("backlog — suite ouverte en v19", () => {
  it("crée 5C-hero-move en todo, après le pathfinding 8 directions", () => {
    const task = taskById(readBacklog(), "5C-hero-move");
    expect(task?.status).toBe("todo");
    expect(task?.priority).toBe("high");
    expect(task?.depends_on).toEqual(["5C-path-8dirs"]);
    expect(`${task?.title} ${task?.notes}`).toContain("PM");
  });

  it("crée 5C-set-panoplies en todo, sans dépendance, comme levier de survie", () => {
    const task = taskById(readBacklog(), "5C-set-panoplies");
    expect(task?.status).toBe("todo");
    expect(task?.priority).toBe("high");
    expect(task?.depends_on ?? []).toEqual([]);
    expect(task?.notes ?? "").toContain("2 objets de départ");
    expect(task?.notes ?? "").toContain("calibré pour un héros équipé");
  });

  it("les place toutes deux dans la phase 5C", () => {
    const ids = taskIdsOf(readBacklog(), "5C");
    expect(FOLLOW_UP_TASKS.filter(([id]) => !ids.includes(id)).map(([id]) => id)).toEqual([]);
  });
});

const V19_DEBTS: Array<[string, string, string, string]> = [
  ["D74", "low", "5C-info-panel", "canUseConsumable"],
  ["D75", "high", "5C-hero-move", "useCombatStore"],
  ["D76", "medium", "5C-turn-rail", "Ctrl+Fin"],
];

function v19DebtGaps(backlog: Backlog): string[] {
  return V19_DEBTS.flatMap(([id, severity, target, keyword]) => {
    const debt = debtById(backlog, id);
    if (debt === undefined) return [`${id}:absent`];
    const graded = debt.severity === severity && debt.target === target ? [] : [`${id}:${debt.severity}->${debt.target}`];
    const noted = (debt.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    return [...graded, ...noted];
  });
}

describe("backlog — dettes versées en v19", () => {
  it("verse D74, D75 et D76 avec sévérité, cible et note factuelle", () => {
    expect(v19DebtGaps(readBacklog())).toEqual([]);
  });

  it("ne grade en high que le déplacement absent du héros", () => {
    const backlog = readBacklog();
    expect(debtById(backlog, "D74")?.severity).toBe("low");
    expect(debtById(backlog, "D75")?.severity).toBe("high");
  });

  it("décrit D74 contre l'arbre réel de #59 : seul `canUseConsumable` subsiste", () => {
    const debt = debtById(readBacklog(), "D74");
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("canUseConsumable");
    expect(text).toContain("#59");
    expect(text).toContain("D45b");
    expect(text).toContain("D30");
    expect(text).not.toContain("vitality");
    expect(text).not.toContain("CombatHud");
  });

  it("garde Espace et note qu'il faut ajouter Ctrl+Fin", () => {
    const notes = debtById(readBacklog(), "D76")?.notes ?? "";
    expect(notes).toContain("Espace");
    expect(notes).toContain("src/ui/shortcuts.ts");
  });
});

describe("backlog — plus aucune dette ne vise une phase 5C", () => {
  it("recible chaque dette de phase sur une tâche ou l'extérieur", () => {
    const stale = readBacklog().debts.filter((debt) => debt.target === "5C").map((debt) => debt.id);
    expect(stale).toEqual([]);
  });

  it("résout D60 en déclarant l'échelle des sévérités dans meta", () => {
    expect(debtById(readBacklog(), "D60")).toBeUndefined();
    expect(readBacklog().meta.debt_severities).toEqual(["low", "medium", "high"]);
  });
});

describe("backlog — D45 restreinte aux résistances", () => {
  it("ne garde que les résistances et acte la fermeture de D45a", () => {
    const debt = debtById(readBacklog(), "D45");
    expect(debt?.severity).toBe("high");
    expect(debt?.target).toBe("5C-set-panoplies");
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("résistances");
    expect(text).toContain("zeroResistances");
    expect(text).toContain("D45a");
    expect(text).toContain("#58");
    expect(text).not.toContain("jette `vitality`");
  });
});

describe("backlog — D71 remesurée par #57", () => {
  it("acte la mort en salle 2, le capital en Force et le build Vitalité non mesuré", () => {
    const debt = debtById(readBacklog(), "D71");
    expect(debt?.severity).toBe("high");
    expect(debt?.target).toBe("5C-set-panoplies");
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("salle 2");
    expect(text).toContain("Force");
    expect(text).toContain("130 PV");
    expect(text).toContain("chapeau");
    expect(text).toContain("62");
    expect(text).toContain("205");
    expect(text).not.toContain("investis en Vitalité");
    expect(text).not.toContain("salles 3 et 4");
  });
});

describe("backlog — D67 : l'avertissement est livré, la décision reste ouverte", () => {
  it("ne parle plus d'absence d'avertissement et renvoie la décision hors périmètre agent", () => {
    const debt = debtById(readBacklog(), "D67");
    expect(debt?.severity).toBe("medium");
    expect(debt?.target).toBe("external");
    expect(debt?.owner).toBe("user");
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("Niveau recommandé");
    expect(text).toContain("décision");
    expect(text).not.toContain("rien ne gate");
  });
});

describe("backlog — D72 : le walkthrough ne prouve pas la viabilité", () => {
  it("garde HERO_ATTACK sans portée et renvoie la mesure à la panoplie", () => {
    const debt = debtById(readBacklog(), "D72");
    expect(debt?.severity).toBe("medium");
    expect(debt?.target).toBe("5C-set-panoplies");
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("HERO_ATTACK");
    expect(text).toContain("minRange");
    expect(text).toContain("#56");
  });
});

describe("backlog — roadmap v19", () => {
  it("coche 5D-a et 5D-b", () => {
    const lines = uncheckedRoadmapLines();
    const unchecked = ["5D-a", "5D-b"].filter((id) => !lines.some((line) => line.startsWith(`- [x] ${id}`)));
    expect(unchecked).toEqual([]);
    const stillOpen = lines.filter((line) => /^- \[ \] 5D-[ab]\b/.test(line));
    expect(stillOpen).toEqual([]);
  });
});

const GAP_SPEC = "docs/design/specs/dofus-1.29-gaps.md";
const GAP_METHOD = [
  "Cette analyse confronte une **synthèse documentaire** de Dofus 1.29",
  "sans sources primaires systématiques",
  "Chaque verdict est appuyé sur un `fichier:ligne`",
  "Aucune ligne n'est déduite de la lecture du document seul",
];

interface GapRow {
  id: string;
  system: string;
  verdict: string;
}

/**
 * Quinze systèmes confrontés au code. Le verdict est figé ici : c'est la
 * conclusion de l'analyse, pas une case à cocher après coup.
 */
const GAP_ROWS: readonly GapRow[] = [
  { id: "1", system: "Pods", verdict: "absent" },
  { id: "2", system: "Métiers de récolte", verdict: "absent" },
  { id: "3", system: "Sorties de map", verdict: "absent" },
  { id: "4", system: "corps-à-corps", verdict: "absent" },
  { id: "5", system: "Médaillon", verdict: "absent" },
  { id: "6", system: "Canaux de chat", verdict: "partiel" },
  { id: "7", system: "Carte du monde", verdict: "absent" },
  { id: "8", system: "Conditions d'équipement", verdict: "absent" },
  { id: "9", system: "Tacle", verdict: "partiel" },
  { id: "10", system: "Poussée", verdict: "partiel" },
  { id: "11", system: "Timeline", verdict: "partiel" },
  { id: "12", system: "création", verdict: "présent" },
  { id: "13", system: "Envoûtements", verdict: "partiel" },
  { id: "14", system: "Compte à rebours", verdict: "absent" },
  { id: "15", system: "Sorts de classe", verdict: "partiel" },
];

const DROPPED_SYSTEMS = [
  "navires",
  "multi-joueurs",
  "guildes",
  "hôtels de vente",
  "marchand",
  "zaaps",
  "montures",
  "alignement",
  "quêtes de PNJ",
  "échanges",
  "amis",
  "scaéroplanes",
  "maisons",
  "spectateurs",
  "éventail",
];

const PROOF_PATTERN = /\.(?:ts|tsx|yaml|md|jsonc):\d+/;

function gapSpecText(): string {
  return readFileSync(join(process.cwd(), GAP_SPEC), "utf8");
}

/** Cellules non vides d'une ligne de tableau `| # | système | verdict | preuve | manque |`. */
function gapCells(text: string, id: string): string[] {
  const line = text.split("\n").find((entry) => entry.trim().startsWith(`| ${id} |`));
  if (line === undefined) return [];
  return line.split("|").map((cell) => cell.trim()).filter((cell) => cell !== "");
}

/** Preuve recevable : un `fichier:ligne` réel, ou l'aveu explicite d'une recherche vide. */
function isProof(cell: string): boolean {
  return PROOF_PATTERN.test(cell) || cell.includes("recherche :");
}

function gapFailures(text: string): string[] {
  return GAP_ROWS.flatMap(({ id, system, verdict }) => {
    const cells = gapCells(text, id);
    if (cells.length < 5) return [`${id}:row`];
    const named = cells[1]?.includes(system) === true ? [] : [`${id}:system`];
    const graded = cells[2] === verdict ? [] : [`${id}:${cells[2] ?? "?"}`];
    const proven = isProof(cells[3] ?? "") ? [] : [`${id}:proof`];
    const missing = isFilled(cells[4]) ? [] : [`${id}:missing`];
    return [...named, ...graded, ...proven, ...missing];
  });
}

function droppedLines(text: string): string[] {
  const section = text.split("## Ce qui a été délibérément écarté")[1] ?? "";
  return section.split("\n").filter((line) => line.startsWith("- "));
}

function droppedFailures(text: string): string[] {
  const lines = droppedLines(text).map((line) => line.toLowerCase());
  const unfilled = DROPPED_SYSTEMS.filter((system) => !lines.some((line) => line.includes(system.toLowerCase())));
  const unargued = droppedLines(text).filter((line) => !line.includes(" — "));
  return [...unfilled.map((system) => `absent:${system}`), ...unargued.map((line) => `argument:${line}`)];
}

describe("backlog — analyse d'écart Dofus 1.29 contre le code réel (v20)", () => {
  it("écrit la spec d'écart avec son avertissement de méthode", () => {
    const text = gapSpecText();
    expect(text).toContain("title: Écarts Dofus 1.29 — ce que le code fait vraiment");
    expect(text).toContain("status: spec");
    expect(GAP_METHOD.filter((sentence) => !text.includes(sentence))).toEqual([]);
  });

  it("tranche les quinze systèmes avec un verdict et une preuve fichier:ligne", () => {
    expect(gapFailures(gapSpecText())).toEqual([]);
  });

  it("n'écrit aucun verdict hors des quatre mots autorisés", () => {
    const verdicts = GAP_ROWS.map(({ id }) => gapCells(gapSpecText(), id)[2]);
    const allowed = new Set(["présent", "partiel", "absent", "contredit"]);
    expect(verdicts.filter((verdict) => verdict !== undefined && !allowed.has(verdict))).toEqual([]);
    expect(new Set(GAP_ROWS.map(({ id }) => id)).size).toBe(GAP_ROWS.length);
  });

  it("liste ce qui a été délibérément écarté, chaque ligne justifiée", () => {
    expect(droppedFailures(gapSpecText())).toEqual([]);
  });
});

const GAP_TASKS: Array<[string, string, string]> = [
  ["5C-equip-requirements", "5C", "itemSchema"],
  ["5D-exits", "5D", "maps[0]"],
];

function gapTaskGaps(backlog: Backlog): string[] {
  return GAP_TASKS.flatMap(([id, phaseId, keyword]) => {
    const task = taskById(backlog, id);
    if (task === undefined) return [`${id}:absent`];
    const status = task.status === "todo" ? [] : [`${id}:${task.status}`];
    const graded = task.priority === "high" ? [] : [`${id}:priority`];
    const noted = (task.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    const placed = taskIdsOf(backlog, phaseId).includes(id) ? [] : [`${id}:phase`];
    return [...status, ...graded, ...noted, ...placed];
  });
}

const GAP_DEBTS: Array<[string, string, string, string]> = [
  ["D78", "medium", "5B", "pods"],
  ["D79", "low", "7B", "récolte"],
  ["D80", "medium", "5C-turn-rail", "médaillon"],
  ["D81", "low", "5C-log-channel", "canal"],
  ["D82", "high", "6B-cast-riders", "damageLines"],
];

function gapDebtGaps(backlog: Backlog): string[] {
  return GAP_DEBTS.flatMap(([id, severity, target, keyword]) => {
    const debt = debtById(backlog, id);
    if (debt === undefined) return [`${id}:absent`];
    const graded = debt.severity === severity && debt.target === target ? [] : [`${id}:${debt.severity}->${debt.target}`];
    const noted = (debt.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    const titled = isFilled(debt.title) ? [] : [`${id}:title`];
    return [...graded, ...noted, ...titled];
  });
}

describe("backlog — suites ouvertes par l'analyse d'écart", () => {
  it("ouvre trois tâches en todo dans 5C et 5D", () => {
    expect(gapTaskGaps(readBacklog())).toEqual([]);
  });

  it("verse D78 à D82 avec sévérité, cible et note factuelle", () => {
    expect(gapDebtGaps(readBacklog())).toEqual([]);
  });

  it("inscrit les deux tâches restantes décochées dans la roadmap", () => {
    const lines = uncheckedRoadmapLines();
    const missing = GAP_TASKS.filter(([id]) => !lines.some((line) => line.startsWith(`- [ ] ${id}`)));
    expect(missing.map(([id]) => id)).toEqual([]);
    expect(lines.join("\n")).toContain(GAP_SPEC);
  });

  it("ne rouvre pas deux fois le même système : une tâche par blocage, le reste en dette", () => {
    const open = allTasks(readBacklog())
      .filter((task) => task.status !== "done")
      .map((task) => task.id)
      .filter((id) => id === "5C-equip-requirements" || id === "5D-new-game" || id === "5D-exits");
    expect(open).toEqual(["5C-equip-requirements", "5D-exits"]);
  });
});

function limitsSection(): string {
  const text = readFileSync(join(process.cwd(), UI_SPEC), "utf8");
  return text.split("## 12. Limites connues du rendu iso")[1] ?? "";
}

describe("backlog — limites assumées du rendu iso (PR #68)", () => {
  it("documente le flou d'écran et les coins vides comme des choix mesurés", () => {
    const text = readFileSync(join(process.cwd(), UI_SPEC), "utf8");
    expect(text).toContain("## 12. Limites connues du rendu iso");
    expect(text).toContain("choix assumés, mesurés, pas des oublis");
    expect(text).toContain("Flou d'écran");
    expect(text).toContain("1,33");
    expect(text).toContain("2,19");
    expect(text).toContain("nearest");
    expect(text).toContain("SPRITE_FRAME_SIZE");
    expect(text).toContain("128 px");
  });

  it("ne promet plus de feuilles à générer ni un rastérisé en 64 px", () => {
    const section = limitsSection();
    expect(section).not.toContain("SPRITE_FRAME_SIZE = 64");
    expect(section).not.toContain("Piste : feuilles de sprites");
    expect(section).not.toContain("cela demande des feuilles en **2×**");
    expect(section).toContain("ne déclenche aucun événement");
  });

  it("démontre c ≥ 2 pour un losange de même rapport et ×2,5 pour un 4:3 en 2:1", () => {
    const section = limitsSection();
    expect(section).toContain("2/c");
    expect(section).toContain("c ≥ 2");
    expect(section).toContain("2,5");
    expect(section).toContain("2:1");
    expect(section).toContain("les quatre coins");
    expect(section).toContain("moitié de sa boîte englobante");
  });

  it("n'affirme plus un facteur ×4 ni un remplissage de 73 %", () => {
    const section = limitsSection();
    expect(section).not.toContain("≥ ×4");
    expect(section).not.toContain("73 %");
    expect(section).not.toContain("4/c");
  });
});

describe("backlog — corrections d'audit de l'analyse d'écart", () => {
  it("compte 26 sorts non inertes sur 44 au lieu de 20", () => {
    const text = gapSpecText();
    expect(text).toContain("26 sorts non inertes sur 44");
    expect(text).not.toContain("20 sorts castables");
  });

  it("écrit cinq cartes et l'impossibilité de quitter maps[0]", () => {
    const row = gapCells(gapSpecText(), "3").join(" | ");
    expect(row).toContain("5 cartes");
    expect(row).toContain("maps[0]");
    expect(gapSpecText()).not.toContain("une seule carte 12×12");
  });

  it("distingue le 1vN du donjon (un sort) du 1v1 d'exploration (12 emplacements)", () => {
    const text = gapSpecText();
    expect(text).toContain("heroDamageSpell");
    expect(text).toContain("SPELL_SLOT_COUNT");
    expect(text).toContain("12 emplacements");
  });
});

describe("backlog — D77 : faux vert du harnais Playwright", () => {
  it("grade en high le port 4173 codé en dur et la réutilisation d'un serveur local", () => {
    const debt = debtById(readBacklog(), "D77");
    expect(debt?.severity).toBe("high");
    expect(debt?.target).toBe("external");
    expect(debt?.owner).toBe("user");
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("reuseExistingServer");
    expect(text).toContain("4173");
    expect(text).toContain("playwright.config.ts");
    expect(text).toContain("CI");
    expect(text).toContain("src/renderer/**");
  });
});

const RENDER_TASKS: Array<[string, string, string]> = [
  ["7A-arena-background", "7A", "fond d'arène"],
];

function renderTaskGaps(backlog: Backlog): string[] {
  return RENDER_TASKS.flatMap(([id, phaseId, keyword]) => {
    const task = taskById(backlog, id);
    if (task === undefined) return [`${id}:absent`];
    const status = task.status === "todo" ? [] : [`${id}:${task.status}`];
    const noted = (task.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    const placed = taskIdsOf(backlog, phaseId).includes(id) ? [] : [`${id}:phase`];
    return [...status, ...noted, ...placed];
  });
}

describe("backlog — coins vides : une tâche de rendu, pas une dette", () => {
  it("ouvre 7A-arena-background en todo dans la phase 7A", () => {
    expect(renderTaskGaps(readBacklog())).toEqual([]);
  });

  it("renvoie la géométrie du losange et refuse les cases factices", () => {
    const notes = taskById(readBacklog(), "7A-arena-background")?.notes ?? "";
    expect(notes).toContain("dofus-1.29-gaps.md");
    expect(notes).toContain("cases factices");
    expect(notes).toContain("pathfinding");
  });

  it("inscrit la tâche décochée dans la roadmap", () => {
    const lines = uncheckedRoadmapLines();
    expect(lines.some((line) => line.startsWith("- [ ] 7A-arena-background"))).toBe(true);
  });

  it("note la démonstration corrigée : c ≥ 2, ×2,5 en 4:3, jamais ×4", () => {
    const notes = taskById(readBacklog(), "7A-arena-background")?.notes ?? "";
    expect(notes).toContain("c ≥ 2");
    expect(notes).toContain("2,5");
    expect(notes).toContain("2:1");
    expect(notes).not.toContain("≥ ×4");
  });
});

describe("backlog — corrections des tâches ouvertes par l'écart", () => {
  it("écrit cinq cartes et maps[0] dans 5D-exits", () => {
    const notes = taskById(readBacklog(), "5D-exits")?.notes ?? "";
    expect(notes).toContain("5 cartes");
    expect(notes).toContain("maps[0]");
    expect(notes).not.toContain("une seule carte");
  });

  it("absorbe « équiper sans posséder » dans 5C-equip-requirements", () => {
    const notes = taskById(readBacklog(), "5C-equip-requirements")?.notes ?? "";
    expect(notes).toContain("takeFromBag");
    expect(notes).toContain("sans posséder");
    expect(notes).toContain("removeItem");
  });
});

const GAP_METHOD_PINS = [
  "Vérifié sur `main` @ ",
  "Cette analyse est un instantané",
  "figé par un test",
];

describe("backlog — verdict 12 livré par #69", () => {
  it("passe l'écran de création de absent à présent, avec la preuve du code livré", () => {
    const row = gapCells(gapSpecText(), "12").join(" | ");
    expect(row).toContain("présent");
    expect(row).toContain("newGame.ts");
    expect(row).toContain("NewGameButton.tsx");
    expect(row).not.toContain("resetGame` sans appelant");
  });

  it("retire la création des écarts sans solution et n'ouvre plus 5D-new-game", () => {
    const text = gapSpecText();
    expect(text).not.toContain("l'impossibilité de revenir à la création");
    expect(text).not.toContain("resetGame` n'a aucun appelant");
    const task = taskById(readBacklog(), "5D-new-game");
    expect(task?.status).toBe("done");
  });

  it("acte 5D-new-game done, PR #69, squash 0676a46, et la coche dans la roadmap", () => {
    const task = taskById(readBacklog(), "5D-new-game");
    expect(task?.pr).toBe(69);
    expect(task?.notes ?? "").toContain("0676a46");
    const lines = uncheckedRoadmapLines();
    expect(lines.some((line) => line.startsWith("- [x] 5D-new-game"))).toBe(true);
    expect(lines.some((line) => line.startsWith("- [ ] 5D-new-game"))).toBe(false);
  });

});

describe("backlog — méthode d'instantané et garde-fous du tableau", () => {
  it("écrit la note de méthode : instantané vérifié sur un sha de main", () => {
    const text = gapSpecText();
    expect(GAP_METHOD_PINS.filter((pin) => !text.includes(pin))).toEqual([]);
    expect(text).toMatch(/Vérifié sur `main` @ [0-9a-f]{7,40}/);
  });

  it("ne cite que des fichiers qui existent sur l'arbre", () => {
    expect(unknownCitations(gapSpecText())).toEqual([]);
  });

  it("n'écrit plus « une seule carte » ni dans §2 ni dans §4", () => {
    const text = gapSpecText();
    expect(text).not.toContain("une seule carte");
  });

  it("exprime ×2,5 sans ambiguïté : 1,25 × la largeur du viewport", () => {
    const section = limitsSection();
    expect(section).toContain("1,25 × la largeur du viewport");
    expect(section).not.toContain("l'échelle d'inscription");
    const notes = taskById(readBacklog(), "7A-arena-background")?.notes ?? "";
    expect(notes).toContain("1,25 × la largeur du viewport");
    expect(notes).not.toContain("l'échelle d'inscription");
  });

  it("compte huit absent, six partiel et un présent", () => {
    const counts = GAP_ROWS.reduce<Record<string, number>>((acc, row) => {
      acc[row.verdict] = (acc[row.verdict] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({ absent: 8, partiel: 6, "présent": 1 });
    const roadmap = uncheckedRoadmapLines().join("\n");
    expect(roadmap).toContain("six `partiel`, huit `absent`");
    expect(roadmap).toContain("un `présent`");
  });
});

const CITED_PATH = /([A-Za-z0-9_./-]+\.(?:ts|tsx|yaml|md)):\d+/g;

/** Toute preuve doit citer un fichier qui existe : un renommage casse le test. */
function unknownCitations(text: string): string[] {
  return GAP_ROWS.flatMap(({ id }) => {
    const cell = gapCells(text, id)[3] ?? "";
    return [...cell.matchAll(CITED_PATH)]
      .map((match) => match[1] ?? "")
      .filter((path) => !existsSync(join(process.cwd(), path)))
      .map((path) => `${id}:${path}`);
  });
}

const DECISIONS_PATH = "docs/design/DECISIONS.md";
const DECISION_NUMBERS = [
  "DEC-01",
  "DEC-02",
  "DEC-03",
  "DEC-04",
  "DEC-05",
  "DEC-06",
  "DEC-07",
  "DEC-08",
  "DEC-09",
  "DEC-10",
  "DEC-11",
  "DEC-12",
];

/** Les décisions du propriétaire sont normatives : leur suppression doit casser la CI.
 *  `DEC-10` épuise le préfixe à un chiffre : la numérotation accepte deux chiffres. */
function decisionHeadings(): string[] {
  const path = join(process.cwd(), DECISIONS_PATH);
  if (!existsSync(path)) return [];
  return [...readFileSync(path, "utf8").matchAll(/^## (DEC-\d{2}) — /gm)].map((match) => match[1] ?? "");
}

/** Une clause `**Interdit**` par décision : le corps ne peut pas être vidé sans rougir. */
function decisionInterdits(): string[] {
  const path = join(process.cwd(), DECISIONS_PATH);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter((line) => line.startsWith("**Interdit**"));
}

/** Le sens de la clause : une double négation dirait le contraire de la décision.
 * Limite assumée : ce garde-fou attrape la négation littérale (`ne pas`), **pas**
 * l'inversion par le verbe (« interdire les binaires » est une méta-prohibition qui
 * dit l'inverse de « tout binaire » interdit). Il ne remplace donc pas la relecture ;
 * la règle de rédaction est de **nommer l'objet interdit, pas l'acte d'interdire**.
 * On ne durcit pas la regex : elle produirait des faux positifs sur des tournures
 * légitimes (`ne peut pas quitter sa carte`, DEC-04). */
function negatedInterdits(): string[] {
  return decisionInterdits().filter((line) => /\bne pas\b/.test(line));
}

describe("backlog — décisions du propriétaire (v21)", () => {
  it("garde le fichier normatif et numérote DEC-01 à DEC-10", () => {
    expect(existsSync(join(process.cwd(), DECISIONS_PATH))).toBe(true);
    expect(decisionHeadings()).toEqual(DECISION_NUMBERS);
  });

  it("exige un **Interdit** par décision, rédigé en affirmatif", () => {
    expect(decisionInterdits()).toHaveLength(DECISION_NUMBERS.length);
    expect(negatedInterdits()).toEqual([]);
  });
});

/**
 * Dettes constatées le 22/11 hors de tout rapport d'agent : mergeurs concurrents,
 * harnais UI et play, couches de décor, constantes de sprite, chemins de la clef.
 * Chaque note porte un `fichier:ligne` : une dette sans localisation n'est pas
 * actionnable, donc elle n'est pas une dette.
 */
const TODAY_DEBTS: Array<[string, string, string, string]> = [
  ["D83", "high", "external", "pr-merger.md"],
  ["D85", "medium", "external", "eslint src tests"],
  ["D86", "medium", "5C-actor-ring", "locator(\"li\")"],
  ["D87", "medium", "7A-spritesheets", "decorAbove"],
  ["D88", "medium", "7A-spritesheets", "this.actors"],
  ["D89", "medium", "7A-spritesheets", "SPRITE_DISPLAY_SIZE"],
  ["D90", "medium", "5B-key-budget", "81,55"],
  ["D91", "high", "external", "DECISIONS.md"],
  ["D92", "low", "5C-equip-requirements", "heroLevel"],
  ["D93", "low", "5B-key-budget", "keyInBag"],
  ["D94", "low", "7A-spritesheets", "SPRITE_FRAME_SIZE"],
  ["D95", "low", "5B-key-budget", "D01…D09"],
];

const NOTE_LOCATION = /\.(?:ts|tsx|mjs|yaml|json|jsonc|md):\d+/;

function todayDebtGaps(backlog: Backlog): string[] {
  return TODAY_DEBTS.flatMap(([id, severity, target, keyword]) => {
    const debt = debtById(backlog, id);
    if (debt === undefined) return [`${id}:absent`];
    const graded = debt.severity === severity && debt.target === target ? [] : [`${id}:${debt.severity}->${debt.target}`];
    const noted = (debt.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    return [...graded, ...noted];
  });
}

function unlocatedDebts(backlog: Backlog): string[] {
  return TODAY_DEBTS.filter(([id]) => !NOTE_LOCATION.test(debtById(backlog, id)?.notes ?? "")).map(([id]) => id);
}

describe("backlog — dettes du 22/11 versées en v22", () => {
  it("verse D83 à D95 avec sévérité, cible et note factuelle", () => {
    expect(todayDebtGaps(readBacklog())).toEqual([]);
  });

  it("nomme un fichier:ligne dans chaque note", () => {
    expect(unlocatedDebts(readBacklog())).toEqual([]);
  });
});

/**
 * Quatre dettes constatées pendant les audits de la nuit du 22/11 (deux sont
 * soldées : `D96` avec la tâche moteur, `D98` avec le clamp vertical des
 * étiquettes) : elles existaient dans des rapports, donc nulle part dans le
 * dépôt. Chacune nomme un symbole et un `fichier:ligne`, sinon elle n'est pas
 * actionnable.
 */
const WAVE2_DEBTS: Array<[string, string, string, string]> = [
  ["D97", "low", "5C-actor-ring", "DEGENERATE_SIZE"],
  ["D99", "medium", "5C-equip-requirements", "anneau_interdit"],
  ["D100", "low", "5D-exits", "landingFor"],
  ["D101", "medium", "7A-spritesheets", "ensureAnimationLoop"],
];

function wave2DebtGaps(backlog: Backlog): string[] {
  return WAVE2_DEBTS.flatMap(([id, severity, target, keyword]) => {
    const debt = debtById(backlog, id);
    if (debt === undefined) return [`${id}:absent`];
    const graded = debt.severity === severity && debt.target === target ? [] : [`${id}:${debt.severity}->${debt.target}`];
    const noted = (debt.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    return [...graded, ...noted];
  });
}

function wave2Unlocated(backlog: Backlog): string[] {
  return WAVE2_DEBTS.filter(([id]) => !NOTE_LOCATION.test(debtById(backlog, id)?.notes ?? "")).map(([id]) => id);
}

describe("backlog — quatre dettes des audits de la nuit (v24)", () => {
  it("verse D97 et D99 à D101 avec sévérité, cible et note factuelle", () => {
    expect(wave2DebtGaps(readBacklog())).toEqual([]);
  });

  it("nomme un fichier:ligne dans chacune des quatre notes", () => {
    expect(wave2Unlocated(readBacklog())).toEqual([]);
  });

  it("n'entre en collision avec aucun id de tâche", () => {
    const tasks = new Set(allTasks(readBacklog()).map((task) => task.id));
    const ids = WAVE2_DEBTS.map(([id]) => id);
    expect(ids.filter((id) => tasks.has(id))).toEqual([]);
  });

  it("ne cible aucune tâche done", () => {
    const done = doneIds(readBacklog());
    expect(WAVE2_DEBTS.map(([, , target]) => target).filter((target) => done.has(target))).toEqual([]);
  });
});

/**
 * La direction visuelle du HUD est normative au même titre que `DECISIONS.md` :
 * c'est le document que relit chaque agent UI. S'il disparaît, les hex, les px
 * et les ratios de contraste disparaissent avec lui et chacun réinvente sa
 * palette — c'est exactement ce qui a produit l'interface actuelle.
 */
const UI_VISION_PATH = "docs/design/specs/ui-visual-direction.md";

/** Sections obligatoires : sans elles le document n'est plus implémentable. */
const VISION_SECTIONS: Array<[string, string]> = [
  ["palette", "## 1. Palette"],
  ["formes", "## 2. Formes et matière"],
  ["variantes", "## 3. Trois variantes de la carte de combattant"],
  ["interdits", "## 4. Interdits"],
  ["contraintes", "## 5. Contraintes dures"],
  ["exemple", "## 6. Exemple appliqué — carte de combattant, variante A"],
];

/** Le contenu, ou la chaîne vide : l'absence est déjà couverte par le test dédié. */
function visionText(): string {
  const path = join(process.cwd(), UI_VISION_PATH);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function missingVisionSections(): string[] {
  const text = visionText();
  return VISION_SECTIONS.filter(([, heading]) => !text.includes(heading)).map(([id]) => id);
}

/** Chaque paire texte/fond est écrite « X.XX:1 » ou « X,XX:1 » : rien n'est estimé de mémoire. */
function measuredRatios(text: string): number {
  return text.match(/\b\d{1,2}[.,]\d{2}:1\b/g)?.length ?? 0;
}

describe("design — direction visuelle du HUD (v24)", () => {
  it("garde le document de direction visuelle", () => {
    expect(existsSync(join(process.cwd(), UI_VISION_PATH))).toBe(true);
  });

  it("garde les six sections actionnables", () => {
    expect(missingVisionSections()).toEqual([]);
  });

  it("colle au moins vingt ratios de contraste mesurés", () => {
    expect(measuredRatios(visionText())).toBeGreaterThanOrEqual(20);
  });
});

/**
 * Quatre retours de playtest du propriétaire : des barres de vie en exploration
 * qu'il juge inutiles, un survol qui ne distingue pas l'entité visée, des lignes
 * de dégâts qui s'empilent plus vite qu'il ne les lit, et un déplacement diagonal
 * trop long. Le quatrième est un arbitrage, pas une tâche : il devient `DEC-10`
 * et laisse le recalibrage des portées ouvert.
 */
const PLAYTEST_TASKS: Array<[string, string, string]> = [
  ["5C-explore-hp", "high", "src/renderer/**"],
  ["5C-hover-highlight", "high", "ombre elliptique"],
  ["5C-cast-cadence", "high", "constante unique"],
  ["5C-spell-range-rebalance", "medium", "data/spells.yaml"],
];

function playtestTaskGaps(backlog: Backlog): string[] {
  return PLAYTEST_TASKS.flatMap(([id, priority, keyword]) => {
    const task = taskById(backlog, id);
    if (task === undefined) return [`${id}:absent`];
    const graded = task.priority === priority ? [] : [`${id}:${task.priority}`];
    const noted = (task.notes ?? "").includes(keyword) ? [] : [`${id}:notes`];
    return [...graded, ...noted];
  });
}

describe("backlog — retours de playtest : rendu et exploration (v26)", () => {
  it("verse les quatre tâches dans la phase 5C avec leur priorité et leur note", () => {
    const backlog = readBacklog();
    expect(playtestTaskGaps(backlog)).toEqual([]);
    const ids = taskIdsOf(backlog, "5C");
    expect(PLAYTEST_TASKS.map(([id]) => id).filter((id) => !ids.includes(id))).toEqual([]);
  });

  it("masque les barres de vie en exploration sans dépendre de la barre de combat", () => {
    const task = taskById(readBacklog(), "5C-explore-hp");
    expect(task?.status).toBe("done");
    expect(task?.owner).toBe("tdd-coder");
    expect(task?.depends_on ?? []).toEqual([]);
    const text = `${task?.title} ${task?.notes}`;
    expect(text).toContain("5C-hover-hp");
    expect(text).toContain("barres de vie");
  });

  it("distingue l'entité survolée sans toucher à l'ombre elliptique gelée", () => {
    const task = taskById(readBacklog(), "5C-hover-highlight");
    expect(task?.owner).toBe("tdd-coder");
    const text = `${task?.title} ${task?.notes}`;
    expect(text).toContain("render-designer");
    expect(text).toContain("anneau");
    expect(text).toContain("gelée");
  });
});

describe("backlog — retours de playtest : cadence et portées (v26)", () => {
  it("borne la cadence des sorts par une constante unique et injectable", () => {
    const task = taskById(readBacklog(), "5C-cast-cadence");
    expect(task?.status).toBe("done");
    const text = `${task?.title} ${task?.notes}`;
    expect(text).toContain("0,75 s");
    expect(text).toContain("injectable");
    expect(text).toContain("setTimeout");
    expect(text).toContain("src/engine/**");
    expect(text).toContain("animation");
  });

  it("bloque le recalibrage des portées sur l'arbitrage du propriétaire", () => {
    const task = taskById(readBacklog(), "5C-spell-range-rebalance");
    expect(task?.status).toBe("blocked");
    expect(task?.owner).toBe("user");
    expect(task?.target).toBe("external");
    const text = `${task?.title} ${task?.notes}`;
    expect(text).toContain("D71");
    expect(text).toContain("DEC-10");
    expect(text).toContain("mobilité");
  });
});

/** Le corps d'une décision, du titre jusqu'au titre suivant : rien hors section. */
function decisionSection(id: string): string {
  const path = join(process.cwd(), DECISIONS_PATH);
  if (!existsSync(path)) return "";
  return (readFileSync(path, "utf8").split(`## ${id} — `)[1] ?? "").split("\n## ")[0] ?? "";
}

describe("backlog — DEC-10 : la diagonale coûte deux PM (v26)", () => {
  it("norme le coût du pas, l'écart assumé à Dofus 1.29 et la facture réelle", () => {
    const section = decisionSection("DEC-10");
    expect(section).toContain("1 PM par pas");
    expect(section).toContain("2 PM par pas");
    expect(section).toContain("somme");
    expect(section).toContain("chemin réellement trouvé");
    expect(section).toContain("écart assumé à Dofus 1.29");
    expect(section).toContain("chaque case entrée coûte **1 PM**");
  });

  it("interdit de couper un coin et n'asymétrise pas héros et monstres", () => {
    const section = decisionSection("DEC-10");
    expect(section).toContain("deux cases orthogonales adjacentes");
    expect(section).toContain("aucune asymétrie");
  });

  it("laisse le recalibrage des portées ouvert à l'arbitrage du propriétaire", () => {
    const section = decisionSection("DEC-10");
    expect(section).toContain("ouvert");
    expect(section).toContain("propriétaire");
    expect(section).toContain("recalibr");
  });
});

describe("backlog — dettes de déplacement solées par DEC-10 (v26, v30)", () => {
  it("solde D96 : la facture est le chemin réel, plus la distance Chebyshev", () => {
    expect(debtById(readBacklog(), "D96")).toBeUndefined();
    expect(rawBacklog()).not.toContain("Chebyshev");
  });

  it("solde D68 : findPath est 8-voisins et le coin est interdit", () => {
    expect(debtById(readBacklog(), "D68")).toBeUndefined();
    expect(rawBacklog()).not.toContain("4-voisins");
  });

  it("verse la documentation manquante de la règle PM hors périmètre agent", () => {
    const debt = debtById(readBacklog(), "D102");
    expect(debt?.severity).toBe("medium");
    expect(debt?.target).toBe("external");
    expect(debt?.owner).toBe("user");
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("dofus-129-combat");
    expect(text).toContain(".opencode/skills/");
    expect(text).toContain("DEC-10");
  });
});

/**
 * Audit de la PR #108, mis à jour en v31 puis après la calibration du soin
 * (0,75) : aucune borne n'a été élargie. `D103` reste ouverte (la fenêtre 1-2 ne
 * vit que dans la docstring) mais sa mesure est désormais propre — 3,365 tours
 * (salle 3), épinglés ±0,05. `D104` est SOLDÉE : le contact diagonal attaque, et
 * le test qui le prouve est le test inversé de l'audit.
 */
describe("backlog — dette D103 re-mesurée et contact diagonal corrigé (v31)", () => {
  it("verse D103 : la fenêtre 1-2 n'est qu'une docstring, la mesure est propre depuis D104", () => {
    const debt = debtById(readBacklog(), "D103");
    expect({ severity: debt?.severity, target: debt?.target, owner: debt?.owner, status: debt?.status }).toEqual({
      severity: "medium",
      target: "external",
      owner: "user",
      status: "blocked",
    });
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("n'énonce aucune fenêtre 1-2 tours");
    expect(text).toContain("3,365");
    expect(text).toContain("re-mesurée après le correctif `D104`");
    expect(text).toContain("toBeCloseTo(3.365, 1)");
    expect(text).toContain("Aucune borne élargie");
  });

  it("solde D104 : la dette disparaît, le test inversé prouve que le contact diagonal attaque", () => {
    expect(debtById(readBacklog(), "D104")).toBeUndefined();
    const engine = readFileSync(join(process.cwd(), "src/engine/multiCombat/approach.ts"), "utf8");
    expect(engine).toContain("freeContactCells");
    expect(engine).toContain("tighterContact");
    const unit = readFileSync(join(process.cwd(), "tests/unit/multiCombat.spec.ts"), "utf8");
    expect(unit).toContain("contact (D104)");
    expect(unit).toContain("un monstre collé en diagonale obtient la case orthogonale de contact");
    const retaliation = readFileSync(join(process.cwd(), "tests/unit/enemyRetaliation.spec.ts"), "utf8");
    expect(retaliation).toContain("décide d'attaquer depuis la diagonale, sans se décaler d'abord");
    expect(retaliation).toContain("frappe en diagonale sans dépenser un seul PM");
  });
});

/**
 * Les quatre retours de playtest ouverts en v26 ont été livrés par les PR
 * #108 à #111. Les quatre sont **soldés** : `5C-path-8dirs` ne l'était pas en
 * v29 parce que le TC3 de la spec UI annonçait encore « diagonale = 1 pas » ;
 * la PR #113 (squash `65e194a`) a aligné ce TC3 et le tableau §1 sur DEC-10,
 * donc le deuxième verrou est tombé et la tâche se ferme.
 * Le survol d'entité ne couvre pas la salle de donjon : limite assumée, `D105`.
 */
const V29_DONE: Array<[string, number, string]> = [
  ["5C-explore-hp", 109, "2793727"],
  ["5C-hover-highlight", 110, "326988d"],
  ["5C-cast-cadence", 111, "b1bf9a8"],
];

function v29Gaps(backlog: Backlog): string[] {
  return V29_DONE.flatMap(([id, pr, squash]) => {
    const task = taskById(backlog, id);
    const dated = task?.updated_at === "2026-11-23" ? [] : [`${id}:${task?.updated_at}`];
    const ok = task?.status === "done" && task.pr === pr && (task.notes ?? "").includes(squash);
    return ok ? dated : [...dated, `${id}:${task?.status ?? "absent"}`];
  });
}

describe("backlog — v29 : les livraisons de playtest soldées", () => {
  it("clôt 5C-explore-hp, 5C-hover-highlight et 5C-cast-cadence avec PR et squash", () => {
    expect(v29Gaps(readBacklog())).toEqual([]);
  });

  it("clôt 5C-path-8dirs en v30 : les deux squashes cités, le tacle laissé à D70", () => {
    const task = taskById(readBacklog(), "5C-path-8dirs");
    expect({ status: task?.status, pr: task?.pr, updated_at: task?.updated_at }).toEqual({
      status: "done",
      pr: 108,
      updated_at: "2026-11-23",
    });
    const text = `${task?.title} ${task?.notes}`;
    expect(text).toContain("c5b8867");
    expect(text).toContain("65e194a");
    expect(text).toContain("pathCost");
    expect(text).toContain("cutsCorner");
    expect(text).toContain("D70");
  });

  it("verse D105 : le survol d'entité ne couvre pas la salle de donjon", () => {
    const debt = debtById(readBacklog(), "D105");
    expect({ severity: debt?.severity, target: debt?.target, status: debt?.status }).toEqual({
      severity: "low",
      target: "5C-cast-preview",
      status: "todo",
    });
    const text = `${debt?.title} ${debt?.notes}`;
    expect(text).toContain("src/renderer/CombatCanvas.tsx");
    expect(text).toContain("salle de donjon");
    expect(text).toContain("exploration");
    expect(text).toContain("carte");
  });
});

/**
 * La roadmap est un doublon du backlog : elle dérive dès qu'une tâche se ferme
 * sans qu'on y touche. Le garde-fou est borné pour rester honnête — la roadmap
 * est plus grossière que le backlog (des tâches `done` des vagues 3.5, 4A et 5A
 * n'y ont jamais eu de ligne), donc on n'exige pas une ligne pour chaque tâche :
 * on exige qu'une ligne **existante** ne contredise jamais le backlog, et on
 * épingle les quatre livraisons de playtest pour que leur ligne ne disparaisse pas.
 */
const ROADMAP_ENTRY = /^- \[( |x)\] (\S+)/;

function roadmapChecks(): Map<string, boolean> {
  const checks = new Map<string, boolean>();
  uncheckedRoadmapLines().forEach((line) => {
    const match = ROADMAP_ENTRY.exec(line);
    if (match?.[2] !== undefined) checks.set(match[2], match[1] === "x");
  });
  return checks;
}

function roadmapMismatches(backlog: Backlog): string[] {
  const checks = roadmapChecks();
  return allTasks(backlog).flatMap((task) => {
    const checked = checks.get(task.id);
    if (checked === undefined) return [];
    return checked === (task.status === "done") ? [] : [`${task.id}:${task.status}/${checked ? "x" : " "}`];
  });
}

const ROADMAP_PINNED = ["5C-explore-hp", "5C-hover-highlight", "5C-cast-cadence", "5C-path-8dirs"];

function roadmapPinnedGaps(): string[] {
  const checks = roadmapChecks();
  return ROADMAP_PINNED.filter((id) => checks.get(id) !== true);
}

describe("backlog — la roadmap ne contredit plus le backlog (v30)", () => {
  it("coche toute tâche done qui a une ligne et laisse décochée une tâche ouverte", () => {
    expect(roadmapMismatches(readBacklog())).toEqual([]);
  });

  it("porte une ligne cochée pour les quatre livraisons de playtest", () => {
    expect(roadmapPinnedGaps()).toEqual([]);
  });

  it("aligne les restes annoncés par la phase 5C sur OPEN_5C, sans pathfinding", () => {
    const notes = phaseById(readBacklog(), "5C")?.notes ?? "";
    expect(OPEN_5C.filter((id) => !notes.includes(id))).toEqual([]);
    expect(notes).not.toContain("le pathfinding 8 directions");
  });
});
