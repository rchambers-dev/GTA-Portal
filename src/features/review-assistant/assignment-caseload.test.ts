import { describe, expect, it } from "vitest";
import { assignmentGrantsCaseload } from "./portal-roster";

const now = new Date("2026-11-08T12:00:00.000Z");

describe("assignment caseload lifecycle", () => {
  it("requires an active row whose end date has not passed", () => {
    expect(assignmentGrantsCaseload({ active: true, ended_at: null }, now)).toBe(true);
    expect(assignmentGrantsCaseload({ active: true, ended_at: "" }, now)).toBe(true);
    expect(assignmentGrantsCaseload({ active: true, ended_at: "2026-12-01T00:00:00.000Z" }, now)).toBe(true);
    expect(assignmentGrantsCaseload({ active: true, ended_at: "2026-11-01T00:00:00.000Z" }, now)).toBe(false);
    expect(assignmentGrantsCaseload({ active: false, ended_at: null }, now)).toBe(false);
    expect(assignmentGrantsCaseload({ active: false, ended_at: "2026-12-01T00:00:00.000Z" }, now)).toBe(false);
  });
});
