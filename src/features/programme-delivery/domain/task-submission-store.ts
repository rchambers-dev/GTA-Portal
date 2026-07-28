/**
 * Client store for practical task submissions.
 * Preferred: portal form. Fallback: PDF upload(s) for that college day.
 * One active submission method per task attempt — no competing filled versions.
 */

import type { PracticalTaskDef } from "./task-schema";
import { buildAlexHalfwayTaskSeed } from "./alex-halfway-task-seed";

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
  learnerId: string;
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
  /** Bump to re-apply Alex mid-course demo task pack. */
  demoSeed?: string;
  byLearner: Record<string, Record<string, TaskSubmission>>;
};

const STORAGE_KEY = "gta-portal.programme-tasks.v2";
const DEMO_LEARNER_ID = "alex-morgan";
const ALEX_DEMO_SEED = "alex-halfway-v2";

const EMPTY_SNAPSHOT: Snapshot = { version: 2, byLearner: {} };
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
    if (!raw) return withAlexDemoSeed(EMPTY_SNAPSHOT);
    const parsed = JSON.parse(raw) as Snapshot;
    if (parsed?.version !== 2 || !parsed.byLearner) {
      return withAlexDemoSeed(EMPTY_SNAPSHOT);
    }
    return withAlexDemoSeed(parsed);
  } catch {
    // ignore
  }
  return withAlexDemoSeed(EMPTY_SNAPSHOT);
}

/** Apply / refresh Alex mid-course demo progress when seed tag is missing. */
function withAlexDemoSeed(base: Snapshot): Snapshot {
  if (base.demoSeed === ALEX_DEMO_SEED) return base;
  return {
    version: 2,
    demoSeed: ALEX_DEMO_SEED,
    byLearner: {
      ...base.byLearner,
      [DEMO_LEARNER_ID]: buildAlexHalfwayTaskSeed(),
    },
  };
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

function emptySubmission(taskId: string, learnerId: string): TaskSubmission {
  return {
    taskId,
    learnerId,
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
  learnerId: string = DEMO_LEARNER_ID,
): TaskSubmission {
  return (
    snapshot.byLearner[learnerId]?.[taskId] ??
    emptySubmission(taskId, learnerId)
  );
}

export function upsertTaskSubmission(
  taskId: string,
  patch: Partial<TaskSubmission>,
  learnerId: string = DEMO_LEARNER_ID,
): TaskSubmission {
  ensureHydrated();
  const existing =
    snapshot.byLearner[learnerId]?.[taskId] ??
    emptySubmission(taskId, learnerId);
  const next: TaskSubmission = {
    ...existing,
    ...patch,
    fields: { ...existing.fields, ...(patch.fields ?? {}) },
    uploadedPdfNames: patch.uploadedPdfNames ?? existing.uploadedPdfNames,
    updatedAt: new Date().toISOString(),
  };
  snapshot = {
    ...snapshot,
    byLearner: {
      ...snapshot.byLearner,
      [learnerId]: {
        ...(snapshot.byLearner[learnerId] ?? {}),
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
  learnerId: string = DEMO_LEARNER_ID,
): boolean {
  const reflection = tasks.find(
    (t) => t.blockId === blockId && t.kind === "reflection",
  );
  if (!reflection) return false;
  return getTaskSubmission(reflection.id, learnerId).status === "verified";
}

export function listAwaitingTrainer(
  tasks: PracticalTaskDef[],
  learnerId: string = DEMO_LEARNER_ID,
): PracticalTaskDef[] {
  return tasks.filter((t) => {
    const s = getTaskSubmission(t.id, learnerId).status;
    return s === "awaiting_trainer" || s === "awaiting_mentor";
  });
}

export { DEMO_LEARNER_ID };
