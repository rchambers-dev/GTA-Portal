/**
 * Client store for practical task submissions.
 * Preferred: portal form. Fallback: PDF upload(s) for that college day.
 * One active submission method per task attempt — no competing filled versions.
 */

import type { PracticalTaskDef } from "./task-schema";

export type SubmissionMethod = "portal_form" | "pdf_upload";

export type TaskSubmissionStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_mentor"
  | "awaiting_trainer"
  | "returned"
  | "verified"
  | "referred";

export type TaskSubmission = {
  taskId: string;
  apprenticeId: string;
  method: SubmissionMethod | null;
  status: TaskSubmissionStatus;
  /** Portal form answers keyed by field key. */
  fields: Record<string, string>;
  /** Fallback PDF filenames (metadata only in demo — no binary store). */
  uploadedPdfNames: string[];
  difficulty: string | null;
  difficultyComment: string;
  apprenticeSignedAt: string | null;
  mentorSignedAt: string | null;
  mentorSignedBy: string | null;
  trainerSignedAt: string | null;
  trainerSignedBy: string | null;
  trainerDecision: string | null;
  returnNote: string | null;
  updatedAt: string;
};

type Snapshot = {
  version: 2;
  byApprentice: Record<string, Record<string, TaskSubmission>>;
};

const STORAGE_KEY = "gta-portal.programme-tasks.v3";
/** Prefer passing a real apprentice id; empty means no default demo target. */
const FALLBACK_APPRENTICE_ID = "";
const EMPTY_SNAPSHOT: Snapshot = { version: 2, byApprentice: {} };
let snapshot: Snapshot = EMPTY_SNAPSHOT;
let hydrated = false;
let hydrateScheduled = false;
const listeners = new Set<() => void>();

function persist(next: Snapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode — keep working in-memory.
  }
}

function loadSnapshot(): Snapshot {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SNAPSHOT;
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed?.version !== 2 || !parsed.byApprentice) {
      return EMPTY_SNAPSHOT;
    }
    // Drop residual demo Alex task packs from older localStorage.
    const cleaned = { ...parsed.byApprentice };
    delete cleaned["alex-morgan"];
    delete cleaned["lrn-alex-morgan"];
    return { ...parsed, byApprentice: cleaned };
  } catch {
    // ignore
  }
  return EMPTY_SNAPSHOT;
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  snapshot = loadSnapshot();
  hydrated = true;
  persist(snapshot);
}

/**
 * Load localStorage after first paint so SSR HTML matches the initial client render.
 * Mutations still call ensureHydrated() synchronously.
 */
function scheduleHydrateFromStorage() {
  if (hydrated || hydrateScheduled || typeof window === "undefined") return;
  hydrateScheduled = true;
  queueMicrotask(() => {
    if (hydrated) return;
    snapshot = loadSnapshot();
    hydrated = true;
    persist(snapshot);
    for (const listener of listeners) listener();
  });
}

function emit() {
  persist(snapshot);
  for (const listener of listeners) listener();
}

function emptySubmission(taskId: string, apprenticeId: string): TaskSubmission {
  return {
    taskId,
    apprenticeId,
    method: null,
    status: "not_started",
    fields: {},
    uploadedPdfNames: [],
    difficulty: null,
    difficultyComment: "",
    apprenticeSignedAt: null,
    mentorSignedAt: null,
    mentorSignedBy: null,
    trainerSignedAt: null,
    trainerSignedBy: null,
    trainerDecision: null,
    returnNote: null,
    updatedAt: "",
  };
}

export function subscribeTaskStore(listener: () => void): () => void {
  listeners.add(listener);
  scheduleHydrateFromStorage();
  return () => listeners.delete(listener);
}

export function getTaskSnapshot(): Snapshot {
  return snapshot;
}

/** Server / hydration snapshot — never reads localStorage. */
export function getTaskServerSnapshot(): Snapshot {
  return EMPTY_SNAPSHOT;
}

export function getTaskSubmission(
  taskId: string,
  apprenticeId: string = FALLBACK_APPRENTICE_ID,
): TaskSubmission {
  return (
    snapshot.byApprentice[apprenticeId]?.[taskId] ??
    emptySubmission(taskId, apprenticeId)
  );
}

