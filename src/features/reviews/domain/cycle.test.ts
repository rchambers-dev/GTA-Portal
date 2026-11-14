import { describe, expect, it } from "vitest";
import { currentStepDetail, cycleDueChip, cycleStepFromStage, reviewCountLabel, stepTone, tutorDueBand } from "./cycle";
import { firstTutorFormGap, emptyTutorForm, otjTrack, tutorFill, tutorTargetDateError } from "./tutor-form-rules";

describe("review cycle steps", () => {
  it("maps pack stages onto the six assistant steps", () => {
    expect(cycleStepFromStage("with_tutor")).toBe("released");
    expect(cycleStepFromStage("to_book")).toBe("booking");
    expect(cycleStepFromStage("booked")).toBe("booked");
    expect(cycleStepFromStage("reviewed")).toBe("completed");
    expect(cycleStepFromStage("completed")).toBe("archived");
    expect(cycleStepFromStage(null)).toBe("waiting");
  });

  it("marks earlier steps done and a late current step overdue", () => {
    expect(stepTone("released", "booking", false)).toBe("done");
    expect(stepTone("booking", "booking", true)).toBe("late");
    expect(stepTone("booked", "booking", false)).toBe("idle");
    expect(currentStepDetail(true, -3)).toBe("Overdue · 3 days");
    expect(currentStepDetail(false, 4)).toBe("Left · 4 days");
    expect(reviewCountLabel(0)).toBe("No review yet");
    expect(reviewCountLabel(2)).toBe("2 reviews");
  });

  it("describes the next review date on the cycle chip", () => {
    expect(cycleDueChip({ today: "2026-11-13", dueOn: null, inBreak: false, overdueLabel: null })).toEqual({
      label: "No due date",
      tone: "neutral",
    });
    expect(cycleDueChip({ today: "2026-11-13", dueOn: "2026-11-13", inBreak: false, overdueLabel: null })).toEqual({
      label: "Due today",
      tone: "soon",
    });
    expect(cycleDueChip({ today: "2026-11-13", dueOn: "2026-11-14", inBreak: false, overdueLabel: null })).toEqual({
      label: "Due tomorrow",
      tone: "soon",
    });
    expect(cycleDueChip({ today: "2026-11-13", dueOn: "2026-11-18", inBreak: false, overdueLabel: null })).toEqual({
      label: "Due in 5 days · 18 Nov",
      tone: "soon",
    });
    expect(cycleDueChip({ today: "2026-11-13", dueOn: "2026-11-27", inBreak: false, overdueLabel: null })).toEqual({
      label: "Due in 2 weeks · 27 Nov",
      tone: "soon",
    });
    expect(cycleDueChip({ today: "2026-11-13", dueOn: "2026-12-04", inBreak: false, overdueLabel: null })).toEqual({
      label: "Due in 3 weeks · 4 Dec",
      tone: "neutral",
    });
    expect(
      cycleDueChip({
        today: "2026-11-13",
        dueOn: "2026-10-01",
        inBreak: false,
        overdueLabel: "Overdue · 4 weeks 2 days",
      }),
    ).toEqual({ label: "Overdue · 4 weeks 2 days", tone: "overdue" });
  });

  it("opens the tutor window two weeks before the due week and groups a returned pack as sent back", () => {
    const open = tutorDueBand({
      today: "2026-11-13",
      plannedOn: "2026-11-16",
      intervalWeeks: 10,
      stage: "with_tutor",
      inBreak: false,
    });
    expect(open.band).toBe("need-doing");
    const returned = tutorDueBand({
      today: "2026-11-13",
      plannedOn: "2026-11-16",
      intervalWeeks: 10,
      stage: "to_book",
      inBreak: false,
    });
    expect(returned.band).toBe("sent-back");
  });
});

describe("tutor form validation", () => {
  const today = "2026-11-13";

  it("asks for the previous summary first, then a current target", () => {
    const form = emptyTutorForm();
    expect(firstTutorFormGap(form, today)?.message).toBe("Write the tutor summary of the previous review.");
    form.previousSummary = "Last time they were settling in.";
    expect(firstTutorFormGap(form, today)?.message).toBe("Add at least one current target.");
  });

  it("rejects a target date in the past or beyond 10 weeks", () => {
    expect(tutorTargetDateError("", today)).toBe("Choose a target date.");
    expect(tutorTargetDateError("2026-11-01", today)).toBe("Target dates cannot be in the past.");
    expect(tutorTargetDateError("2027-02-01", today)).toMatch(/10 weeks/);
    expect(tutorTargetDateError("2026-12-01", today)).toBe("");
  });

  it("still requires a red, amber or green mark after an N/A comment", () => {
    const form = emptyTutorForm();
    form.previousSummary = "Summary";
    form.newTargets[0] = {
      ...form.newTargets[0],
      action: "Finish unit 1",
      owner: "Apprentice",
      measure: "Unit signed off",
      targetDate: "2026-12-01",
    };
    const maths = form.progress.find((row) => row.area === "english_maths");
    if (maths) {
      maths.evidence = "Not applicable.";
      maths.rag = "na";
    }
    form.progress.forEach((row) => {
      if (row.area !== "english_maths" && row.area !== "off_the_job") {
        row.evidence = "On track from the work I have seen.";
        row.rag = "green";
      }
      if (row.area === "off_the_job") {
        row.evidence = "Hours logged.";
        row.targetHours = "100";
        row.currentHours = "100";
      }
    });
    expect(firstTutorFormGap(form, today)?.message).toBe("Mark English and maths as red, amber or green.");
  });

  it("reports how much of a saved form is still empty", () => {
    const empty = tutorFill(emptyTutorForm(), today);
    expect(empty.remaining).toBe(100);
    expect(empty.percent).toBe(0);
    expect(empty.started).toBe(false);
    const started = emptyTutorForm();
    started.previousSummary = "Last time they were settling in.";
    const partial = tutorFill(started, today);
    expect(partial.started).toBe(true);
    expect(partial.percent).toBeGreaterThan(0);
    expect(partial.percent).toBeLessThan(100);
    expect(tutorFill(started, today, 10, true).percent).toBe(100);
  });

  it("colours off-the-job hours on the assistant bands", () => {
    expect(otjTrack("", "").label).toBe("Waiting for hours");
    expect(otjTrack("100", "70").rag).toBe("red");
    expect(otjTrack("100", "90").rag).toBe("amber");
    expect(otjTrack("100", "100").rag).toBe("green");
    expect(otjTrack("100", "130").rag).toBe("blue");
  });
});
