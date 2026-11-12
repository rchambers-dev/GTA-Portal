import { describe, expect, it } from "vitest";
import type { DriveMatrix } from "./geo";
import { noteUntilPresets } from "./plan-notes";
import { appendFitLearners, emptyPackedDay, packDay, type RouteLearner, type RouteSettings } from "./plan-route";

const settings: RouteSettings = {
  startMinutes: 10 * 60,
  lunchStart: 13 * 60,
  lunchEnd: 13 * 60 + 30,
  returnBy: 16 * 60 + 45,
  stayMinutes: 30,
  callMinutes: 0,
};

function learner(id: string, index: number, company: string, postcode: string, dueRank = 1): RouteLearner {
  return { id, name: id, company, postcode, lat: 53.5, lon: -1, matrixIndex: index, dueRank, daysUntil: 10 };
}

function matrix(seconds: number[][]): DriveMatrix {
  return { durations: seconds, distances: seconds.map((row) => row.map((value) => value)), source: "osrm" };
}

describe("plan route", () => {
  it("uses the driving matrix and a 15 minute stay at the same workplace", () => {
    const people = [learner("a", 1, "Yard", "DN1 1AA"), learner("b", 2, "Yard", "DN1 1AA")];
    const packed = packDay(
      people,
      matrix([
        [0, 20 * 60, 20 * 60],
        [20 * 60, 0, 5 * 60],
        [20 * 60, 5 * 60, 0],
      ]),
      0,
      settings,
    );
    expect(packed.stops.map((stop) => stop.id)).toEqual(["a", "b"]);
    expect(packed.stops[0].arrive).toBe(10 * 60 + 20);
    expect(packed.stops[1].arrive - packed.stops[0].leave).toBe(0);
    expect(packed.stops[1].leave - packed.stops[1].arrive).toBe(15);
    expect(packed.stops[0].travelMinutes).toBe(20);
  });

  it("keeps a frozen time when someone is dropped onto the day", () => {
    const kept = learner("kept", 1, "North", "DN2 2BB");
    const added = learner("added", 2, "South", "DN4 4CC", 3);
    const drive = matrix([
      [0, 10 * 60, 15 * 60],
      [10 * 60, 0, 12 * 60],
      [15 * 60, 12 * 60, 0],
    ]);
    const current = emptyPackedDay(settings);
    current.stops = [
      {
        id: "kept",
        name: "kept",
        company: "North",
        postcode: "DN2 2BB",
        lat: 53.5,
        lon: -1,
        matrixIndex: 1,
        travelMinutes: 10,
        arrive: 11 * 60,
        leave: 11 * 60 + 30,
      },
    ];
    const fitted = appendFitLearners(current, [kept], [added], drive, 0, settings, {
      kept: { arrive: 11 * 60, leave: 11 * 60 + 30 },
    });
    const frozen = fitted.stops.find((stop) => stop.id === "kept");
    const extra = fitted.stops.find((stop) => stop.id === "added");
    expect(frozen?.arrive).toBe(11 * 60);
    expect(frozen?.leave).toBe(11 * 60 + 30);
    expect(extra).toBeTruthy();
    expect(extra!.travelMinutes).toBeGreaterThan(0);
  });
});

describe("note until presets", () => {
  it("uses Friday for this week and a date 14 and 28 days out", () => {
    expect(noteUntilPresets("2026-11-12")).toEqual({
      today: "2026-11-12",
      week: "2026-11-13",
      fortnight: "2026-11-26",
      month: "2026-12-10",
    });
  });
});
