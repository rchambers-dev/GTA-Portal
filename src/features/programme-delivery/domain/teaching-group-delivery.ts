/**
 * Teaching-group Programme Delivery helpers.
 * Teaching groups are tutor-owned college-day classes — not Groups/CEA curriculum.
 */

import type { EffectiveSession } from "@/lib/portal/types";
import { hasPermission } from "@/lib/permissions/effective-permissions";
import { PERMISSIONS } from "@/lib/permissions/capabilities";

export type TeachingGroupRecord = {
  id: string;
  cohortId: string | null;
  name: string;
  tutorName: string;
  collegeDays: string;
  notes: string;
};

export type TeachingGroupRosterMember = {
  apprenticeProgrammeId: string;
  apprenticeId: string;
  displayName: string;
  apprenticeReference: string;
  status: string;
  programmeVersionId: string | null;
  programmeWeek: number;
};

export function canSeeAllTeachingGroups(session: EffectiveSession): boolean {
  return hasPermission(session, PERMISSIONS.MANAGEMENT_WORKSPACE_VIEW);
}

export function tutorOwnsTeachingGroup(input: {
  session: EffectiveSession;
  group: Pick<TeachingGroupRecord, "tutorName" | "notes">;
}): boolean {
  if (canSeeAllTeachingGroups(input.session)) return true;
  const name = input.session.account.name.trim().toLowerCase();
  const tutorName = input.group.tutorName.trim().toLowerCase();
  if (name && tutorName && name === tutorName) return true;
  const notes = input.group.notes || "";
  const accountId = input.session.account.id.trim();
  if (accountId && notes.includes(accountId)) return true;
  const email = input.session.account.email.trim().toLowerCase();
  if (email && notes.toLowerCase().includes(email)) return true;
  return false;
}

export function isEligibleReleaseEnrolment(
  member: Pick<TeachingGroupRosterMember, "status" | "programmeVersionId">,
): boolean {
  if (!member.programmeVersionId?.trim()) return false;
  if (member.status === "withdrawn" || member.status === "completed") {
    return false;
  }
  return true;
}

export function eligibleReleaseRoster(
  members: TeachingGroupRosterMember[],
): TeachingGroupRosterMember[] {
  return members.filter(isEligibleReleaseEnrolment);
}

export type SessionReleasePlan = {
  alreadyHaveAccess: TeachingGroupRosterMember[];
  willReceiveAccess: TeachingGroupRosterMember[];
  skippedDeselected: TeachingGroupRosterMember[];
  ignoredUnknownIds: string[];
};

/**
 * Group UI action → per-enrolment grants.
 * Selected ids that are not on the current roster are ignored (no future-joiner
 * inheritance, no spoofed teaching_group membership).
 * Already-released enrolments are not duplicated.
 */
export function planSessionLearningRelease(input: {
  roster: TeachingGroupRosterMember[];
  alreadyReleasedEnrolmentIds: ReadonlySet<string>;
  selectedEnrolmentIds: ReadonlySet<string>;
}): SessionReleasePlan {
  const rosterIds = new Set(
    input.roster.map((member) => member.apprenticeProgrammeId),
  );
  const ignoredUnknownIds = [...input.selectedEnrolmentIds].filter(
    (id) => !rosterIds.has(id),
  );
  const alreadyHaveAccess = input.roster.filter((member) =>
    input.alreadyReleasedEnrolmentIds.has(member.apprenticeProgrammeId),
  );
  const willReceiveAccess = input.roster.filter(
    (member) =>
      input.selectedEnrolmentIds.has(member.apprenticeProgrammeId) &&
      !input.alreadyReleasedEnrolmentIds.has(member.apprenticeProgrammeId),
  );
  const skippedDeselected = input.roster.filter(
    (member) =>
      !input.selectedEnrolmentIds.has(member.apprenticeProgrammeId) &&
      !input.alreadyReleasedEnrolmentIds.has(member.apprenticeProgrammeId),
  );
  return {
    alreadyHaveAccess,
    willReceiveAccess,
    skippedDeselected,
    ignoredUnknownIds,
  };
}

export function classifyTutorResource(input: {
  title: string;
  filename: string;
  role: string;
}): "lesson_plan" | "powerpoint" | "other_tutor" {
  const blob = `${input.title} ${input.filename} ${input.role}`.toLowerCase();
  if (/\.(ppt|pptx|pptm)(\b|$)/i.test(input.filename) || /\bppt\b/.test(blob)) {
    return "powerpoint";
  }
  if (/lesson plan|lesson_plan/.test(blob)) return "lesson_plan";
  return "other_tutor";
}
