/**
 * CEA (Competence Evidence Assessment) personal tracking.
 * Pack source: MV13.1 Autocare Apprentice Personal Tracking v1.8 — ST0499.
 *
 * Sign-off:
 * - Mandatory (teacher-allocated): apprentice submits → teacher reviews / signs off
 * - Additional (teacher-enabled for workplace): apprentice submits → employer approves
 *   → teacher verifies (both required before signed_off)
 */

export type CeaTaskKind = "mandatory" | "additional";

export type CeaTaskStatus =
  | "not_started"
  | "in_progress"
  | "ready_to_assess"
  /** Additional tasks only — employer approved, waiting for tutor verify. */
  | "awaiting_tutor_verify"
  | "signed_off"
  | "returned";

export type CeaSignOffRole = "teacher" | "employer";

/** Per form-field review decision (Word-doc style section ticks). */
export type CeaFieldReviewStatus = "open" | "approved" | "needs_amendment";

export type CeaRelatedTeaching = {
  moduleId?: string;
  topicId?: string;
  label: string;
  /** Official apprenticeship refs, e.g. ST0499:K12 */
  imiRefs: string[];
  needsStaffConfirm?: boolean;
};

export type CeaTaskDef = {
  id: string;
  groupId: string;
  number: number;
  title: string;
  /** When true, must be one of the allocated mandatory set (e.g. Group 14 Task 5). */
  alwaysMandatory?: boolean;
  relatedTeaching?: CeaRelatedTeaching;
};

export type CeaGroupDef = {
  id: string;
  milestoneId: string;
  number: number;
  title: string;
  /** How many tasks the teacher must allocate as mandatory (from the sheet). */
  mandatoryRequired: number;
  /** Contribution toward parent milestone when mandatory quota is met (0–100 of that milestone). */
  milestoneWeightPercent: number;
  /**
   * Overall course progress % from the MV personal-tracking sheet (when published).
   * Used by the groups BRAG / planned-vs-actual engine — not renormalised within a milestone.
   */
  courseWeightPercent?: number;
  yearLabel: "Year 1" | "Year 2" | "Year 3";
  phaseLabel: string;
  knowledgeTestNote?: string;
  tasks: CeaTaskDef[];
};

/** Milestone kind on the groups spine (separate from Autocare block/gateway weeks). */
export type CeaMilestoneKind = "groups_phase" | "gateway" | "epa";

export type CeaMilestoneDef = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  phaseLabel: string;
  /**
   * Inclusive programme-month bracket from the tracker sheet (e.g. 0–6, 7–12).
   * `monthStart` 0 = programme start. End dating is calendar months from start.
   */
  monthStart: number | null;
  monthEnd: number | null;
  kind: CeaMilestoneKind;
  /** Course % for gateway / EPA rows when the sheet publishes one (e.g. GW1 10%). */
  courseWeightPercent?: number;
};

export type CeaGatewayItem = {
  id: string;
  milestoneId: string;
  code: string;
  title: string;
  status: CeaTaskStatus;
};

export type CeaSupportItem = {
  id: string;
  section: string;
  title: string;
  status: "not_started" | "complete";
};

export type CeaPackDef = {
  id: string;
  title: string;
  version: string;
  standardCode: string;
  standardLabel: string;
  milestones: CeaMilestoneDef[];
  groups: CeaGroupDef[];
  gatewayItems: CeaGatewayItem[];
  supportItems: CeaSupportItem[];
};

/** Margin comment (Word-style), optionally pinned to a form field. */
export type CeaReviewComment = {
  id: string;
  at: string;
  by: string;
  byRole: CeaSignOffRole;
  text: string;
  fieldKey: string | null;
  /** Soft hide after the apprentices amends that field — history kept. */
  resolved: boolean;
};

/** Snapshot of each declared submission. */
export type CeaSubmissionVersion = {
  version: number;
  submittedAt: string;
  isResubmission: boolean;
  declaredAt: string | null;
  fields: Record<string, string>;
  /** Overall review written when this version was closed (return or sign-off). */
  reviewNote: string | null;
  outcome:
    | "pending"
    | "returned"
    | "employer_approved"
    | "signed_off"
    | null;
};

