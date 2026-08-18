import { describe, expect, it } from "vitest";
import { createCohortOps, type TeachingGroupInput } from "./cohort-ops";
import { applyMembershipPlanToList } from "./teaching-group-placement";
import type {
  AdminApprenticeEnrolment,
  AdminCohortRecord,
  AdminGtaProgrammeVersionOption,
  AdminTeachingGroupMembership,
  AdminTeachingGroupRecord,
} from "./types";

function cohort(id: string, startDate: string): AdminCohortRecord {
  return {
    id,
    name: `${id} intake`,
    programmeId: "prog-1",
    programmeName: "Autocare Technician Level 2",
    standardCode: "ST0499",
    standardVersion: "1.3",
    deliverySpine: "blocks",
    enrolmentOpensDate: "",
    startDate,
    expectedEndDate: "",
    teachingGroup: "",
    collegeDays: "",
    teacherNames: [],
    tutorName: "",
    status: "planned",
    notes: "",
    locked: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("create independent teaching group", () => {
  it("creates a teaching group with version, tutor and days and no cohort", async () => {
    const snap = {
      cohorts: [cohort("sep", "2026-09-01")],
      teachingGroups: [] as AdminTeachingGroupRecord[],
      teachingGroupMemberships: [] as AdminTeachingGroupMembership[],
      gtaProgrammeVersions: [] as AdminGtaProgrammeVersionOption[],
      cohortChangeLogs: [],
      enrolments: [] as AdminApprenticeEnrolment[],
    };
    const ops = createCohortOps({
      getSnapshot: () => snap,
      setSnapshot: (next) => {
        Object.assign(snap, next);
      },
      emit: () => undefined,
      ensureHydrated: () => undefined,
      id: (prefix) => `${prefix}-1`,
      updateEnrolment: async () => null,
    });

    const input: TeachingGroupInput = {
      gtaProgrammeVersionId: "gta-v2",
      tutorName: "Mike Hepworth",
      name: "Monday Autocare Group",
      collegeDays: "Monday",
      capacity: 9,
    };
    const created = await ops.createTeachingGroup(input);
    expect(created.cohortId).toBeNull();
    expect(created.gtaProgrammeVersionId).toBe("gta-v2");
    expect(created.tutorName).toBe("Mike Hepworth");
    expect(created.collegeDays).toBe("Monday");
    expect(created.status).toBe("active");
    expect(created.versionReviewRequired).toBe(false);
  });
});

describe("membership plan application", () => {
  it("keeps historic memberships when applying a transfer plan", () => {
    const historic: AdminTeachingGroupMembership = {
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
    const next = applyMembershipPlanToList({
      memberships: [historic],
      plan: {
        enrolmentPatch: {
          teachingGroupId: "tg-b",
          tutorName: "Tutor",
          collegeDays: "Wednesday",
        },
        closeMembershipId: "mem-a",
        newMembership: {
          enrolmentId: "enr-1",
          teachingGroupId: "tg-b",
          joinedAt: "2026-08-18T12:00:00.000Z",
          leftAt: null,
          isCurrent: true,
          source: "staff",
          recordedAt: "2026-08-18T12:00:00.000Z",
          actorName: "Admin",
          notes: "",
        },
      },
      newId: "mem-b",
      leftAt: "2026-08-18T12:00:00.000Z",
    });
    const previous = next.find((row) => row.id === "mem-a");
    const current = next.find((row) => row.id === "mem-b");
    expect(previous?.isCurrent).toBe(false);
    expect(previous?.leftAt).toBe("2026-08-18T12:00:00.000Z");
    expect(current?.isCurrent).toBe(true);
    expect(current?.teachingGroupId).toBe("tg-b");
  });
});
