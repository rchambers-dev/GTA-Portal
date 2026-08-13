/**
 * Course Builder — authored tasks + forms keyed by GTA programme version.
 * DB (gta_course_tasks) is source of truth; localStorage is cache only.
 * Controlled programme tasks only (gta_course_tasks).
 */

import type { AuthoredTaskForm } from "@/features/programme-delivery/domain/form-modules";
import { defaultAuthoredTaskForm } from "@/features/programme-delivery/domain/form-modules";
import type { PracticalTaskDef } from "@/features/programme-delivery/domain/task-schema";
import {
  createTaskDraft,
  draftToPracticalTask,
  type CourseBuilderTaskDraft,
  type CourseBuilderTaskInput,
} from "@/features/programme-delivery/domain/course-builder-tasks";
import {
  draftAndFormToUpsert,
  recordToTaskDraft,
  type GtaCourseTaskRecord,
} from "@/features/programme-delivery/domain/gta-course-tasks";

const STORAGE_KEY = "gta.courseBuilder.v5";
const LEGACY_COURSE_BUILDER_KEYS = [
  "gta.courseBuilder.v4",
  "gta.courseBuilder.v3",
  "gta.courseBuilder.v2",
  "gta.courseBuilder.v1",
];

const TASKS_API = "/api/management/course-builder/tasks";

export type ProgrammeCourseOverride = {
  /** Apprentice-completable tasks authored against spine blocks. */
  tasks?: CourseBuilderTaskDraft[];
};

export type CourseBuilderState = {
  /** Keyed by GtaProgrammeVersion.id */
  programmes: Record<string, ProgrammeCourseOverride>;
  /**
   * Form builders keyed by `${ownerId}::${taskId}`.
   * ownerId is programmeVersionId for Course Builder, or CEA packId for legacy groups.
   */
  taskForms: Record<string, AuthoredTaskForm>;
};

type Listener = () => void;

const listeners = new Set<Listener>();

const SERVER_SNAPSHOT: CourseBuilderState = Object.freeze({
  programmes: {},
  taskForms: {},
});

function emptyState(): CourseBuilderState {
  return { programmes: {}, taskForms: {} };
}

function readState(): CourseBuilderState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<CourseBuilderState>;
    return {
      programmes: parsed.programmes ?? {},
      taskForms: parsed.taskForms ?? {},
    };
  } catch {
    return emptyState();
  }
}

let cache: CourseBuilderState | null = null;

function state(): CourseBuilderState {
  if (!cache) cache = readState();
  return cache;
}

function writeState(next: CourseBuilderState) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  listeners.forEach((l) => l());
}

