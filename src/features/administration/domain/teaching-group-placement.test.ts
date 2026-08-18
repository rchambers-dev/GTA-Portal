import { describe, expect, it } from "vitest";
import {
  INACTIVE_GROUP_MESSAGE,
  UNPINNED_PLACEMENT_MESSAGE,
  VERSION_MISMATCH_MESSAGE,
  VERSION_REVIEW_MESSAGE,
  assertTeachingGroupPlacement,
  planTeachingGroupMembershipChange,
  teachingGroupFieldsForEnrolment,
  teachingGroupMustNotRewriteEnrolment,
  teachingGroupsCompatibleWithPin,
} from "./teaching-group-placement";
import type {
  AdminApprenticeEnrolment,
  AdminTeachingGroupMembership,
  AdminTeachingGroupRecord,
} from "./types";

function group(
  partial: Partial<AdminTeachingGroupRecord> & Pick<AdminTeachingGroupRecord, "id">,
): AdminTeachingGroupRecord {
  return {
    cohortId: null,
    gtaProgrammeVersionId: "gta-v2",
    versionReviewRequired: false,
    status: "active",
    tutorName: "Mike Hepworth",
    name: "Monday Autocare Group",
    collegeDays: "Monday",
    capacity: 2,
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function enrolment(
  partial: Partial<AdminApprenticeEnrolment> & Pick<AdminApprenticeEnrolment, "id">,
): AdminApprenticeEnrolment {
  return {
    kind: "new_starter",
    status: "active",
    apprenticeId: "ap-1",
    displayName: "Learner",
    email: "learner@example.invalid",
    phone: "",
    dateOfBirth: "",
    uln: "",
    programmeName: "Autocare Technician Level 2",
    standardCode: "ST0499",
    gtaProgrammeVersionId: "gta-v2",
    cohortId: "sep-2026",
    teachingGroupId: null,
    employerId: "emp-1",
    employerName: "Garage",
    workplaceContact: "",
    mentorName: "",
    tutorName: "",
    startDate: "2026-09-14",
    originalPlannedEndDate: "2029-03-14",
    programmeYear: 1,
    programmeWeek: 1,
    attendancePercent: null,
    actualProgressPercent: null,
    collegeDays: "",
    notes: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("independent teaching groups", () => {
  it("creates a placement patch with tutor and days and no cohort", () => {
    const monday = group({ id: "tg-1" });
    const patch = teachingGroupFieldsForEnrolment(monday);
    expect(patch.teachingGroupId).toBe("tg-1");
    expect(patch.tutorName).toBe("Mike Hepworth");
    expect(patch.collegeDays).toBe("Monday");
    expect(patch).not.toHaveProperty("cohortId");
    expect(teachingGroupMustNotRewriteEnrolment()).toEqual(
      expect.arrayContaining([
        "cohortId",
        "startDate",
        "originalPlannedEndDate",
        "gtaProgrammeVersionId",
      ]),
    );
  });
});

describe("mixed intakes", () => {
  it("lets September and January learners join the same group when the GTA pin matches", () => {
    const monday = group({ id: "tg-1" });
    const september = enrolment({
      id: "enr-sep",
      cohortId: "sep-2026",
      startDate: "2026-09-14",
    });
    const january = enrolment({
      id: "enr-jan",
      cohortId: "jan-2027",
      startDate: "2027-01-12",
    });
    expect(
      assertTeachingGroupPlacement({
        enrolment: september,
        group: monday,
        enrolments: [],
      }),
    ).toEqual({ ok: true });
    expect(
      assertTeachingGroupPlacement({
        enrolment: january,
        group: monday,
        enrolments: [september],
      }),
    ).toEqual({ ok: true });
    expect(september.cohortId).toBe("sep-2026");
    expect(january.cohortId).toBe("jan-2027");
  });
});

describe("version mismatch and unpinned learners", () => {
  it("rejects a learner on version A joining a group on version B", () => {
    const result = assertTeachingGroupPlacement({
      enrolment: enrolment({ id: "enr-1", gtaProgrammeVersionId: "gta-v2" }),
      group: group({ id: "tg-b", gtaProgrammeVersionId: "gta-v3" }),
      enrolments: [],
    });
    expect(result).toEqual({ error: VERSION_MISMATCH_MESSAGE });
  });

  it("rejects an unpinned learner joining a versioned group", () => {
    const result = assertTeachingGroupPlacement({
      enrolment: enrolment({ id: "enr-1", gtaProgrammeVersionId: null }),
      group: group({ id: "tg-1" }),
      enrolments: [],
    });
    expect(result).toEqual({ error: UNPINNED_PLACEMENT_MESSAGE });
  });

  it("rejects placement into a group that still needs a programme version", () => {
    const result = assertTeachingGroupPlacement({
      enrolment: enrolment({ id: "enr-1" }),
      group: group({
        id: "tg-legacy",
        gtaProgrammeVersionId: null,
        versionReviewRequired: true,
      }),
      enrolments: [],
    });
    expect(result).toEqual({ error: VERSION_REVIEW_MESSAGE });
  });
});

describe("capacity and inactive groups", () => {
  it("cannot silently place a learner into a full group", () => {
    const monday = group({ id: "tg-1", capacity: 1 });
    const result = assertTeachingGroupPlacement({
      enrolment: enrolment({ id: "enr-new" }),
      group: monday,
      enrolments: [enrolment({ id: "enr-full", teachingGroupId: "tg-1" })],
    });
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error).toMatch(/full/i);
  });

  it("allows an explicit over-capacity override", () => {
    const monday = group({ id: "tg-1", capacity: 1 });
    expect(
      assertTeachingGroupPlacement({
        enrolment: enrolment({ id: "enr-new" }),
        group: monday,
        enrolments: [enrolment({ id: "enr-full", teachingGroupId: "tg-1" })],
        allowOverCapacity: true,
      }),
    ).toEqual({ ok: true });
  });

  it("cannot normally place a learner into an inactive group", () => {
    const result = assertTeachingGroupPlacement({
      enrolment: enrolment({ id: "enr-1" }),
      group: group({ id: "tg-1", status: "inactive" }),
      enrolments: [],
    });
    expect(result).toEqual({ error: INACTIVE_GROUP_MESSAGE });
  });
});

describe("group transfer and membership history", () => {
  it("closes membership A, opens membership B, and keeps cohort/dates/pin", () => {
    const groupA = group({ id: "tg-a", name: "Group A" });
    const groupB = group({ id: "tg-b", name: "Group B", collegeDays: "Wednesday" });
    const learner = enrolment({
      id: "enr-1",
      teachingGroupId: "tg-a",
      tutorName: groupA.tutorName,
      collegeDays: groupA.collegeDays,
      cohortId: "sep-2026",
      startDate: "2026-09-14",
      originalPlannedEndDate: "2029-03-14",
      gtaProgrammeVersionId: "gta-v2",
    });
    const current: AdminTeachingGroupMembership = {
      id: "mem-a",
      enrolmentId: "enr-1",
      teachingGroupId: "tg-a",
      joinedAt: null,
      leftAt: null,
      isCurrent: true,
      source: "legacy_backfill",
      recordedAt: "2026-08-01T00:00:00.000Z",
      actorName: "",
      notes: "legacy",
    };
    const plan = planTeachingGroupMembershipChange({
      enrolment: learner,
      group: groupB,
      currentMembership: current,
      enrolments: [learner],
      nowIso: "2026-08-18T12:00:00.000Z",
      actorName: "Reiss Chambers",
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.closeMembershipId).toBe("mem-a");
    expect(plan.newMembership?.teachingGroupId).toBe("tg-b");
    expect(plan.newMembership?.isCurrent).toBe(true);
    expect(plan.newMembership?.joinedAt).toBe("2026-08-18T12:00:00.000Z");
    expect(plan.enrolmentPatch.teachingGroupId).toBe("tg-b");
    expect(plan.enrolmentPatch).not.toHaveProperty("cohortId");
    expect(plan.enrolmentPatch).not.toHaveProperty("startDate");
    expect(plan.enrolmentPatch).not.toHaveProperty("gtaProgrammeVersionId");
    expect(learner.cohortId).toBe("sep-2026");
    expect(learner.startDate).toBe("2026-09-14");
    expect(learner.gtaProgrammeVersionId).toBe("gta-v2");
  });

  it("keeps the previous membership queryable after transfer", () => {
    const current: AdminTeachingGroupMembership = {
      id: "mem-a",
      enrolmentId: "enr-1",
      teachingGroupId: "tg-a",
      joinedAt: null,
      leftAt: null,
      isCurrent: true,
      source: "legacy_backfill",
      recordedAt: "2026-08-01T00:00:00.000Z",
      actorName: "",
      notes: "",
    };
    const plan = planTeachingGroupMembershipChange({
      enrolment: enrolment({ id: "enr-1", teachingGroupId: "tg-a" }),
      group: group({ id: "tg-b" }),
      currentMembership: current,
      enrolments: [],
      nowIso: "2026-08-18T12:00:00.000Z",
    });
    expect("error" in plan).toBe(false);
    if ("error" in plan) return;
    expect(plan.closeMembershipId).toBe("mem-a");
    expect(plan.newMembership?.teachingGroupId).toBe("tg-b");
  });
});

describe("Add Apprentice group filtering", () => {
  it("only offers teaching groups that match the pinned GTA Programme Version", () => {
    const groups = [
      group({ id: "match", gtaProgrammeVersionId: "gta-v2" }),
      group({ id: "other", gtaProgrammeVersionId: "gta-v3" }),
      group({ id: "inactive", gtaProgrammeVersionId: "gta-v2", status: "inactive" }),
      group({
        id: "review",
        gtaProgrammeVersionId: "gta-v2",
        versionReviewRequired: true,
      }),
    ];
    expect(
      teachingGroupsCompatibleWithPin(groups, "gta-v2").map((row) => row.id),
    ).toEqual(["match"]);
  });
});