export type CeaTaskProgress = {
  taskId: string;
  kind: CeaTaskKind;
  /** Teacher has enabled this as an additional workplace task. */
  additionalEnabled: boolean;
  status: CeaTaskStatus;
  /** Free-text notes (legacy / extra). Main work lives in `fields`. */
  apprenticeNotes: string;
  /** Working draft answers from the Course Builder learner form. */
  fields: Record<string, string>;
  /** Tutor/employer tick per form field key. */
  fieldReviews: Record<string, CeaFieldReviewStatus>;
  /** Margin comments from reviewers. */
  comments: CeaReviewComment[];
  /** Full submission history (immutable snapshots). */
  versions: CeaSubmissionVersion[];
  /** Apprentice ticked "this is my own work" on latest submit. */
  apprenticeDeclaredAt: string | null;
  /** How many times this task has been submitted (includes first submit). */
  submissionCount: number;
  /** True when the latest submit followed a return. */
  isResubmission: boolean;
  submittedAt: string | null;
  readyAt: string | null;
  /** Employer approval (additional tasks) before tutor verify. */
  employerSignedByName: string | null;
  employerSignedAt: string | null;
  /** Final tutor (or sole teacher) sign-off. */
  signedOffByRole: CeaSignOffRole | null;
  signedOffByName: string | null;
  signedOffAt: string | null;
  returnNote: string | null;
  /** Latest written review (also copied onto the version when decided). */
  tutorReview: string | null;
};

export type CeaApprenticeState = {
  apprenticeId: string;
  packId: string;
  /** Teacher-allocated mandatory task IDs per group. */
  mandatoryByGroup: Record<string, string[]>;
  progress: Record<string, CeaTaskProgress>;
  milestoneReflections: Record<
    string,
    { text: string; status: "draft" | "submitted" | "accepted" }
  >;
};

export function getCeaGroupTasks(group: CeaGroupDef): CeaTaskDef[] {
  return group.tasks;
}

export function isMandatoryAllocated(
  state: CeaApprenticeState,
  groupId: string,
  taskId: string,
): boolean {
  return (state.mandatoryByGroup[groupId] ?? []).includes(taskId);
}

export function getCeaTaskProgress(
  state: CeaApprenticeState,
  taskId: string,
): CeaTaskProgress | undefined {
  return state.progress[taskId];
}

export function groupMandatoryComplete(
  group: CeaGroupDef,
  state: CeaApprenticeState,
): boolean {
  const allocated = state.mandatoryByGroup[group.id] ?? [];
  if (allocated.length < group.mandatoryRequired) return false;
  return allocated.every(
    (id) => state.progress[id]?.status === "signed_off",
  );
}

export function groupAdditionalSignedOffCount(
  group: CeaGroupDef,
  state: CeaApprenticeState,
): number {
  return group.tasks.filter((t) => {
    const p = state.progress[t.id];
    return (
      p?.kind === "additional" &&
      p.additionalEnabled &&
      p.status === "signed_off"
    );
  }).length;
}

export function milestoneProgressPercent(
  milestoneId: string,
  pack: CeaPackDef,
  state: CeaApprenticeState,
): number {
  const groups = pack.groups.filter((g) => g.milestoneId === milestoneId);
  if (groups.length === 0) return 0;
  const earned = groups.reduce((sum, g) => {
    if (!groupMandatoryComplete(g, state)) return sum;
    return sum + g.milestoneWeightPercent;
  }, 0);
  const totalWeight = groups.reduce((sum, g) => sum + g.milestoneWeightPercent, 0);
  if (totalWeight <= 0) return 0;
  return Math.min(100, Math.round((earned / totalWeight) * 100));
}

export function packOverview(pack: CeaPackDef, state: CeaApprenticeState) {
  const groupsComplete = pack.groups.filter((g) =>
    groupMandatoryComplete(g, state),
  ).length;
  let mandatorySigned = 0;
  let mandatoryTotal = 0;
  let additionalSigned = 0;
  let awaitingTeacher = 0;
  let awaitingEmployer = 0;

  for (const g of pack.groups) {
    const allocated = state.mandatoryByGroup[g.id] ?? [];
    mandatoryTotal += g.mandatoryRequired;
    for (const id of allocated) {
      const p = state.progress[id];
      if (p?.status === "signed_off") mandatorySigned += 1;
      if (p?.status === "ready_to_assess" && p.kind === "mandatory") {
        awaitingTeacher += 1;
      }
    }
    for (const t of g.tasks) {
      const p = state.progress[t.id];
      if (!p) continue;
      if (p.kind === "additional" && p.additionalEnabled) {
        if (p.status === "signed_off") additionalSigned += 1;
        if (p.status === "ready_to_assess") awaitingEmployer += 1;
        if (p.status === "awaiting_tutor_verify") awaitingTeacher += 1;
      }
    }
  }

  return {
    groupsComplete,
    groupsTotal: pack.groups.length,
    mandatorySigned,
    mandatoryTotal,
    additionalSigned,
    awaitingTeacher,
    awaitingEmployer,
  };
}

