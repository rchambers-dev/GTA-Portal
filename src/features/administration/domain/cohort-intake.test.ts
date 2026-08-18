import { describe, expect, it } from "vitest";
import { calculateProgrammeWeek } from "@/features/apprentice-lifecycle/domain/programme-week";
import {
  isCohortStarted,
  COHORT_VERSION_FROZEN_MESSAGE,
} from "./cohort-lifecycle";
import {
  buildCohortName,
  cohortAssignmentPatch,
  hasApprenticeshipStarted,
  suggestCohortForLearnerStart,
} from "./cohort-intake";
import {
  enrolmentOpensFromIntakeStart,
  plannedDatesFromStart,
} from "./programme-duration";
import { teachingGroupFieldsForEnrolment } from "./cohort-ops";

type TestCohort = {
  id: string;
  standardCode: string;
  standardVersion: string;
  startDate: string;
  status: "planned" | "active" | "completed";
};

function cohort(partial: Partial<TestCohort> & Pick<TestCohort, "id" | "startDate">): TestCohort {
  return {
    standardCode: "ST0499",
    standardVersion: "1.3",
    status: "planned",
    ...partial,
  };
}

describe("enrolment opens", () => {
  it("is one calendar month before intake start", () => {
    expect(enrolmentOpensFromIntakeStart("2026-09-01")).toBe("2026-08-01");
    expect(enrolmentOpensFromIntakeStart("2026-01-01")).toBe("2025-12-01");
    expect(enrolmentOpensFromIntakeStart("2026-03-31")).toBe("2026-02-28");
  });
});

describe("cohort naming", () => {
  it("names an intake from programme, product and intake month — not expected end", () => {
    expect(
      buildCohortName({
        programmeName: "Autocare Technician Level 2",
        standardCode: "ST0499",
        standardVersion: "1.3",
        deliverySpine: "blocks",
        startDate: "2026-09-01",
      }),
    ).toBe("Autocare Technician L2 (ST0499) · v1.3 · Blocks · Sept 2026 Intake");
  });
});

describe("suggest cohort from learner start", () => {
  const september = cohort({ id: "sep", startDate: "2026-09-01" });
  const january = cohort({ id: "jan", startDate: "2027-01-01" });

  it("places a mid-window start in the earlier intake, not the upcoming one", () => {
    const suggestion = suggestCohortForLearnerStart({
      cohorts: [september, january],
      standardCode: "ST0499",
      apprenticeshipStartDate: "2026-10-20",
    });
    expect(suggestion.reason).toBe("matched");
    expect(suggestion.cohort?.id).toBe("sep");
  });

  it("places a January start in the January intake", () => {
    const suggestion = suggestCohortForLearnerStart({
      cohorts: [september, january],
      standardCode: "ST0499",
      apprenticeshipStartDate: "2027-01-12",
    });
    expect(suggestion.cohort?.id).toBe("jan");
  });

  it("lets a future starter join September without using intake start as their date", () => {
    const suggestion = suggestCohortForLearnerStart({
      cohorts: [september],
      standardCode: "ST0499",
      apprenticeshipStartDate: "2026-09-14",
    });
    expect(suggestion.cohort?.id).toBe("sep");
    expect(suggestion.cohort?.startDate).not.toBe("2026-09-14");
  });

  it("does not force a pre-intake start into the upcoming September intake", () => {
    const suggestion = suggestCohortForLearnerStart({
      cohorts: [september],
      standardCode: "ST0499",
      apprenticeshipStartDate: "2026-08-20",
    });
    expect(suggestion.reason).toBe("review");
    expect(suggestion.cohort).toBeNull();
  });

  it("uses the previous compatible intake when one exists", () => {
    const april = cohort({ id: "apr", startDate: "2026-04-01", status: "active" });
    const suggestion = suggestCohortForLearnerStart({
      cohorts: [april, september],
      standardCode: "ST0499",
      apprenticeshipStartDate: "2026-08-20",
    });
    expect(suggestion.cohort?.id).toBe("apr");
  });

  it("ignores completed intakes when suggesting for a new starter", () => {
    const april = cohort({
      id: "apr-done",
      startDate: "2026-04-01",
      status: "completed",
    });
    const suggestion = suggestCohortForLearnerStart({
      cohorts: [april, september],
      standardCode: "ST0499",
      apprenticeshipStartDate: "2026-08-20",
    });
    expect(suggestion.reason).toBe("review");
    expect(suggestion.cohort).toBeNull();
  });

  it("does not use a different standard", () => {
    const hv = cohort({
      id: "hv",
      startDate: "2026-09-01",
      standardCode: "ST0068",
    });
    const suggestion = suggestCohortForLearnerStart({
      cohorts: [hv, september],
      standardCode: "ST0499",
      apprenticeshipStartDate: "2026-09-14",
    });
    expect(suggestion.cohort?.id).toBe("sep");
  });
});

