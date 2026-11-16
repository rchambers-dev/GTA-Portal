import { describe, expect, it } from "vitest";
import {
  canAllocate,
  canCountStart,
  interviewEligible,
  nextInterviewAttempt,
  reviewDueOn,
  seatTaken,
  stage2Unlocked,
} from "./rules";

describe("candidate rules", () => {
  it("counts review due from the original first contact", () => {
    expect(reviewDueOn("2026-03-03", "responsive")).toBe("2027-03-03");
    expect(reviewDueOn("2026-03-03", "unresponsive")).toBe("2026-06-03");
    expect(reviewDueOn("2026-03-03", "responsive")).toBe("2027-03-03");
  });

  it("requires both maths and english before an interview", () => {
    expect(interviewEligible(true, false)).toBe(false);
    expect(interviewEligible(true, true)).toBe(true);
  });

  it("locks stage 2 until the employer is confirmed and approved", () => {
    expect(stage2Unlocked(true, false)).toBe(false);
    expect(stage2Unlocked(false, true)).toBe(false);
    expect(stage2Unlocked(true, true)).toBe(true);
  });

  it("allows three attempts, a six-month wait, then one final attempt", () => {
    expect(nextInterviewAttempt([], "2026-11-16", false)).toEqual({ ok: true, attempt: 1, final: false });
    expect(nextInterviewAttempt([{ actualOn: "2026-09-01" }, { actualOn: "2026-10-01" }], "2026-11-16", false)).toEqual({
      ok: true,
      attempt: 3,
      final: false,
    });
    const blocked = nextInterviewAttempt(
      [{ actualOn: "2026-01-05" }, { actualOn: "2026-02-02" }, { actualOn: "2026-03-02" }],
      "2026-06-01",
      false,
    );
    expect(blocked.ok).toBe(false);
    expect(nextInterviewAttempt(
      [{ actualOn: "2026-01-05" }, { actualOn: "2026-02-02" }, { actualOn: "2026-03-02" }],
      "2026-09-07",
      false,
    )).toEqual({ ok: true, attempt: 4, final: true });
    expect(nextInterviewAttempt([], "2026-11-16", true).ok).toBe(false);
  });

  it("frees a cancelled place only when that is chosen", () => {
    expect(seatTaken("cancelled", false)).toBe(true);
    expect(seatTaken("cancelled", true)).toBe(false);
    expect(seatTaken("attended", false)).toBe(true);
  });

  it("refuses overallocation and a second start", () => {
    expect(canAllocate({ employerConfirmed: true, stage2Approved: true, taken: 2, places: 2, status: "open" }).ok).toBe(false);
    expect(canAllocate({ employerConfirmed: false, stage2Approved: true, taken: 0, places: 2, status: "open" }).ok).toBe(false);
    expect(canAllocate({ employerConfirmed: true, stage2Approved: true, taken: 1, places: 2, status: "open" }).ok).toBe(true);
    expect(canCountStart(false)).toBe(true);
    expect(canCountStart(true)).toBe(false);
  });
});