export function subscribeCourseBuilder(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCourseBuilderSnapshot(): CourseBuilderState {
  return state();
}

export function getCourseBuilderServerSnapshot(): CourseBuilderState {
  return SERVER_SNAPSHOT;
}

export function listBlockTaskDrafts(
  programmeVersionId: string,
  snap: CourseBuilderState = state(),
): CourseBuilderTaskDraft[] {
  return snap.programmes[programmeVersionId]?.tasks ?? [];
}

export function listBlockTaskDraftsForBlock(
  programmeVersionId: string,
  spineBlockId: string,
  snap: CourseBuilderState = state(),
): CourseBuilderTaskDraft[] {
  return listBlockTaskDrafts(programmeVersionId, snap)
    .filter((t) => t.spineBlockId === spineBlockId)
    .sort((a, b) => a.taskNumber - b.taskNumber);
}

export function listAllCourseBuilderPracticalTasks(): PracticalTaskDef[] {
  return Object.values(state().programmes).flatMap((prog) =>
    (prog.tasks ?? []).map((draft) => draftToPracticalTask(draft)),
  );
}

export function listAllCourseBuilderTaskDrafts(
  snap: CourseBuilderState = state(),
): CourseBuilderTaskDraft[] {
  return Object.values(snap.programmes).flatMap((prog) => prog.tasks ?? []);
}

export function getCourseBuilderPracticalTask(
  taskId: string,
): PracticalTaskDef | null {
  for (const prog of Object.values(state().programmes)) {
    const draft = (prog.tasks ?? []).find((t) => t.id === taskId);
    if (draft) return draftToPracticalTask(draft);
  }
  return null;
}

export function getCourseBuilderTaskDraft(
  taskId: string,
  snap: CourseBuilderState = state(),
): CourseBuilderTaskDraft | null {
  for (const prog of Object.values(snap.programmes)) {
    const draft = (prog.tasks ?? []).find((t) => t.id === taskId);
    if (draft) return draft;
  }
  return null;
}

export function taskFormKey(ownerId: string, taskId: string): string {
  return `${ownerId}::${taskId}`;
}

/**
 * Apply DB tasks as source of truth for one programme version.
 * Replaces that version's task list and GTA form entries in cache.
 * CEA pack form keys (non-UUID owners) are left untouched.
 */
export function applyCourseTasksFromDb(
  programmeVersionId: string,
  records: GtaCourseTaskRecord[],
): void {
  const prev = state();
  const drafts = records.map(recordToTaskDraft);
  const nextForms = { ...prev.taskForms };

  for (const key of Object.keys(nextForms)) {
    if (key.startsWith(`${programmeVersionId}::`)) {
      delete nextForms[key];
    }
  }
  for (const row of records) {
    nextForms[taskFormKey(programmeVersionId, row.taskKey)] = row.form;
  }

  writeState({
    ...prev,
    programmes: {
      ...prev.programmes,
      [programmeVersionId]: { tasks: drafts },
    },
    taskForms: nextForms,
  });
}

const hydrateInFlight = new Map<string, Promise<void>>();

/** Hydrate Course Builder cache from DB for an explicit programme version. */
export async function loadSharedCourseTasks(
  programmeVersionId: string,
): Promise<void> {
  const versionId = programmeVersionId.trim();
  if (!versionId) {
    throw new Error("programmeVersionId is required.");
  }
  if (typeof window === "undefined") return;

  const existing = hydrateInFlight.get(versionId);
  if (existing) return existing;

  const pending = (async () => {
    const qs = new URLSearchParams({ programmeVersionId: versionId });
    const res = await fetch(`${TASKS_API}?${qs.toString()}`);
    const data = (await res.json()) as {
      ok: boolean;
      tasks?: GtaCourseTaskRecord[];
      error?: string;
    };
    if (!data.ok) {
      throw new Error(data.error || "Could not load Course Builder tasks.");
    }
    applyCourseTasksFromDb(versionId, data.tasks ?? []);
  })().finally(() => {
    hydrateInFlight.delete(versionId);
  });

  hydrateInFlight.set(versionId, pending);
  return pending;
}

async function persistUpsertTasks(
  programmeVersionId: string,
  drafts: CourseBuilderTaskDraft[],
): Promise<void> {
  if (typeof window === "undefined" || drafts.length === 0) return;
  const snap = state();
  const payload = drafts.map((draft) =>
    draftAndFormToUpsert(
      draft,
      getAuthoredTaskForm(programmeVersionId, draft.id, draft.title, snap),
    ),
  );
  const res = await fetch(TASKS_API, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ programmeVersionId, tasks: payload }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    tasks?: GtaCourseTaskRecord[];
  };
  if (!res.ok || !data.ok) {
    console.error(
      "[course-builder] upsert failed:",
      data.error || res.statusText,
    );
    return;
  }
  if (data.tasks) {
    applyCourseTasksFromDb(programmeVersionId, data.tasks);
  }
}