describe("learner timeline vs cohort", () => {
  it("keeps two learners in the same intake on different start dates", () => {
    const intakeStart = "2026-09-01";
    const learnerA = "2026-09-03";
    const learnerB = "2026-10-17";
    expect(learnerA).not.toBe(intakeStart);
    expect(learnerB).not.toBe(intakeStart);
    expect(learnerA).not.toBe(learnerB);
    expect(calculateProgrammeWeek(learnerA, "2026-10-17")).not.toBe(
      calculateProgrammeWeek(learnerB, "2026-10-17"),
    );
  });

  it("does not copy cohort fields onto the learner timeline when assigning a cohort", () => {
    const patch = cohortAssignmentPatch({
      id: "sep",
      programmeId: "prog-1",
      programmeName: "Autocare",
      standardCode: "ST0499",
    });
    expect(patch).toEqual({
      cohortId: "sep",
      programmeName: "Autocare",
      standardCode: "ST0499",
    });
    expect(patch).not.toHaveProperty("startDate");
    expect(patch).not.toHaveProperty("originalPlannedEndDate");
    expect(patch).not.toHaveProperty("programmeWeek");
    expect(patch).not.toHaveProperty("programmeYear");
    expect(patch).not.toHaveProperty("tutorName");
    expect(patch).not.toHaveProperty("collegeDays");
  });

  it("calculates planned end from the learner start, not intake start", () => {
    const fromLearner = plannedDatesFromStart("2026-10-17", 30);
    const fromIntake = plannedDatesFromStart("2026-09-01", 30);
    expect(fromLearner.apprenticeshipEndDate).toBeTruthy();
    expect(fromLearner.apprenticeshipEndDate).not.toBe(
      fromIntake.apprenticeshipEndDate,
    );
  });

  it("derives programme week from the individual start date", () => {
    expect(calculateProgrammeWeek("2026-09-03", "2026-09-03")).toBe(1);
    expect(calculateProgrammeWeek("2026-10-17", "2026-09-03")).toBeNull();
    expect(calculateProgrammeWeek("2026-10-17", "2026-10-17")).toBe(1);
  });

  it("treats a future start as not yet begun", () => {
    expect(hasApprenticeshipStarted("2026-09-14", "2026-08-15")).toBe(false);
    expect(hasApprenticeshipStarted("2026-08-01", "2026-08-15")).toBe(true);
  });
});

describe("Skills England version lock", () => {
  it("freezes the product once the intake has started", () => {
    expect(
      isCohortStarted({ status: "planned", startDate: "2026-09-01" }, "2026-09-01"),
    ).toBe(true);
    expect(
      isCohortStarted({ status: "planned", startDate: "2026-09-01" }, "2026-08-15"),
    ).toBe(false);
    expect(
      isCohortStarted({ status: "active", startDate: "2027-01-01" }, "2026-08-15"),
    ).toBe(true);
    expect(COHORT_VERSION_FROZEN_MESSAGE).toMatch(/cannot change/i);
  });
});

describe("teaching group placement fields", () => {
  it("copies tutor and days from the group and does not rewrite cohort", () => {
    const patch = teachingGroupFieldsForEnrolment({
      id: "tg-1",
      tutorName: "Alex Tutor",
      collegeDays: "Monday",
    });
    expect(patch).toEqual({
      teachingGroupId: "tg-1",
      tutorName: "Alex Tutor",
      collegeDays: "Monday",
    });
    expect(patch).not.toHaveProperty("cohortId");
    expect(patch).not.toHaveProperty("startDate");
  });
});