export function upsertTaskSubmission(
  taskId: string,
  patch: Partial<TaskSubmission>,
  apprenticeId: string = FALLBACK_APPRENTICE_ID,
): TaskSubmission {
  ensureHydrated();
  const existing =
    snapshot.byApprentice[apprenticeId]?.[taskId] ??
    emptySubmission(taskId, apprenticeId);
  const next: TaskSubmission = {
    ...existing,
    ...patch,
    fields: { ...existing.fields, ...(patch.fields ?? {}) },
    uploadedPdfNames: patch.uploadedPdfNames ?? existing.uploadedPdfNames,
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    byApprentice: {
      ...snapshot.byApprentice,
      [apprenticeId]: {
        ...(snapshot.byApprentice[apprenticeId] ?? {}),
        [taskId]: next,
      },
    },
  };
  emit();
  return next;
}

export function statusLabel(status: TaskSubmissionStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "awaiting_mentor":
      return "Awaiting mentor";
    case "awaiting_trainer":
      return "Awaiting trainer";
    case "returned":
      return "Returned";
    case "verified":
      return "Verified";
    case "referred":
      return "Referred";
  }
}

export function statusTone(
  status: TaskSubmissionStatus,
): "neutral" | "amber" | "green" | "red" | "blue" {
  switch (status) {
    case "verified":
      return "green";
    case "awaiting_mentor":
    case "awaiting_trainer":
    case "in_progress":
      return "amber";
    case "not_started":
      return "neutral";
    case "returned":
    case "referred":
      return "red";
    default:
      return "red";
  }
}

/** Reflection gate: next block unlocked only after trainer verifies Task 5.
 * Fails closed — if the block has no reflection task yet, it stays locked.
 */
export function isBlockReflectionVerified(
  blockId: number,
  tasks: PracticalTaskDef[],
  apprenticeId: string = FALLBACK_APPRENTICE_ID,
): boolean {
  const reflection = tasks.find(
    (t) => t.blockId === blockId && t.kind === "reflection",
  );
  if (!reflection) return false;
  return getTaskSubmission(reflection.id, apprenticeId).status === "verified";
}

export function listAwaitingTrainer(
  tasks: PracticalTaskDef[],
  apprenticeId: string = FALLBACK_APPRENTICE_ID,
): PracticalTaskDef[] {
  return tasks.filter((t) => {
    const s = getTaskSubmission(t.id, apprenticeId).status;
    return s === "awaiting_trainer" || s === "awaiting_mentor";
  });
}

/** Map admin enrolment apprenticeId → task store key. */
export function resolveTaskStoreApprenticeId(
  adminApprenticeId: string | null | undefined,
): string {
  return adminApprenticeId?.trim() || FALLBACK_APPRENTICE_ID;
}

export type ForceCompleteOptions = {
  /** ISO date (YYYY-MM-DD) used as trainer sign-off / BRAG completedAt. */
  completedAtIso?: string;
  actorName?: string;
  note?: string;
};

function forceCompleteStamp(completedAtIso?: string): string {
  if (completedAtIso && /^\d{4}-\d{2}-\d{2}$/.test(completedAtIso)) {
    return `${completedAtIso}T12:00:00.000Z`;
  }
  return new Date().toISOString();
}

/**
 * Management system action: mark a task verified without the apprentice/tutor flow.
 * Used to backfill progress for live / backdated intakes.
 */
export function forceVerifyTask(
  taskId: string,
  apprenticeId: string,
  options: ForceCompleteOptions = {},
): TaskSubmission {
  const stamp = forceCompleteStamp(options.completedAtIso);
  const actor = options.actorName?.trim() || "Management (system backfill)";
  const note =
    options.note?.trim() ||
    "Force-completed via management system action (historical backfill).";

  return upsertTaskSubmission(
    taskId,
    {
      method: "portal_form",
      status: "verified",
      apprenticeSignedAt: stamp,
      mentorSignedAt: stamp,
      mentorSignedBy: actor,
      trainerSignedAt: stamp,
      trainerSignedBy: actor,
      trainerDecision: "verified",
      returnNote: note,
      difficulty: "ok",
    },
    apprenticeId,
  );
}

/** Mark every task in a block verified. Returns how many tasks were updated. */
export function forceVerifyBlock(
  blockTasks: PracticalTaskDef[],
  apprenticeId: string,
  options: ForceCompleteOptions = {},
): number {
  let count = 0;
  for (const task of blockTasks) {
    forceVerifyTask(task.id, apprenticeId, options);
    count += 1;
  }
  return count;
}

export { FALLBACK_APPRENTICE_ID };
/** @deprecated Use explicit apprentice ids — no demo target. */
export const DEMO_APPRENTICE_ID = FALLBACK_APPRENTICE_ID;
