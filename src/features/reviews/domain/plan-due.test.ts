import { describe, expect, it } from "vitest";
import { formatWeeksAndDays, reviewDueLabel } from "./plan-due";

describe("plan due pill", () => {
  it("formats overdue weeks and days the way the assistant does", () => {
    expect(formatWeeksAndDays(-97)).toBe("13 weeks 6 days");
    expect(formatWeeksAndDays(-7)).toBe("1 week");
    expect(formatWeeksAndDays(-1)).toBe("1 day");
  });

  it("marks the week that contains the next review", () => {
    expect(
      reviewDueLabel({ today: "2026-11-12", nextDate: "2026-08-05", intervalWeeks: 5 }),
    ).toMatchObject({ state: "overdue", label: "Overdue · 13 weeks 4 days", nextDate: "2026-08-05" });
    expect(
      reviewDueLabel({ today: "2026-11-12", nextDate: "2026-11-13", intervalWeeks: 10 }),
    ).toMatchObject({ state: "due-soon", label: "Due this week" });
    expect(
      reviewDueLabel({ today: "2026-11-12", nextDate: "2027-01-21", intervalWeeks: 10 }),
    ).toMatchObject({ state: "ok", label: "Within 10 weeks" });
    expect(reviewDueLabel({ today: "2026-11-12", nextDate: null, intervalWeeks: 10 }).label).toBe(
      "Not set",
    );
  });
});
