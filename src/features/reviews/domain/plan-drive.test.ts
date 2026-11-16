import { describe, expect, it } from "vitest";
import { stopTimeIsHeld } from "./plan-drive";

describe("which stop times Fill day may move", () => {
  it("keeps locked, verified and booked stops, and retimes the rest", () => {
    const free = { verified: false, locked: false, appointmentOn: null };
    expect(stopTimeIsHeld(free)).toBe(false);
    expect(stopTimeIsHeld({ ...free, verified: true })).toBe(true);
    expect(stopTimeIsHeld({ ...free, locked: true })).toBe(true);
    expect(stopTimeIsHeld({ ...free, booked: true })).toBe(true);
    expect(stopTimeIsHeld({ ...free, appointmentOn: "2026-11-16" })).toBe(true);
  });
});
