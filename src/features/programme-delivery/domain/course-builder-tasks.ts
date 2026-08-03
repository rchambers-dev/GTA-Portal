/**
 * Course Builder → apprentice-completable practical tasks.
 * KSBs left blank for Jon. Source PDFs optional (portal-first).
 */

import type {
  PracticalTaskDef,
  PracticalTaskKind,
  TaskFieldDef,
} from "./task-schema";
import {
  assessmentRecordFields,
  difficultySection,
  signOffSection,
} from "./tasks/shared";

export type CourseBuilderTaskDraft = {
  id: string;
  packId: string;
  blockId: number;
  /** 1–5 within the block (Autocare pattern); extra tasks use 3+ as practical. */
  taskNumber: number;
  kind: PracticalTaskKind;
  title: string;
  scenario: string;
  objectives: string[];
  instructions: string[];
  estimatedMinutes: number;
  /** Free-text prompts the apprentice must answer. */
  knowledgeQuestions: string[];
};

export type CourseBuilderTaskInput = {
  packId: string;
  blockId: number;
  title: string;
  scenario?: string;
  kind?: PracticalTaskKind;
  objectives?: string[];
  instructions?: string[];
  estimatedMinutes?: number;
  knowledgeQuestions?: string[];
  taskNumber?: number;
};

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function newCourseBuilderTaskId(
  packId: string,
  blockId: number,
  title: string,
): string {
  const base = slug(title) || "task";
  return `cb-${packId}-b${blockId}-${base}-${Date.now().toString(36)}`;
}

/** Build a fillable PracticalTaskDef from Course Builder draft fields. */
export function draftToPracticalTask(
  draft: CourseBuilderTaskDraft,
): PracticalTaskDef {
  const taskNumber = Math.min(5, Math.max(1, draft.taskNumber)) as
    | 1
    | 2
    | 3
    | 4
    | 5;

  const knowledgeFields: TaskFieldDef[] = draft.knowledgeQuestions
    .map((q) => q.trim())
    .filter(Boolean)
    .map((label, i) => ({
      key: `kq${i + 1}`,
      type: "knowledge_question" as const,
      label: `${i + 1}. ${label}`,
      required: true,
    }));

  const workNotes: TaskFieldDef = {
    key: "workNotes",
    type: "textarea",
    label: "What did you do? Record your work and findings",
    required: true,
  };

  return {
    id: draft.id,
    evidenceRef: draft.id,
    blockId: draft.blockId,
    taskNumber,
    kind: draft.kind,
    title: draft.title.trim() || `Block ${draft.blockId} task`,
    scenario:
      draft.scenario.trim() ||
      "Complete this college task as directed by your tutor.",
    objectives: draft.objectives.map((o) => o.trim()).filter(Boolean),
    estimatedMinutes: draft.estimatedMinutes || 60,
    sourcePdf: "",
    weeks: undefined,
    dutiesCovered: undefined,
    /** Intentionally empty — Jon maps KSBs later. */
    ksbsCovered: "",
    assessmentType: "Portal task",
    materials: [],
    instructions: draft.instructions.map((i) => i.trim()).filter(Boolean),
    reviewStatus: "draft",
    sections: [
      {
        id: "brief",
        title: "Task brief",
        fields: [
          {
            key: "readBrief",
            type: "checkbox_group",
            label: "I have read the task brief",
            options: ["I understand what I need to do"],
            required: true,
          },
        ],
      },
      {
        id: "record",
        title: "Apprentice Assessment Record",
        fields: assessmentRecordFields,
      },
      {
        id: "work",
        title: "Your work",
        fields: [workNotes],
      },
      ...(knowledgeFields.length
        ? [
            {
              id: "knowledge",
              title: "Knowledge questions",
              fields: knowledgeFields,
            },
          ]
        : []),
      signOffSection,
      difficultySection,
    ],
  };
}

export function createTaskDraft(
  input: CourseBuilderTaskInput,
  existingInBlock: CourseBuilderTaskDraft[],
): CourseBuilderTaskDraft {
  const nextNumber =
    input.taskNumber ??
    existingInBlock.reduce((max, t) => Math.max(max, t.taskNumber), 0) + 1;
  const title = input.title.trim() || `Task ${nextNumber}`;
  return {
    id: newCourseBuilderTaskId(input.packId, input.blockId, title),
    packId: input.packId,
    blockId: input.blockId,
    taskNumber: nextNumber,
    kind: input.kind ?? "practical",
    title,
    scenario: input.scenario?.trim() ?? "",
    objectives: input.objectives ?? [],
    instructions: input.instructions ?? [],
    estimatedMinutes: input.estimatedMinutes ?? 60,
    knowledgeQuestions: input.knowledgeQuestions ?? [],
  };
}