async function persistDeleteTask(
  programmeVersionId: string,
  taskKey: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  const qs = new URLSearchParams({ programmeVersionId, taskKey });
  const res = await fetch(`${TASKS_API}?${qs.toString()}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    console.error(
      "[course-builder] delete failed:",
      data.error || res.statusText,
    );
  }
}

export function addBlockTask(
  input: CourseBuilderTaskInput,
): CourseBuilderTaskDraft | null {
  if (!input.title.trim()) return null;
  const prev = state();
  const existing = prev.programmes[input.programmeVersionId] ?? {};
  const tasks = [...(existing.tasks ?? [])];
  const inBlock = tasks.filter((t) => t.spineBlockId === input.spineBlockId);
  const draft = createTaskDraft(input, inBlock);
  tasks.push(draft);
  const form = defaultAuthoredTaskForm(draft.title);
  writeState({
    ...prev,
    programmes: {
      ...prev.programmes,
      [input.programmeVersionId]: { ...existing, tasks },
    },
    taskForms: {
      ...prev.taskForms,
      [taskFormKey(input.programmeVersionId, draft.id)]: form,
    },
  });
  void persistUpsertTasks(input.programmeVersionId, [draft]);
  return draft;
}

export function updateBlockTask(
  programmeVersionId: string,
  taskId: string,
  patch: Partial<
    Pick<
      CourseBuilderTaskDraft,
      | "title"
      | "scenario"
      | "kind"
      | "objectives"
      | "instructions"
      | "estimatedMinutes"
      | "knowledgeQuestions"
      | "taskNumber"
    >
  >,
): void {
  const prev = state();
  const existing = prev.programmes[programmeVersionId] ?? {};
  const tasks = [...(existing.tasks ?? [])];
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return;
  tasks[idx] = { ...tasks[idx], ...patch };
  writeState({
    ...prev,
    programmes: {
      ...prev.programmes,
      [programmeVersionId]: { ...existing, tasks },
    },
  });
  void persistUpsertTasks(programmeVersionId, [tasks[idx]!]);
}

export function removeBlockTask(
  programmeVersionId: string,
  taskId: string,
): void {
  const prev = state();
  const existing = prev.programmes[programmeVersionId] ?? {};
  const tasks = (existing.tasks ?? []).filter((t) => t.id !== taskId);
  const formKey = taskFormKey(programmeVersionId, taskId);
  const { [formKey]: _removed, ...taskForms } = prev.taskForms;
  writeState({
    ...prev,
    programmes: {
      ...prev.programmes,
      [programmeVersionId]: { ...existing, tasks },
    },
    taskForms,
  });
  void persistDeleteTask(programmeVersionId, taskId);
}

export function getAuthoredTaskForm(
  ownerId: string,
  taskId: string,
  fallbackTitle = "Task",
  snap: CourseBuilderState = state(),
): AuthoredTaskForm {
  const key = taskFormKey(ownerId, taskId);
  const stored = snap.taskForms[key];
  if (!stored) {
    return defaultAuthoredTaskForm(fallbackTitle);
  }
  return {
    ...stored,
    status: stored.status === "ready" ? "ready" : "pending",
  };
}

export function ensureAuthoredTaskForm(
  ownerId: string,
  taskId: string,
  title: string,
): AuthoredTaskForm {
  const key = taskFormKey(ownerId, taskId);
  const stored = state().taskForms[key];
  if (!stored) {
    const form = defaultAuthoredTaskForm(title);
    saveAuthoredTaskForm(ownerId, taskId, form);
    return form;
  }
  return getAuthoredTaskForm(ownerId, taskId, title);
}

/**
 * Clears local Course Builder cache only (browser localStorage).
 * Does not modify remote database / Supabase rows.
 */
export function clearCourseBuilderLocalCache(): void {
  cache = emptyState();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    for (const key of LEGACY_COURSE_BUILDER_KEYS) {
      window.localStorage.removeItem(key);
    }
  }
  listeners.forEach((l) => l());
}

export function saveAuthoredTaskForm(
  ownerId: string,
  taskId: string,
  form: AuthoredTaskForm,
): void {
  const prev = state();
  const key = taskFormKey(ownerId, taskId);
  writeState({
    ...prev,
    taskForms: {
      ...prev.taskForms,
      [key]: form,
    },
  });

  const draft = listBlockTaskDrafts(ownerId, state()).find(
    (t) => t.id === taskId,
  );
  if (draft) {
    void persistUpsertTasks(ownerId, [draft]);
  }
}

export function hasAuthoredTaskForm(
  ownerId: string,
  taskId: string,
  snap: CourseBuilderState = state(),
): boolean {
  return snap.taskForms[taskFormKey(ownerId, taskId)] != null;
}

export function isAuthoredTaskFormReady(
  ownerId: string,
  taskId: string,
  snap: CourseBuilderState = state(),
): boolean {
  const stored = snap.taskForms[taskFormKey(ownerId, taskId)];
  if (stored) return stored.status === "ready";
  return false;
}

export function authoredTaskFormBadge(
  ownerId: string,
  taskId: string,
  snap: CourseBuilderState = state(),
): { label: "Form ready" | "Pending"; tone: "green" | "amber" } {
  if (isAuthoredTaskFormReady(ownerId, taskId, snap)) {
    return { label: "Form ready", tone: "green" };
  }
  return { label: "Pending", tone: "amber" };
}
