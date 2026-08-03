import { describe, expect, it } from "vitest";
import {
  calculatePlannedProgressPercent,
  calculateProgressFraming,
  formatProgressStatusLabel,
  formatProgressVariance,
} from "./progress-framing";

describe("progress framing", () => {
  it("returns 0 before start", () => {
    expect(
      calculatePlannedProgressPercent("2026-08-01", "2027-08-01", new Date("2026-07-01")),
    ).toBe(0);
  });

  it("derives planned percent from elapsed duration", () => {
    // 50 of 100 days elapsed → 50%
    expect(
      calculatePlannedProgressPercent("2026-01-01", "2026-04-11", new Date("2026-02-20")),
    ).toBe(50);
  });

  it("caps planned percent at 100 after planned end", () => {
    expect(
      calculatePlannedProgressPercent("2025-01-01", "2025-06-01", new Date("2026-01-01")),
    ).toBe(100);
  });

  it("computes negative variance as behind-plan slippage", () => {
    const framing = calculateProgressFraming({
      startDate: "2026-01-01",
      originalPlannedEndDate: "2026-04-11",
      actualProgressPercent: 40,
      asOfDate: new Date("2026-02-20"),
    });
    expect(framing.plannedProgressPercent).toBe(50);
    expect(framing.actualProgressPercent).toBe(40);
    expect(framing.variancePercent).toBe(-10);
    expect(formatProgressVariance(null)).toBe("Actual not entered");
    expect(formatProgressVariance(framing.variancePercent)).toBe("10% behind plan");
  });

  it("formats pre-start progress only before the start date", () => {
    const progress = formatProgressStatusLabel({
      programmeStatus: "pre_start",
      startDate: "2026-09-01",
      originalPlannedEndDate: "2028-09-01",
      actualProgressPercent: null,
      asOfDate: new Date("2026-08-02"),
    });
    expect(progress.badge).toBe("Pre-start");
    expect(progress.tone).toBe("neutral");
  });

  it("does not freeze progress as pre-start after the start date", () => {
    const progress = formatProgressStatusLabel({
      programmeStatus: "pending_start",
      startDate: "2025-01-06",
      originalPlannedEndDate: "2027-10-06",
      actualProgressPercent: null,
      asOfDate: new Date("2026-08-02"),
    });
    expect(progress.badge).toBe("Actual not entered");
    expect(progress.tone).toBe("monitoring");
  });
});
