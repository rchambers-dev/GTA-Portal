import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECKLIST_EMPTY_NOTE,
  addCalendarDays,
  canManageApprenticeProgramme,
  dateChangeExplanation,
  dateChangeReasonLabel,
  explainProgrammeError,
  isPlannedDateOverdue,
  planCourseDateUpdate,
  programmeIdentity,
  returnFromBreakReady,
  validateBreakStart,
  validateCourseDateSubmission,
  validateDateChangeRequest,
  type CourseDateSubmission,
  type EffectiveDates,
  type StoredDates,
} from "./apprentice-programme";
import type { ApprenticeLearnerRecord } from "./apprentice-tutor";

const reasonId = "44444444-4444-4444-8444-444444444444";

function actor(baseRole: string, permissions: string[]) {
  return { account: { baseRole }, permissions };
}

function stored(overrides: Partial<StoredDates> = {}): StoredDates {
  return {
    courseStart: "2025-09-01",
    plannedCourseEnd: null,
    actualCourseEnd: null,
    plannedGateway1: null,
    actualGateway1: null,
    plannedGateway2: null,
    actualGateway2: null,
    plannedEpa: null,
    actualEpa: null,
    ...overrides,
  };
}

function submission(overrides: Partial<CourseDateSubmission> = {}): CourseDateSubmission {
  return {
    gtaId: "GTA-000002",
    courseStart: "2025-09-01",
    actualCourseEnd: null,
    actualGateway1: null,
    actualGateway2: null,
    actualEpa: null,
    ...overrides,
  };
}

const unchangedEffective: EffectiveDates = {
  courseEnd: null,
  gateway1: null,
  gateway2: null,
  epa: null,
  originalCourseEnd: null,
  originalGateway1: null,
  originalGateway2: null,
  originalEpa: null,
  courseEndChanged: false,
  gateway1Changed: false,
  gateway2Changed: false,
  epaChanged: false,
};

