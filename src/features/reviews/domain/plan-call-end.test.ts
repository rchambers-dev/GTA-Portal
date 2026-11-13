import { describe, expect, it } from "vitest";
import { emptyPackedDay, type RouteSettings } from "./plan-route";
import { callEndMinutes, heldPastCallEnd, type CallEndStop } from "./plan-call-end";

const settings: RouteSettings = {
  startMinutes: 10 * 60,
  lunchStart: 13 * 60,
  lunchEnd: 13 * 60 + 30,
  returnBy: 16 * 60 + 45,
  stayMinutes: 30,
  callMinutes: 60,
};

function stop(partial: Partial<CallEndStop> & Pick<CallEndStop, "verified">): CallEndStop {
  return {
    completed: false,
    accepted: false,
    appointmentOn: null,
    ...partial,
  };
}

describe("call end", () => {
  it("is the day's start time, and matches the route's call end", () => {
    expect(callEndMinutes({ startMinutes: 10 * 60, lunchStart: 13 * 60, lunchEnd: 13 * 60 + 30, callAnchorMinutes: null })).toBe(10 * 60);
    expect(emptyPackedDay(settings).callEnd).toBe(10 * 60);
    expect(callEndMinutes({ startMinutes: 10 * 60, lunchStart: 13 * 60, lunchEnd: 13 * 60 + 30, callAnchorMinutes: 9 * 60 })).toBe(9 * 60);
    expect(callEndMinutes({ startMinutes: 13 * 60 + 10, lunchStart: 13 * 60, lunchEnd: 14 * 60, callAnchorMinutes: null })).toBe(14 * 60);
  });
});

describe("unverified drop", () => {
  const today = "2026-11-13";
  const callEnd = 10 * 60;

  it("keeps every stop before call end", () => {
    const unverified = stop({ verified: false });
    expect(heldPastCallEnd(unverified, { date: today, today, nowMinutes: 9 * 60 + 59, callEnd })).toBe(false);
  });

  it("drops today's unverified unbooked stop at call end, and keeps verified, booked, completed and accepted stops", () => {
    const when = { date: today, today, nowMinutes: callEnd, callEnd };
    expect(heldPastCallEnd(stop({ verified: false }), when)).toBe(true);
    expect(heldPastCallEnd(stop({ verified: true }), when)).toBe(false);
    expect(heldPastCallEnd(stop({ verified: false, appointmentOn: today }), when)).toBe(false);
    expect(heldPastCallEnd(stop({ verified: false, appointmentOn: "2026-11-16" }), when)).toBe(true);
    expect(heldPastCallEnd(stop({ verified: false, completed: true }), when)).toBe(false);
    expect(heldPastCallEnd(stop({ verified: false, accepted: true }), when)).toBe(false);
  });

  it("does not drop a stop on any other day", () => {
    expect(heldPastCallEnd(stop({ verified: false }), { date: "2026-11-12", today, nowMinutes: 15 * 60, callEnd })).toBe(false);
    expect(heldPastCallEnd(stop({ verified: false }), { date: "2026-11-16", today, nowMinutes: 15 * 60, callEnd })).toBe(false);
  });
});
