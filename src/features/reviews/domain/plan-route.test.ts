import { describe, expect, it } from "vitest";
import type { DriveMatrix } from "./geo";
import { fillDayPeople, holdBadgeLabel, holdUntilPresets, noteUntilPresets } from "./plan-notes";
import { appendFitLearners, emptyPackedDay, moveRouteIds, packDay, retimeDay, visitsAreInOrder, type RouteLearner, type RouteSettings } from "./plan-route";
import { minutesToTime } from "./plan-due";

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

  it("closes the gap when a free stop is removed and leaves a held time where it is", () => {
    const people = [
      learner("a", 1, "North", "DN1 1AA"),
      learner("b", 2, "East", "DN2 2BB"),
      learner("c", 3, "South", "DN4 4CC"),
    ];
    const ten = 10 * 60;
    const drive = matrix([
      [0, ten, ten, ten],
      [ten, 0, ten, ten],
      [ten, ten, 0, ten],
      [ten, ten, ten, 0],
    ]);
    const full = retimeDay(people, drive, 0, settings, {});
    expect(full.stops.map((stop) => [stop.id, stop.arrive, stop.leave])).toEqual([
      ["a", 10 * 60 + 10, 10 * 60 + 40],
      ["b", 10 * 60 + 50, 11 * 60 + 20],
      ["c", 11 * 60 + 30, 12 * 60],
    ]);

    const withoutB = retimeDay([people[0], people[2]], drive, 0, settings, {});
    expect(withoutB.stops.map((stop) => [stop.id, stop.arrive, stop.leave])).toEqual([
      ["a", 10 * 60 + 10, 10 * 60 + 40],
      ["c", 10 * 60 + 50, 11 * 60 + 20],
    ]);

    const held = retimeDay(people, drive, 0, settings, {
      b: { arrive: 10 * 60 + 50, leave: 11 * 60 + 20 },
    });
    const locked = held.stops.find((stop) => stop.id === "b");
    expect(locked?.arrive).toBe(10 * 60 + 50);
    expect(locked?.leave).toBe(11 * 60 + 20);
    expect(held.stops.find((stop) => stop.id === "a")?.arrive).toBe(10 * 60 + 10);
    expect(held.stops.find((stop) => stop.id === "c")?.arrive).toBe(11 * 60 + 30);
    expect(held.stops.map((stop) => stop.id)).toEqual(["a", "b", "c"]);

    const clock = (stops: { id: string; arrive: number; leave: number }[]) =>
      stops.map((stop) => `${stop.id} ${minutesToTime(stop.arrive)}–${minutesToTime(stop.leave)}`).join(", ");
    expect(clock(full.stops)).toBe("a 10:10–10:40, b 10:50–11:20, c 11:30–12:00");
    expect(clock(withoutB.stops)).toBe("a 10:10–10:40, c 10:50–11:20");
  });

  it("keeps a frozen time and does not pull the next visit back before it", () => {
    const people = [
      learner("a", 1, "North", "DN1 1AA"),
      learner("b", 2, "East", "DN2 2BB"),
      learner("c", 3, "South", "DN4 4CC"),
    ];
    const ten = 10 * 60;
    const drive = matrix([
      [0, ten, ten, ten],
      [ten, 0, ten, ten],
      [ten, ten, 0, ten],
      [ten, ten, ten, 0],
    ]);
    const packed = retimeDay(people, drive, 0, settings, {
      b: { arrive: 10 * 60, leave: 10 * 60 + 30 },
    });
    const byId = Object.fromEntries(packed.stops.map((stop) => [stop.id, stop]));
    expect(byId.b.arrive).toBe(10 * 60);
    expect(byId.b.leave).toBe(10 * 60 + 30);
    expect(byId.c.arrive).toBeGreaterThanOrEqual(byId.a.leave);
    const last = packed.stops[packed.stops.length - 1];
    expect(last.id).toBe("c");
    expect(packed.returnArrive).toBe(last.leave + 10);
    expect(visitsAreInOrder([
      { arrive: 11 * 60, leave: 11 * 60 + 30 },
      { arrive: 10 * 60, leave: 10 * 60 + 30 },
    ])).toBe(false);
    expect(visitsAreInOrder([
      { arrive: 10 * 60 + 8, leave: 10 * 60 + 38 },
      { arrive: 11 * 60 + 15, leave: 11 * 60 + 45 },
    ])).toBe(true);
  });

  it("reorders a route the same way as dropping a stop onto another", () => {
    expect(moveRouteIds(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveRouteIds(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moveRouteIds(["a", "b", "c"], "b", "b")).toEqual(["a", "b", "c"]);
  });
});

describe("learner hold", () => {
  it("offers one week, two weeks and one month, and names the badge", () => {
    expect(holdUntilPresets("2026-11-23")).toEqual({
      week: "2026-11-30",
      fortnight: "2026-12-07",
      month: "2026-12-21",
    });
    expect(holdBadgeLabel("2026-12-07")).toBe("On hold until 7 Dec");
  });

  it("leaves held learners out of Fill Day and keeps everyone else who still needs booking", () => {
    const people = [
      { gtaId: "a", counter: "to_book", holdUntil: "" },
      { gtaId: "b", counter: "to_book", holdUntil: "2026-12-07" },
      { gtaId: "c", counter: "waiting", holdUntil: "" },
      { gtaId: "d", counter: "to_book", holdUntil: "" },
    ];
    expect(fillDayPeople(people, ["d"]).map((person) => person.gtaId)).toEqual(["a"]);
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