describe("apprentice programme rules", () => {
  it("lets Administrator and Management edit, and keeps Tutor read-only", () => {
    expect(canManageApprenticeProgramme(actor("Administrator", ["admin.records.manage"]))).toBe(true);
    expect(canManageApprenticeProgramme(actor("Management", ["admin.records.manage"]))).toBe(true);
    expect(canManageApprenticeProgramme(actor("Tutor", ["admin.records.manage"]))).toBe(false);
    expect(canManageApprenticeProgramme(actor("Tutor", ["staff.workspace.view"]))).toBe(false);
    expect(canManageApprenticeProgramme(null)).toBe(false);
  });

  it("shows the programme name and standard code separately", () => {
    const apprentice: ApprenticeLearnerRecord = {
      gtaId: "GTA-000002",
      name: "Jack Elliot",
      programmeLabel: "Autocare L2 (ST0499)",
      programmeName: "Autocare Level 2",
      standardCode: "ST0499",
      status: "in_learning",
      statusLabel: "In learning",
      email: null,
    };
    expect(programmeIdentity(apprentice)).toEqual({
      name: "Autocare Level 2",
      standardCode: "ST0499",
    });
    expect(programmeIdentity({ ...apprentice, programmeName: null, standardCode: null })).toEqual({
      name: "Autocare L2 (ST0499)",
      standardCode: "Not recorded",
    });
  });

  it("adds the generated 10-week planned return", () => {
    expect(addCalendarDays("2026-01-01", 70)).toBe("2026-03-12");
    expect(addCalendarDays("2024-02-27", 70)).toBe("2024-05-07");
  });

  it("flags a planned date that has passed with no actual date", () => {
    expect(isPlannedDateOverdue("2026-03-01", null, "2026-11-09")).toBe(true);
    expect(isPlannedDateOverdue("2026-11-09", null, "2026-11-09")).toBe(false);
    expect(isPlannedDateOverdue("2027-06-01", null, "2026-11-09")).toBe(false);
    expect(isPlannedDateOverdue("2026-03-01", "2026-03-02", "2026-11-09")).toBe(false);
    expect(isPlannedDateOverdue(null, null, "2026-11-09")).toBe(false);
  });

  it("hides a safeguarding explanation from the text tutors receive", () => {
    expect(
      dateChangeReasonLabel({
        reason: "Safeguarding",
        isSafeguarding: true,
        explanation: null,
      }),
    ).toBe("Safeguarding");
    expect(
      dateChangeExplanation({ isSafeguarding: true, explanation: null }),
    ).toBeNull();
    expect(
      dateChangeExplanation({
        isSafeguarding: true,
        explanation: "The learner is being supported by the safeguarding team.",
      }),
    ).toBe("The learner is being supported by the safeguarding team.");
  });

  it("sets an empty planned date directly and refuses to edit one that is already set", () => {
    const initial = planCourseDateUpdate(
      stored(),
      unchangedEffective,
      submission({ plannedGateway2: "2026-04-01", courseStart: "2025-09-01" }),
    );
    expect(initial.ok).toBe(true);
    if (initial.ok) {
      expect(initial.value.initialPlanned).toEqual([
        { column: "planned_gateway_2", value: "2026-04-01", dateType: "gateway_2" },
      ]);
      expect(initial.value.direct).toEqual({});
    }

    const locked = planCourseDateUpdate(
      stored({ plannedCourseEnd: "2026-07-01" }),
      { ...unchangedEffective, courseEnd: "2027-06-01", originalCourseEnd: "2026-07-01", courseEndChanged: true },
      submission({ plannedCourseEnd: "2028-01-01" }),
    );
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.formError).toMatch(/date change request/);
  });

  it("rejects a planned course end before the course start", () => {
    const parsed = validateCourseDateSubmission({
      gtaId: "GTA-000002",
      courseStart: "2026-09-01",
      actualCourseEnd: "",
      actualGateway1: "",
      actualGateway2: "",
      actualEpa: "",
      plannedCourseEnd: "2026-01-01",
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const plan = planCourseDateUpdate(stored({ courseStart: null }), unchangedEffective, parsed.value);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.formError).toMatch(/on or after the course start/);
  });

  it("requires a reason and explanation, and only sends paperwork for course end", () => {
    const missing = validateDateChangeRequest({
      gtaId: "GTA-000002",
      dateType: "course_end",
      newDate: "2027-01-01",
      reasonId: "",
      explanation: "   ",
      extensionPaperwork: true,
    });
    expect(missing.ok).toBe(false);

    const gateway = validateDateChangeRequest({
      gtaId: "GTA-000002",
      dateType: "gateway_1",
      newDate: "2027-01-01",
      reasonId,
      explanation: " Not ready yet ",
      extensionPaperwork: true,
    });
    expect(gateway.ok).toBe(true);
    if (gateway.ok) {
      expect(gateway.value.extensionPaperwork).toBe(false);
      expect(gateway.value.explanation).toBe("Not ready yet");
    }
  });

  it("requires a break reason, explanation, and start date", () => {
    expect(
      validateBreakStart({
        gtaId: "GTA-000002",
        reasonId,
        explanation: "Recovering after surgery.",
        startDate: "2026-11-09",
      }).ok,
    ).toBe(true);
    const missing = validateBreakStart({
      gtaId: "GTA-000002",
      reasonId: "",
      explanation: "",
      startDate: "",
    });
    expect(missing.ok).toBe(false);
  });

  it("allows return with an empty checklist once sign-off is done", () => {
    expect(returnFromBreakReady({ signedOff: false, checks: [] }).ready).toBe(false);
    expect(returnFromBreakReady({ signedOff: true, checks: [] })).toEqual({
      ready: true,
      reason: null,
    });
    expect(
      returnFromBreakReady({
        signedOff: true,
        checks: [{ passed: false }],
      }).ready,
    ).toBe(false);
    expect(CHECKLIST_EMPTY_NOTE).toMatch(/no checklist items/i);
  });

  it("turns the paperwork database error into a clear message", () => {
    expect(
      explainProgrammeError({
        code: "23514",
        message: "Extension paperwork must be ticked before a course end change can be approved",
      }),
    ).toMatch(/employer, the learner and the tutor/);
    expect(
      explainProgrammeError({
        code: "42501",
        message: "Administrator or Management role required",
      }),
    ).toMatch(/Administrator and Management/);
    expect(
      explainProgrammeError({
        code: "23514",
        message: "Every active return-to-learning checklist item must be passed",
      }),
    ).toMatch(/checklist item/);
  });

  it("loads breaks only for people who can manage the programme", () => {
    const root = process.cwd();
    const repository = readFileSync(
      path.join(root, "src/features/administration/domain/apprentice-programme-repository.ts"),
      "utf8",
    );
    const screen = readFileSync(
      path.join(root, "src/features/administration/screens/ApprenticeLearnerScreen.tsx"),
      "utf8",
    );
    const actions = readFileSync(
      path.join(root, "src/features/administration/screens/apprentice-programme-actions.ts"),
      "utf8",
    );
    expect(repository).toContain("options.canManage");
    expect(repository).toContain("readBreaks");
    expect(repository).toMatch(/const breaks = options\.canManage/);
    expect(repository).not.toContain("createSupabaseAdminClient");
    expect(screen).toContain("canManageApprenticeProgramme");
    expect(screen).toContain("loadApprenticeProgramme(gtaId, { canManage: canManageProgramme })");
    expect(actions).toContain("canManageApprenticeProgramme");
    expect(actions).toContain("startBreakInLearningAction");
    expect(actions).not.toContain("createSupabaseAdminClient");
  });
});
