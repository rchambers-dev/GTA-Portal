/**
 * CEA (Competence Evidence Assessment) personal tracking.
 * Pack source: MV13.1 Autocare Learner Personal Tracking v1.8 — ST0499.
 *
 * Sign-off:
 * - Mandatory (teacher-allocated): learner marks ready → teacher signs off
 * - Additional (teacher-enabled for workplace): learner marks ready → employer signs off
 */

export type CeaTaskKind = "mandatory" | "additional";

export type CeaTaskStatus =
  | "not_started"
  | "in_progress"
  | "ready_to_assess"
  | "signed_off"
  | "returned";

export type CeaSignOffRole = "teacher" | "employer";

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
  yearLabel: "Year 1" | "Year 2";
  phaseLabel: string;
  knowledgeTestNote?: string;
  tasks: CeaTaskDef[];
};

export type CeaMilestoneDef = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  phaseLabel: string;
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

export type CeaTaskProgress = {
  taskId: string;
  kind: CeaTaskKind;
  /** Teacher has enabled this as an additional workplace task. */
  additionalEnabled: boolean;
  status: CeaTaskStatus;
  learnerNotes: string;
  readyAt: string | null;
  signedOffByRole: CeaSignOffRole | null;
  signedOffByName: string | null;
  signedOffAt: string | null;
  returnNote: string | null;
};

export type CeaLearnerState = {
  learnerId: string;
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
  state: CeaLearnerState,
  groupId: string,
  taskId: string,
): boolean {
  return (state.mandatoryByGroup[groupId] ?? []).includes(taskId);
}

export function getCeaTaskProgress(
  state: CeaLearnerState,
  taskId: string,
): CeaTaskProgress | undefined {
  return state.progress[taskId];
}

export function groupMandatoryComplete(
  group: CeaGroupDef,
  state: CeaLearnerState,
): boolean {
  const allocated = state.mandatoryByGroup[group.id] ?? [];
  if (allocated.length < group.mandatoryRequired) return false;
  return allocated.every(
    (id) => state.progress[id]?.status === "signed_off",
  );
}

export function groupAdditionalSignedOffCount(
  group: CeaGroupDef,
  state: CeaLearnerState,
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
  state: CeaLearnerState,
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

export function packOverview(pack: CeaPackDef, state: CeaLearnerState) {
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
      return "Ready to assess";
    case "signed_off":
      return "Signed off";
    case "returned":
      return "Returned";
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
    case "in_progress":
      return "blue";
    case "returned":
      return "red";
    default:
      return "neutral";
  }
}
