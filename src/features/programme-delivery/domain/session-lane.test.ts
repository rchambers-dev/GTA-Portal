import { describe, expect, it } from "vitest";
import {
  assignSessionLaneStatuses,
  nextSessionAfterCurrent,
} from "./session-lane";

describe("assignSessionLaneStatuses", () => {
  const sessions = [
    { id: "w001" },
    { id: "w002" },
    { id: "w003" },
    { id: "w004" },
  ];

  it("marks delivered sessions Completed and the first remaining as the single Current/next", () => {
    const lane = assignSessionLaneStatuses(
      sessions,
      new Set(["w001", "w002"]),
    );
    expect(lane.map((r) => [r.session.id, r.status])).toEqual([
      ["w001", "completed"],
      ["w002", "completed"],
      ["w003", "current"],
      ["w004", "upcoming"],
    ]);
  });

  it("does not mark every undelivered session as current", () => {
    const lane = assignSessionLaneStatuses(sessions, new Set());
    expect(lane.filter((r) => r.status === "current")).toHaveLength(1);
    expect(lane[0]?.status).toBe("current");
  });

  it("returns the following session as next guidance", () => {
    const lane = assignSessionLaneStatuses(
      sessions,
      new Set(["w001", "w002"]),
    );
    expect(nextSessionAfterCurrent(lane)?.id).toBe("w004");
  });
});
