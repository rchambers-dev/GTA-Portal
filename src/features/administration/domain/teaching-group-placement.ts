/**
 * Teaching Group placement invariants.
 *
 * Teaching Group assignment never changes cohort, dates, or GTA pin.
 * Membership history is the durable record; teaching_group_id is the
 * transitional current pointer and must stay in sync with the active membership.
 */

import { formatCollegeDaysShort } from "./college-days";
import type {
  AdminApprenticeEnrolment,
  AdminTeachingGroupMembership,
  AdminTeachingGroupRecord,
} from "./types";

export const UNPINNED_PLACEMENT_MESSAGE =
  "Pin a GTA Programme Version for this apprentice before placing them in a teaching group.";

export const VERSION_MISMATCH_MESSAGE =
  "This teaching group delivers a different GTA Programme Version than the apprentice. Assign a matching group — moving groups does not change the apprentice’s programme version.";

export const INACTIVE_GROUP_MESSAGE =
  "This teaching group is inactive and cannot take new placements.";

export const VERSION_REVIEW_MESSAGE =
  "This teaching group still needs a GTA Programme Version assigned. Resolve that before placing apprentices.";

export const GROUP_NOT_FOUND_MESSAGE = "Teaching group not found.";

export const GROUP_VERSION_MEMBER_MISMATCH_MESSAGE =
  "This teaching group already has apprentices on a different GTA Programme Version. Move them before changing the group’s programme version.";

/** Operational tutor/days come from the teaching group, not the cohort. */
export function teachingGroupFieldsForEnrolment(
  group: Pick<AdminTeachingGroupRecord, "id" | "tutorName" | "collegeDays">,
): Pick<AdminApprenticeEnrolment, "teachingGroupId" | "tutorName" | "collegeDays"> {
  return {
    teachingGroupId: group.id,
    tutorName: group.tutorName,
    collegeDays: group.collegeDays,
  };
}

export function capacityFullMessage(count: number, capacity: number): string {
  return `Group is full (${count}/${capacity}). Admins can confirm to add over capacity.`;
}

export type TeachingGroupPlacementError = {
  error: string;
};

export type TeachingGroupPlacementPlan = {
  enrolmentPatch: Pick<
    AdminApprenticeEnrolment,
    "teachingGroupId" | "tutorName" | "collegeDays"
  >;
  closeMembershipId: string | null;
  newMembership: Omit<AdminTeachingGroupMembership, "id"> | null;
};

export function currentMembershipForEnrolment(
  memberships: AdminTeachingGroupMembership[],
  enrolmentId: string,
): AdminTeachingGroupMembership | null {
  return (
    memberships.find((row) => row.enrolmentId === enrolmentId && row.isCurrent) ??
    null
  );
}

export function currentMemberCount(
  enrolments: Pick<AdminApprenticeEnrolment, "id" | "teachingGroupId">[],
  teachingGroupId: string,
  excludingEnrolmentId?: string,
): number {
  return enrolments.filter(
    (row) =>
      row.teachingGroupId === teachingGroupId &&
      row.id !== excludingEnrolmentId,
  ).length;
}

export function activeGroupIdForEnrolment(args: {
  enrolment: Pick<AdminApprenticeEnrolment, "teachingGroupId">;
  currentMembership: AdminTeachingGroupMembership | null;
}): string | null {
  if (args.currentMembership?.isCurrent) {
    return args.currentMembership.teachingGroupId;
  }
  return args.enrolment.teachingGroupId ?? null;
}

export function teachingGroupsCompatibleWithPin(
  groups: AdminTeachingGroupRecord[],
  gtaProgrammeVersionId: string,
): AdminTeachingGroupRecord[] {
  const pin = gtaProgrammeVersionId.trim();
  if (!pin) return [];
  return groups.filter(
    (group) =>
      group.status === "active" &&
      !group.versionReviewRequired &&
      group.gtaProgrammeVersionId === pin,
  );
}

export function formatTeachingGroupOptionLabel(
  group: AdminTeachingGroupRecord,
  memberCount: number,
): string {
  const days = group.collegeDays
    ? ` · ${formatCollegeDaysShort(group.collegeDays)}`
    : "";
  const review = group.versionReviewRequired ? " · programme version required" : "";
  const inactive = group.status === "inactive" ? " · inactive" : "";
  return `${group.name} · ${group.tutorName}${days} · ${memberCount}/${group.capacity}${inactive}${review}`;
}

