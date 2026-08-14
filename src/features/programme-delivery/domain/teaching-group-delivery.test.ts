import { describe, expect, it } from "vitest";
import { buildEffectiveSession } from "@/lib/permissions/effective-permissions";
import type { PortalAccount } from "@/lib/portal/types";
import {
  eligibleReleaseRoster,
  planSessionLearningRelease,
  tutorOwnsTeachingGroup,
  type TeachingGroupRosterMember,
} from "./teaching-group-delivery";

function account(input: {
  workspace: PortalAccount["workspace"];
  permissions: string[];
  name?: string;
  id?: string;
  email?: string;
  baseRole?: string;
}): PortalAccount {
  return {
    id: input.id || "staff-1",
    name: input.name || "TEST Autocare Tutor (SAFE DEMO)",
    initials: "T",
    email: input.email || "test-autocare-tutor@example.invalid",
    baseRole: input.baseRole || "Tutor",
    responsibilities: [],
    workspace: input.workspace,
    permissions: input.permissions,
  };
}

const tutor = buildEffectiveSession(
  account({
    workspace: "staff",
    permissions: ["staff.workspace.view", "modules.deliver"],
  }),
  [],
);

const otherTutor = buildEffectiveSession(
  account({
    id: "staff-2",
    name: "Another Tutor",
    email: "other-tutor@example.invalid",
    workspace: "staff",
    permissions: ["staff.workspace.view", "modules.deliver"],
  }),
  [],
);

const manager = buildEffectiveSession(
  account({
    id: "mgr-1",
    name: "Curriculum Owner",
    workspace: "management",
    permissions: ["management.workspace.view", "management.programme.setup"],
  }),
  [],
);

function member(
  id: string,
  status = "active",
): TeachingGroupRosterMember {
  return {
    apprenticeProgrammeId: `enr-${id}`,
    apprenticeId: `ap-${id}`,
    displayName: `Apprentice ${id}`,
    apprenticeReference: `REF-${id}`,
    status,
    programmeVersionId: "pv",
    programmeWeek: 3,
  };
}

describe("teaching-group learning release planning", () => {
  it("lets a tutor deliver only their own teaching group", () => {
    const group = {
      tutorName: "TEST Autocare Tutor (SAFE DEMO)",
      notes: "SAFE TEST fixture. tutorProfileId=staff-1",
    };
    expect(tutorOwnsTeachingGroup({ session: tutor, group })).toBe(true);
    expect(tutorOwnsTeachingGroup({ session: otherTutor, group })).toBe(false);
    expect(tutorOwnsTeachingGroup({ session: manager, group })).toBe(true);
  });

  it("drops withdrawn enrolments and unpinned programmes from the roster", () => {
    const roster = eligibleReleaseRoster([
      member("a"),
      member("b", "withdrawn"),
      { ...member("c"), programmeVersionId: null },
    ]);
    expect(roster.map((r) => r.apprenticeProgrammeId)).toEqual(["enr-a"]);
  });

  it("creates missing grants only and ignores future joiners not on the current roster", () => {
    const plan = planSessionLearningRelease({
      roster: [member("a"), member("b"), member("c"), member("d")],
      alreadyReleasedEnrolmentIds: new Set(["enr-a", "enr-b", "enr-c"]),
      selectedEnrolmentIds: new Set(["enr-a", "enr-b", "enr-c", "enr-d", "enr-future"]),
    });
    expect(plan.alreadyHaveAccess.map((r) => r.apprenticeProgrammeId)).toEqual([
      "enr-a",
      "enr-b",
      "enr-c",
    ]);
    expect(plan.willReceiveAccess.map((r) => r.apprenticeProgrammeId)).toEqual([
      "enr-d",
    ]);
    expect(plan.ignoredUnknownIds).toEqual(["enr-future"]);
  });

  it("does not auto-grant a later joiner just because they share the teaching group", () => {
    const original = planSessionLearningRelease({
      roster: [member("a"), member("b")],
      alreadyReleasedEnrolmentIds: new Set(),
      selectedEnrolmentIds: new Set(["enr-a", "enr-b"]),
    });
    expect(original.willReceiveAccess).toHaveLength(2);

    const later = planSessionLearningRelease({
      roster: [member("a"), member("b"), member("c")],
      alreadyReleasedEnrolmentIds: new Set(["enr-a", "enr-b"]),
      selectedEnrolmentIds: new Set(["enr-a", "enr-b"]),
    });
    expect(later.willReceiveAccess).toEqual([]);
    expect(later.skippedDeselected.map((r) => r.apprenticeProgrammeId)).toEqual([
      "enr-c",
    ]);
  });
});
