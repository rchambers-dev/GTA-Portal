/**
 * GTA Course Builder tasks — DB domain model (gta_course_tasks).
 * Separate from CEA course_pack_task_forms.
 */

import type { AuthoredTaskForm } from "./form-modules";
import type { CourseBuilderTaskDraft } from "./course-builder-tasks";
import type { PracticalTaskKind } from "./task-schema";

export type GtaCourseTaskPublishStatus = "draft" | "published";
export type GtaCourseTaskFormStatus = "pending" | "ready";

export type GtaCourseTaskRecord = {
  id: string;
  programmeVersionId: string;
  spineItemId: string;
  /** Version-scoped public key (= client draft.id). Not cross-version. */
  taskKey: string;
  sequence: number;
  taskNumber: number;
  kind: PracticalTaskKind;
  title: string;
  scenario: string;
  objectives: string[];
  instructions: string[];
  knowledgeQuestions: string[];
  estimatedMinutes: number;
  blockOrdinal: number;
  form: AuthoredTaskForm;
  publishStatus: GtaCourseTaskPublishStatus;
  copiedFromTaskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GtaCourseTaskUpsertInput = {
  taskKey: string;
  spineItemId: string;
  sequence?: number;
  taskNumber: number;
  kind: PracticalTaskKind;
  title: string;
  scenario: string;
  objectives: string[];
  instructions: string[];
  knowledgeQuestions: string[];
  estimatedMinutes: number;
  blockOrdinal: number;
  form: AuthoredTaskForm;
  publishStatus?: GtaCourseTaskPublishStatus;
};

const KINDS = new Set<PracticalTaskKind>([
  "practical",
  "reflection",
  "knowledge_test",
  "job_card",
]);

export function recordToTaskDraft(
  row: GtaCourseTaskRecord,
): CourseBuilderTaskDraft {
  return {
    id: row.taskKey,
    programmeVersionId: row.programmeVersionId,
    spineBlockId: row.spineItemId,
    blockOrdinal: row.blockOrdinal,
    taskNumber: row.taskNumber,
    kind: row.kind,
    title: row.title,
    scenario: row.scenario,
    objectives: row.objectives,
    instructions: row.instructions,
    estimatedMinutes: row.estimatedMinutes,
    knowledgeQuestions: row.knowledgeQuestions,
  };
}

export function draftAndFormToUpsert(
  draft: CourseBuilderTaskDraft,
  form: AuthoredTaskForm,
  publishStatus?: GtaCourseTaskPublishStatus,
): GtaCourseTaskUpsertInput {
  const resolvedPublish: GtaCourseTaskPublishStatus =
    publishStatus ??
    (form.status === "ready" ? "published" : "draft");
  return {
    taskKey: draft.id,
    spineItemId: draft.spineBlockId,
    sequence: draft.taskNumber,
    taskNumber: draft.taskNumber,
    kind: draft.kind,
    title: draft.title,
    scenario: draft.scenario,
    objectives: draft.objectives,
    instructions: draft.instructions,
    knowledgeQuestions: draft.knowledgeQuestions,
    estimatedMinutes: draft.estimatedMinutes,
    blockOrdinal: draft.blockOrdinal,
    form,
    publishStatus: resolvedPublish,
  };
}

export function assertValidUpsertInput(
  input: GtaCourseTaskUpsertInput,
): void {
  if (!input.taskKey?.trim()) {
    throw new Error("taskKey is required.");
  }
  if (!input.spineItemId?.trim()) {
    throw new Error("spineItemId is required.");
  }
  if (!KINDS.has(input.kind)) {
    throw new Error(`Invalid task kind: ${input.kind}`);
  }
  if (!Number.isFinite(input.taskNumber) || input.taskNumber < 1) {
    throw new Error("taskNumber must be a positive integer.");
  }
}

/** New version-scoped task_key on fork (NOT a cross-version identity). */
export function newForkedTaskKey(sourceTaskKey: string): string {
  const base = sourceTaskKey.replace(/^cb-/, "").slice(0, 48) || "task";
  return `cb-fork-${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
