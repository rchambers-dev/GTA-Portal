import { describe, expect, it } from "vitest";
import {
  calculateProgrammeWeek,
  calculateProgrammeYear,
  describeProgrammeTiming,
  formatTimeOnProgramme,
} from "./programme-week";

describe("programme week timing", () => {
  it("returns null before the start date", () => {
    expect(
      calculateProgrammeWeek("2026-09-01", new Date("2026-08-15T12:00:00Z")),
    ).toBeNull();
  });

  it("counts week 1 from the start day", () => {
    expect(
      calculateProgrammeWeek("2026-01-05", new Date("2026-01-05T12:00:00Z")),
    ).toBe(1);
    expect(
      calculateProgrammeWeek("2026-01-05", new Date("2026-01-11T12:00:00Z")),
    ).toBe(1);
    expect(
      calculateProgrammeWeek("2026-01-05", new Date("2026-01-12T12:00:00Z")),
    ).toBe(2);
  });

  it("maps weeks into programme years", () => {
    expect(calculateProgrammeYear(1)).toBe(1);
    expect(calculateProgrammeYear(52)).toBe(1);
    expect(calculateProgrammeYear(53)).toBe(2);
    expect(calculateProgrammeYear(105)).toBe(3);
  });

  it("formats human time on programme", () => {
    expect(
      formatTimeOnProgramme("2026-01-01", new Date("2026-01-01T12:00:00Z")),
    ).toBe("Started today");
    expect(
      formatTimeOnProgramme("2026-01-01", new Date("2026-01-22T12:00:00Z")),
    ).toBe("3 weeks");
    expect(
      formatTimeOnProgramme("2024-01-01", new Date("2025-08-01T12:00:00Z")),
    ).toBe("1 year 6 months");
  });

  it("describes live week and duration together", () => {
    const timing = describeProgrammeTiming(
      "2025-01-06",
      new Date("2026-08-03T12:00:00Z"),
    );
    expect(timing.hasStarted).toBe(true);
    expect(timing.week).toBe(83);
    expect(timing.year).toBe(2);
    expect(timing.weekLabel).toBe("Y2 · Week 83");
    expect(timing.timeOnProgramme).toBe("1 year 6 months");
  });
});
