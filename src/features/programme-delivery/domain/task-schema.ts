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
  | "knowledge_question"
  | "sign_off"
  | "difficulty_feedback";

export type TaskFieldDef = {
  key: string;
  type: TaskBlockType;
  label: string;
  hint?: string;
  required?: boolean;
  /** For checkbox_group */
  options?: string[];
  /** For sign_off — who must complete this box */
  signOffRole?: "apprentice" | "mentor" | "trainer" | "assessor";
  /** Who fills this field (defaults to apprentice). Staff-only on learner form. */
  filledBy?: "apprentice" | "mentor" | "trainer" | "assessor";
};

export type TaskSectionDef = {
  id: string;
  title: string;
  fields: TaskFieldDef[];
};

export type PracticalTaskKind = "practical" | "reflection" | "knowledge_test";

export type PracticalTaskDef = {
  id: string;
  /** Official evidence reference — filename Task_3 / Task_4, not body typos. */
  evidenceRef: string;
  blockId: number;
  kind: PracticalTaskKind;
  title: string;
  scenario: string;
  objectives: string[];
  estimatedMinutes: number;
  sourcePdf: string;
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
