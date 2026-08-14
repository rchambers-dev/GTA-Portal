import { describe, expect, it } from "vitest";
import {
  assignSessionLaneStatuses,
  nextUnreleasedSession,
} from "./session-lane";

describe("assignSessionLaneStatuses", () => {
  const sessions = [
    { id: "w001" },
    { id: "w002" },
    { id: "w003" },
    { id: "w004" },
  ];

  it("marks released sessions Available and the rest Coming up", () => {
    const lane = assignSessionLaneStatuses(
      sessions,
      new Set(["w001", "w002"]),
    );
    expect(lane.map((r) => [r.session.id, r.status])).toEqual([
      ["w001", "available"],
      ["w002", "available"],
      ["w003", "coming_up"],
      ["w004", "coming_up"],
    ]);
  });

  it("does not invent a Current/Completed learner state", () => {
    const lane = assignSessionLaneStatuses(sessions, new Set());
    expect(lane.every((r) => r.status === "coming_up")).toBe(true);
    expect(JSON.stringify(lane)).not.toMatch(/completed|current/i);
  });

  it("returns the first unreleased session as next-to-teach guidance", () => {
    const lane = assignSessionLaneStatuses(
      sessions,
      new Set(["w001", "w002"]),
    );
    expect(nextUnreleasedSession(lane)?.id).toBe("w003");
  });
});
