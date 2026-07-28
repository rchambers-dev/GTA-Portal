import { describe, expect, it } from "vitest";
import {
  calculatePlannedProgressPercent,
  calculateProgressFraming,
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
    expect(formatProgressVariance(framing.variancePercent)).toBe("10% behind plan");
  });
});