/** Who reviews the current submitted/queued status. */
export function currentReviewerRole(
  progress: Pick<CeaTaskProgress, "kind" | "status">,
): CeaSignOffRole | null {
  if (progress.status === "ready_to_assess") {
    return progress.kind === "additional" ? "employer" : "teacher";
  }
  if (progress.status === "awaiting_tutor_verify") return "teacher";
  return null;
}

/** First reviewer in the chain (employer for workplace tasks). */
export function expectedSignOffRole(kind: CeaTaskKind): CeaSignOffRole {
  return kind === "mandatory" ? "teacher" : "employer";
}

export function ceaStatusLabel(status: CeaTaskStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "ready_to_assess":
      return "Submitted";
    case "awaiting_tutor_verify":
      return "Employer approved — tutor verify";
    case "signed_off":
      return "Signed off";
    case "returned":
      return "Returned — amend";
  }
}

export function ceaStatusTone(
  status: CeaTaskStatus,
): "neutral" | "blue" | "amber" | "green" | "red" {
  switch (status) {
    case "signed_off":
      return "green";
    case "ready_to_assess":
      return "amber";
    case "awaiting_tutor_verify":
      return "blue";
    case "in_progress":
      return "blue";
    case "returned":
      return "red";
    default:
      return "neutral";
  }
}

export function emptyCeaTaskProgress(
  taskId: string,
  kind: CeaTaskKind,
): CeaTaskProgress {
  return {
    taskId,
    kind,
    additionalEnabled: false,
    status: "not_started",
    apprenticeNotes: "",
    fields: {},
    fieldReviews: {},
    comments: [],
    versions: [],
    apprenticeDeclaredAt: null,
    submissionCount: 0,
    isResubmission: false,
    submittedAt: null,
    readyAt: null,
    employerSignedByName: null,
    employerSignedAt: null,
    signedOffByRole: null,
    signedOffByName: null,
    signedOffAt: null,
    returnNote: null,
    tutorReview: null,
  };
}

/** Merge legacy / partial progress rows into the current shape. */
export function normalizeCeaTaskProgress(
  taskId: string,
  raw: Partial<CeaTaskProgress> & {
    tutorComments?: CeaReviewComment[];
  } | undefined,
  kind: CeaTaskKind = "mandatory",
): CeaTaskProgress {
  const blank = emptyCeaTaskProgress(taskId, kind);
  if (!raw) return blank;
  const comments = Array.isArray(raw.comments)
    ? raw.comments
    : Array.isArray(raw.tutorComments)
      ? raw.tutorComments
      : [];
  return {
    ...blank,
    ...raw,
    taskId,
    kind: raw.kind ?? kind,
    fields:
      raw.fields && typeof raw.fields === "object" ? raw.fields : {},
    fieldReviews:
      raw.fieldReviews && typeof raw.fieldReviews === "object"
        ? raw.fieldReviews
        : {},
    comments: comments.map((c) => ({
      id: c.id,
      at: c.at,
      by: c.by,
      byRole: c.byRole ?? "teacher",
      text: c.text,
      fieldKey: c.fieldKey ?? null,
      resolved: Boolean(c.resolved),
    })),
    versions: Array.isArray(raw.versions) ? raw.versions : [],
    submissionCount: raw.submissionCount ?? 0,
    isResubmission: Boolean(raw.isResubmission),
    employerSignedByName: raw.employerSignedByName ?? null,
    employerSignedAt: raw.employerSignedAt ?? null,
  };
}

/** Whether the apprentice may edit this field in the current status. */
export function isCeaFieldEditableForApprentice(
  progress: CeaTaskProgress,
  fieldKey: string,
): boolean {
  if (
    progress.status === "ready_to_assess" ||
    progress.status === "awaiting_tutor_verify" ||
    progress.status === "signed_off"
  ) {
    return false;
  }
  if (progress.status === "returned") {
    const review = progress.fieldReviews[fieldKey] ?? "open";
    return review === "needs_amendment" || review === "open";
  }
  return true;
}
