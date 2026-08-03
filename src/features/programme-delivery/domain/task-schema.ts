/**
 * Block-builder field model for college practical tasks.
 * Curriculum can later edit these as data (Wunderwaffe) — not hard-coded JSX per PDF.
 */

export type TaskBlockType =
  | "heading"
  | "description"
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox_group"
  | "radio_group"
  | "rating_rows"
  | "action_rows"
  | "parts_rows"
  | "knowledge_question"
  | "sign_off"
  | "difficulty_feedback";

export type TaskFieldDef = {
  key: string;
  type: TaskBlockType;
  label: string;
  hint?: string;
  required?: boolean;
  /** For checkbox_group / radio_group / difficulty_feedback */
  options?: string[];
  /** For rating_rows / action_rows / parts_rows — how many blank rows to show */
  rowCount?: number;
  /** For sign_off — who must complete this box */
  signOffRole?: "apprentice" | "mentor" | "trainer" | "assessor";
  /** Who fills this field (defaults to apprentice). Staff-only on apprentice form. */
  filledBy?: "apprentice" | "mentor" | "trainer" | "assessor";
};

export type TaskSectionDef = {
  id: string;
  title: string;
  fields: TaskFieldDef[];
};

export type PracticalTaskKind =
  | "practical"
  | "reflection"
  | "knowledge_test"
  | "job_card";

const TASK_KIND_LABELS: Record<PracticalTaskKind, string> = {
  practical: "Practical",
  reflection: "Block reflection",
  knowledge_test: "Knowledge test",
  job_card: "Workplace job card",
};

export function taskKindLabel(kind: PracticalTaskKind): string {
  return TASK_KIND_LABELS[kind];
}

export type PracticalTaskDef = {
  id: string;
  /** Official evidence reference — filename Task_3 / Task_4, not body typos. */
  evidenceRef: string;
  blockId: number;
  /**
   * 1 knowledge test · 2 job card · 3 and 4 college practicals · 5 reflection.
   * 3–5 follow the source filenames; 1 and 2 await curriculum confirmation.
   */
  taskNumber: 1 | 2 | 3 | 4 | 5;
  kind: PracticalTaskKind;
  title: string;
  scenario: string;
  objectives: string[];
  estimatedMinutes: number;
  sourcePdf: string;
  /** Inclusive week label from the PDF header, e.g. "Weeks 11-20". */
  weeks?: string;
  dutiesCovered?: string;
  ksbsCovered?: string;
  assessmentType?: string;
  materials?: string[];
  instructions?: string[];
  /** Curriculum review status for accuracy checking. */
  reviewStatus: "draft" | "curriculum_review" | "approved";
  sections: TaskSectionDef[];
};

export type LessonPlanDef = {
  id: string;
  week: number;
  blockId: number;
  title: string;
  /** Tutors/curriculum only — apprentices never see these. */
  audience: "staff";
  sourceFile: string;
};

/** Stored JSON shape for rating_rows fields. */
export type RatingRowValue = {
  area: string;
  before: string;
  now: string;
  evidence: string;
};

/** Stored JSON shape for action_rows fields. */
export type ActionRowValue = {
  action: string;
  support: string;
  ownerReview: string;
};

/** Stored JSON shape for parts_rows fields (job card parts and materials). */
export type PartsRowValue = {
  qty: string;
  description: string;
  partNo: string;
  supplier: string;
};

export function parseJsonList(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function parseRatingRows(
  raw: string | undefined,
  rowCount: number,
): RatingRowValue[] {
  const empty = (): RatingRowValue => ({
    area: "",
    before: "",
    now: "",
    evidence: "",
  });
  if (!raw) return Array.from({ length: rowCount }, empty);
  try {
    const parsed = JSON.parse(raw) as RatingRowValue[];
    if (!Array.isArray(parsed)) return Array.from({ length: rowCount }, empty);
    return Array.from({ length: rowCount }, (_, i) => ({
      area: parsed[i]?.area ?? "",
      before: parsed[i]?.before ?? "",
      now: parsed[i]?.now ?? "",
      evidence: parsed[i]?.evidence ?? "",
    }));
  } catch {
    return Array.from({ length: rowCount }, empty);
  }
}

export function parseActionRows(
  raw: string | undefined,
  rowCount: number,
): ActionRowValue[] {
  const empty = (): ActionRowValue => ({
    action: "",
    support: "",
    ownerReview: "",
  });
  if (!raw) return Array.from({ length: rowCount }, empty);
  try {
    const parsed = JSON.parse(raw) as ActionRowValue[];
    if (!Array.isArray(parsed)) return Array.from({ length: rowCount }, empty);
    return Array.from({ length: rowCount }, (_, i) => ({
      action: parsed[i]?.action ?? "",
      support: parsed[i]?.support ?? "",
      ownerReview: parsed[i]?.ownerReview ?? "",
    }));
  } catch {
    return Array.from({ length: rowCount }, empty);
  }
}

export function parsePartsRows(
  raw: string | undefined,
  rowCount: number,
): PartsRowValue[] {
  const empty = (): PartsRowValue => ({
    qty: "",
    description: "",
    partNo: "",
    supplier: "",
  });
  if (!raw) return Array.from({ length: rowCount }, empty);
  try {
    const parsed = JSON.parse(raw) as PartsRowValue[];
    if (!Array.isArray(parsed)) return Array.from({ length: rowCount }, empty);
    return Array.from({ length: rowCount }, (_, i) => ({
      qty: parsed[i]?.qty ?? "",
      description: parsed[i]?.description ?? "",
      partNo: parsed[i]?.partNo ?? "",
      supplier: parsed[i]?.supplier ?? "",
    }));
  } catch {
    return Array.from({ length: rowCount }, empty);
  }
}