export function assertTeachingGroupPlacement(args: {
  enrolment: Pick<
    AdminApprenticeEnrolment,
    "id" | "gtaProgrammeVersionId" | "teachingGroupId"
  >;
  group: AdminTeachingGroupRecord | null;
  enrolments: Pick<AdminApprenticeEnrolment, "id" | "teachingGroupId">[];
  allowOverCapacity?: boolean;
}): TeachingGroupPlacementError | { ok: true } {
  const { enrolment, group } = args;
  if (!group) return { error: GROUP_NOT_FOUND_MESSAGE };
  if (group.status === "inactive") return { error: INACTIVE_GROUP_MESSAGE };
  if (!group.gtaProgrammeVersionId || group.versionReviewRequired) {
    return { error: VERSION_REVIEW_MESSAGE };
  }
  const pin = enrolment.gtaProgrammeVersionId?.trim() || "";
  if (!pin) return { error: UNPINNED_PLACEMENT_MESSAGE };
  if (pin !== group.gtaProgrammeVersionId) {
    return { error: VERSION_MISMATCH_MESSAGE };
  }
  if (!args.allowOverCapacity) {
    const count = currentMemberCount(args.enrolments, group.id, enrolment.id);
    if (count >= group.capacity) {
      return { error: capacityFullMessage(count, group.capacity) };
    }
  }
  return { ok: true };
}

export function planTeachingGroupMembershipChange(args: {
  enrolment: Pick<
    AdminApprenticeEnrolment,
    | "id"
    | "gtaProgrammeVersionId"
    | "teachingGroupId"
    | "tutorName"
    | "collegeDays"
  >;
  group: AdminTeachingGroupRecord | null;
  currentMembership: AdminTeachingGroupMembership | null;
  enrolments: Pick<AdminApprenticeEnrolment, "id" | "teachingGroupId">[];
  allowOverCapacity?: boolean;
  actorName?: string;
  nowIso?: string;
}): TeachingGroupPlacementError | TeachingGroupPlacementPlan {
  const stamp = args.nowIso ?? new Date().toISOString();
  const actorName = args.actorName?.trim() || "";
  const activeGroupId = activeGroupIdForEnrolment({
    enrolment: args.enrolment,
    currentMembership: args.currentMembership,
  });

  if (!args.group) {
    return {
      enrolmentPatch: {
        teachingGroupId: null,
        tutorName: args.enrolment.tutorName,
        collegeDays: args.enrolment.collegeDays,
      },
      closeMembershipId: args.currentMembership?.isCurrent
        ? args.currentMembership.id
        : null,
      newMembership: null,
    };
  }

  const check = assertTeachingGroupPlacement({
    enrolment: args.enrolment,
    group: args.group,
    enrolments: args.enrolments,
    allowOverCapacity: args.allowOverCapacity,
  });
  if ("error" in check) return check;

  if (activeGroupId === args.group.id) {
    return {
      enrolmentPatch: teachingGroupFieldsForEnrolment(args.group),
      closeMembershipId: null,
      newMembership: args.currentMembership?.isCurrent
        ? null
        : {
            enrolmentId: args.enrolment.id,
            teachingGroupId: args.group.id,
            joinedAt: stamp,
            leftAt: null,
            isCurrent: true,
            source: "staff",
            recordedAt: stamp,
            actorName,
            notes: "Synced current teaching group pointer into membership history.",
          },
    };
  }

  return {
    enrolmentPatch: teachingGroupFieldsForEnrolment(args.group),
    closeMembershipId: args.currentMembership?.isCurrent
      ? args.currentMembership.id
      : null,
    newMembership: {
      enrolmentId: args.enrolment.id,
      teachingGroupId: args.group.id,
      joinedAt: stamp,
      leftAt: null,
      isCurrent: true,
      source: "staff",
      recordedAt: stamp,
      actorName,
      notes: "",
    },
  };
}

/** Fields that teaching-group assignment is forbidden from changing. */
export function teachingGroupMustNotRewriteEnrolment(): Array<
  keyof AdminApprenticeEnrolment
> {
  return [
    "cohortId",
    "startDate",
    "originalPlannedEndDate",
    "gtaProgrammeVersionId",
    "programmeWeek",
    "programmeYear",
  ];
}

export function notesWithTutorIdentity(
  notes: string,
  tutor: { id?: string; email?: string },
): string {
  const bits = [notes.trim()].filter(Boolean);
  if (tutor.id && !notes.includes(tutor.id)) bits.push(tutor.id);
  if (tutor.email && !notes.toLowerCase().includes(tutor.email.toLowerCase())) {
    bits.push(tutor.email);
  }
  return bits.join("\n");
}

export function closedMembershipPatch(
  membership: AdminTeachingGroupMembership,
  leftAt: string,
): AdminTeachingGroupMembership {
  return {
    ...membership,
    isCurrent: false,
    leftAt,
  };
}

export function applyMembershipPlanToList(args: {
  memberships: AdminTeachingGroupMembership[];
  plan: TeachingGroupPlacementPlan;
  newId: string;
  leftAt: string;
}): AdminTeachingGroupMembership[] {
  let next = args.memberships;
  if (args.plan.closeMembershipId) {
    next = next.map((row) =>
      row.id === args.plan.closeMembershipId
        ? closedMembershipPatch(row, args.leftAt)
        : row,
    );
  }
  if (args.plan.newMembership) {
    next = [
      { id: args.newId, ...args.plan.newMembership },
      ...next.filter((row) => row.id !== args.newId),
    ];
  }
  return next;
}
