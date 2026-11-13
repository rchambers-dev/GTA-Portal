import { describe, expect, it } from "vitest";
import { fittingArrivals, rebookDayChoice, type RebookClock } from "./rebook-slots";

const clock: RebookClock = {
  startMinutes: 10 * 60,
  lunchStart: 12 * 60 + 30,
  lunchEnd: 13 * 60,
  returnBy: 16 * 60 + 45,
  stayMinutes: 30,
  earliestLeave: 10 * 60,
};

describe("rebook days", () => {
  it("strikes only the learner's release day and greys the past without a strike", () => {
    const pastThursday = rebookDayChoice({
      date: "2026-11-12",
      today: "2026-11-13",
      missedDate: "2026-11-13",
      releaseDay: "Thursday",
      nowMinutes: 9 * 60,
      skipToday: true,
      returnBy: clock.returnBy,
      accepted: false,
      completed: false,
    });
    const futureThursday = rebookDayChoice({
      date: "2026-11-19",
      today: "2026-11-13",
      missedDate: "2026-11-13",
      releaseDay: "Thursday",
      nowMinutes: 9 * 60,
      skipToday: true,
      returnBy: clock.returnBy,
      accepted: false,
      completed: false,
    });
    const monday = rebookDayChoice({
      date: "2026-11-16",
      today: "2026-11-13",
      missedDate: "2026-11-13",
      releaseDay: "Thursday",
      nowMinutes: 9 * 60,
      skipToday: true,
      returnBy: clock.returnBy,
      accepted: false,
      completed: false,
    });
    expect(pastThursday).toEqual({ bookable: false, struck: false });
    expect(futureThursday).toEqual({ bookable: false, struck: true });
    expect(monday).toEqual({ bookable: true, struck: false });
  });
});

describe("fitting arrivals", () => {
  it("skips lunch and a time that overlaps a stop, and keeps the earliest drive-based arrival", () => {
    const drive = (from: string, to: string) => {
      if (from === to) return 0;
      if (from === "office" && to === "learner") return 65;
      if (from === "learner" && to === "office") return 40;
      if (from === "other" && to === "learner") return 20;
      if (from === "learner" && to === "other") return 20;
      return 30;
    };
    const slots = fittingArrivals({
      learnerId: "learner",
      officeId: "office",
      clock,
      existing: [{ id: "other", arrive: 10 * 60, leave: 10 * 60 + 30 }],
      driveMinutes: drive,
    });
    expect(slots[0]).toBe(10 * 60 + 50);
    expect(slots.some((minute) => minute >= 12 * 60 + 30 && minute < 13 * 60)).toBe(false);
    expect(slots.some((minute) => minute < 10 * 60 + 50)).toBe(false);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
  });
});
