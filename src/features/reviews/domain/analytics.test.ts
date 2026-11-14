import { describe, expect, it } from "vitest";
import { analyticsNowStep, buildAnalytics, countWeekdays, coverageTone, cyclePace, isLiveApprentice, listCycles, neededEachDay, percent, type AnalyticsSource } from "./analytics";

const today = "2026-11-13";

function source(extra: Partial<AnalyticsSource> = {}): AnalyticsSource {
  return {
    today,
    learners: [
      { gtaId: "A", name: "Alex", programmeId: "p1", programme: "Motor", employerId: "e1", employer: "Acme", tutorId: "t1", tutor: "John Pearson" },
      { gtaId: "B", name: "Sam", programmeId: "p2", programme: "Business", employerId: "e1", employer: "Acme", tutorId: "t2", tutor: "Anne-Marie Sanderson" },
    ],
    reviews: [
      { id: "r1", gtaId: "A", status: "open", plannedOn: "2026-10-01", actualOn: null, method: null },
      { id: "r2", gtaId: "B", status: "completed", plannedOn: "2026-11-01", actualOn: "2026-11-12", method: "in_person" },
    ],
    packs: [
      { id: "pk1", gtaId: "A", stage: "to_book", stageSince: "2026-11-01" },
      { id: "pk2", gtaId: "B", stage: "waiting", stageSince: "2026-11-12" },
    ],
    events: [
      { packId: "pk1", gtaId: "A", type: "created", at: "2026-10-01T10:00:00Z", actorName: "", actorRole: "", detail: "" },
      { packId: "pk1", gtaId: "A", type: "released", at: "2026-10-20T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
      { packId: "pk1", gtaId: "A", type: "submitted", at: "2026-10-25T10:00:00Z", actorName: "John Pearson", actorRole: "Tutor", detail: "" },
      { packId: "pk2", gtaId: "B", type: "completed", at: "2026-11-12T15:00:00Z", actorName: "", actorRole: "", detail: "Visit done on plan" },
    ],
    activeSignoffs: ["A"],
    recentSignoffs: ["A"],
    reversedSignoffs: ["B"],
    openConcerns: [],
    resolvedConcerns: ["A"],
    openBreaks: [],
    ...extra,
  };
}

describe("review analytics", () => {
  it("excludes test and finished apprentices from the live set", () => {
    expect(isLiveApprentice("in_learning", false)).toBe(true);
    expect(isLiveApprentice("in_learning", true)).toBe(false);
    expect(isLiveApprentice("withdrawn", false)).toBe(false);
  });

  it("rounds the daily quota up across the weekdays left", () => {
    expect(neededEachDay(10, 6, 3)).toBe(2);
    expect(neededEachDay(4, 4, 5)).toBe(0);
    expect(countWeekdays("2026-11-13", "2026-11-13")).toBe(1);
    expect(countWeekdays("2026-11-14", "2026-11-15")).toBe(0);
    expect(cyclePace(2, 0, 4)).toBe("on-pace");
    expect(cyclePace(3, 4, 4)).toBe("slightly-behind");
    expect(cyclePace(0, 8, 4)).toBe("behind");
  });

  it("counts the four current steps and totals visits from completed reviews", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.flow.map((step) => step.id)).toEqual(["released", "booking", "booked", "waiting"]);
    expect(page.flow.find((step) => step.id === "booking")?.count).toBe(1);
    expect(page.flow.find((step) => step.id === "waiting")?.count).toBe(1);
    expect(page.overall.visits).toBe(1);
    expect(page.overall.calls).toBe(0);
    expect(page.overall.released).toBe(1);
    expect(page.overall.completed).toBe(1);
  });

  it("puts an overdue learner in one risk bucket and on the tutor list", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    const overdue = page.risk.find((item) => item.id === "overdue");
    expect(overdue?.count).toBe(1);
    expect(page.risk.find((item) => item.id === "booking")?.count).toBe(1);
    expect(page.overdueByTutor[0]).toMatchObject({ name: "John Pearson", count: 1 });
    expect(page.mostOverdue[0]).toMatchObject({ name: "Alex", tutor: "John Pearson", plannedOn: "2026-10-01", days: 43 });
  });

  it("measures release to received from the event dates", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.completion.releaseToReceived).toMatchObject({ median: 5, average: 5, count: 1 });
    expect(page.safeguarding).toMatchObject({ active: 1, recent: 1, without: 1, reversed: 1, live: 2 });
    expect(page.concerns).toEqual({ open: 0, resolved: 1, breaks: 0 });
    expect(page.programmes.map((item) => item.name)).toEqual(["Business", "Motor"]);
    expect(page.programmes[0]?.share).toBe(0.5);
  });

  it("drops events outside the selected weeks", () => {
    const page = buildAnalytics(source(), { range: "week", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.overall.released).toBe(0);
    expect(page.overall.completed).toBe(1);
    expect(page.reviewsPerWeek).toHaveLength(5);
    expect(page.reviewsPerWeek.some((week) => week.current)).toBe(true);
  });

  it("keeps a finished pack in Waiting and does not call that Completed", () => {
    const page = buildAnalytics(
      source({
        packs: [
          { id: "pk1", gtaId: "A", stage: "to_book", stageSince: "2026-11-01" },
          { id: "pk2", gtaId: "B", stage: "completed", stageSince: "2026-11-12" },
        ],
      }),
      { range: "all", tutorId: "all", programmeId: "all", employerId: "all" },
    );
    expect(page.flow.find((step) => step.id === "waiting")?.count).toBe(1);
    expect(page.overall.completed).toBe(1);
    expect(page.flow.every((step) => step.id !== "waiting" || step.label === "Waiting")).toBe(true);
    expect(analyticsNowStep("reviewed", false)).toBe("waiting");
    expect(analyticsNowStep("completed", false)).toBe("waiting");
    expect(analyticsNowStep("completed", true)).toBe("released");
  });

  it("rates all-time completion from released and completed pack events", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.completion.allTime).toBe(1);
    const wider = buildAnalytics(
      source({
        events: [
          ...source().events,
          { packId: "pk3", gtaId: "A", type: "released", at: "2026-09-01T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
        ],
      }),
      { range: "all", tutorId: "all", programmeId: "all", employerId: "all" },
    );
    expect(wider.completion.allTime).toBeCloseTo(1 / 2);
    expect(percent(165 / 188)).toBe("87.8%");
    expect(percent(145 / 168)).toBe("86.3%");
  });

  it("reports the current cycle as waiting or archived over live learners, and in flight as a count", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.completion.currentCycle).toBe(0.5);
    expect(page.completion.inFlight).toBe(1);
  });

  it("treats a passed planned date as overdue and counts stage age from the London entry event", () => {
    const base = source();
    const page = buildAnalytics(
      source({
        learners: [
          ...base.learners,
          { gtaId: "C", name: "Casey", programmeId: "p1", programme: "Motor", employerId: "e1", employer: "Acme", tutorId: "t1", tutor: "John Pearson" },
        ],
        reviews: [
          { id: "r1", gtaId: "A", status: "open", plannedOn: "2026-11-20", actualOn: null, method: null },
          { id: "r2", gtaId: "B", status: "open", plannedOn: "2026-11-20", actualOn: null, method: null },
          { id: "r3", gtaId: "C", status: "open", plannedOn: "2026-11-12", actualOn: null, method: null },
        ],
        packs: [
          { id: "pk1", gtaId: "A", stage: "to_book", stageSince: "2026-11-12" },
          { id: "pk2", gtaId: "B", stage: "with_tutor", stageSince: "2026-11-13" },
          { id: "pk3", gtaId: "C", stage: "waiting", stageSince: "2026-11-01" },
        ],
        events: [
          { packId: "pk1", gtaId: "A", type: "submitted", at: "2026-11-05T12:00:00Z", actorName: "Tutor", actorRole: "Tutor", detail: "" },
          { packId: "pk2", gtaId: "B", type: "released", at: "2026-11-04T12:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
        ],
      }),
      { range: "all", tutorId: "all", programmeId: "all", employerId: "all" },
    );
    expect(page.risk.find((item) => item.id === "overdue")?.count).toBe(1);
    expect(page.risk.find((item) => item.id === "booking")?.count).toBe(1);
    expect(page.risk.find((item) => item.id === "with-tutor")?.count).toBe(1);
  });

  it("measures this cycle against every learner and the pace since the count-from Monday", () => {
    const page = buildAnalytics(
      source({
        today: "2026-11-14",
        reviews: [
          { id: "r1", gtaId: "A", status: "completed", plannedOn: "2026-09-01", actualOn: "2026-09-04", method: "in_person" },
          { id: "r2", gtaId: "B", status: "completed", plannedOn: "2026-11-01", actualOn: "2026-11-12", method: "phone" },
          { id: "r3", gtaId: "B", status: "completed", plannedOn: "2026-11-14", actualOn: "2026-11-14", method: "teams" },
        ],
        events: [
          { packId: "pk1", gtaId: "A", type: "completed", at: "2026-09-04T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
          { packId: "pk2", gtaId: "B", type: "completed", at: "2026-11-13T15:00:00Z", actorName: "", actorRole: "", detail: "" },
        ],
      }),
      { range: "all", tutorId: "all", programmeId: "all", employerId: "all" },
    );
    expect(page.cycle).toMatchObject({ done: 1, needed: 2, expected: 0, pace: "on-pace", lastDone: 1 });
    expect(page.overall.completed).toBe(3);
    expect(page.overall.cycleNote).toBe("13 Nov 2026 to 21 Jan 2027, counted from Mon 16 Nov");
    expect(page.cycle.dates).toBe("13 Nov 2026 to 21 Jan 2027");
    expect(page.history.map((cycle) => cycle.number)).toEqual([2, 1]);
    expect(page.history[0]).toMatchObject({ current: true, due: 2, reviewed: 1, missed: null, pace: "on-pace", visits: 0, calls: 0, teams: 1 });
    expect(page.history[1]).toMatchObject({ current: false, due: 2, reviewed: 2, missed: 0, pace: null, dates: "4 Sept 2026 to 12 Nov 2026" });
    expect(page.history.find((cycle) => !cycle.current)).toMatchObject({ reviewed: 2, due: 2, missed: 0, coverage: 1 });
    expect(coverageTone(page.history[1]?.coverage ?? null)).toBe("green");
    expect(coverageTone(160 / 168)).toBe("amber");
    expect(coverageTone(1 / 168)).toBe("red");
    expect(page.weekend).toBe(true);
    expect(page.weekOnWeek.find((item) => item.label === "Completed")?.now).toBe(1);
    expect(page.flow.find((step) => step.id === "booking")?.tone).toBe("red");
    expect(page.flow.find((step) => step.id === "waiting")?.tone).toBe("neutral");
  });

  it("charts the last five weeks with released, received, completed, visits and calls", () => {
    const page = buildAnalytics(
      source({
        events: [
          ...source().events,
          { packId: "pk1", gtaId: "A", type: "submitted", at: "2026-11-10T10:00:00Z", actorName: "John Pearson", actorRole: "Tutor", detail: "" },
        ],
      }),
      { range: "all", tutorId: "all", programmeId: "all", employerId: "all" },
    );
    expect(page.reviewsPerWeek).toHaveLength(5);
    expect(page.trend).toHaveLength(5);
    expect(page.trend.at(-1)).toMatchObject({ current: true, visits: 1, received: 1, completed: 1, callsTeams: 0 });
    expect(page.trend[0]).toHaveProperty("released");
  });

  it("logs the note, calls a nameless actor System, and skips created events", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.log.some((item) => item.pill === "Archived")).toBe(false);
    expect(page.log.some((item) => item.detail === "Created")).toBe(false);
    const completed = page.log.find((item) => item.pill === "Completed");
    expect(completed).toMatchObject({ detail: "Visit done on plan", actor: "System", role: "System" });
    expect(page.log).toHaveLength(3);
  });

  it("puts learner counts on the filter options", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.options.tutors.find((tutor) => tutor.name === "John Pearson")?.count).toBe(1);
    expect(page.options.programmes.reduce((sum, item) => sum + item.count, 0)).toBe(2);
  });

  it("anchors ten-week cycles on the first review day and filters the page to one cycle", () => {
    expect(listCycles("2026-09-04", "2026-11-14")).toEqual([
      { number: 1, start: "2026-09-04", end: "2026-11-12", current: false },
      { number: 2, start: "2026-11-13", end: "2027-01-21", current: true },
    ]);
    const filtered = buildAnalytics(
      source({
        today: "2026-11-14",
        reviews: [
          { id: "r1", gtaId: "A", status: "completed", plannedOn: "2026-09-01", actualOn: "2026-09-04", method: "in_person" },
          { id: "r2", gtaId: "B", status: "completed", plannedOn: "2026-11-14", actualOn: "2026-11-14", method: "phone" },
        ],
        events: [
          { packId: "pk1", gtaId: "A", type: "released", at: "2026-08-20T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
          { packId: "pk1", gtaId: "A", type: "completed", at: "2026-09-04T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
          { packId: "pk2", gtaId: "B", type: "released", at: "2026-11-10T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
          { packId: "pk2", gtaId: "B", type: "completed", at: "2026-11-14T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
        ],
      }),
      { range: "all", cycle: 1, tutorId: "all", programmeId: "all", employerId: "all" },
    );
    expect(filtered.overall.rangeLabel).toBe("Cycle 1");
    expect(filtered.overall.completed).toBe(1);
    expect(filtered.history[1]?.releaseToCompleted).toBe(15);
    expect(filtered.history[0]?.releaseToCompleted).toBe(4);
    expect(filtered.history.find((cycle) => cycle.number === 1)?.missedLearners).toEqual([
      { gtaId: "B", name: "Sam", tutor: "Anne-Marie Sanderson", employer: "Acme" },
    ]);
    expect(filtered.history.find((cycle) => cycle.number === 1)?.byTutor).toEqual([{ name: "Anne-Marie Sanderson", count: 1 }]);
    expect(filtered.history.find((cycle) => cycle.number === 2)?.missedLearners).toEqual([]);
  });

  it("limits the page to one tutor", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "t2", programmeId: "all", employerId: "all" });
    expect(page.learners).toBe(1);
    expect(page.tutors.find((tutor) => tutor.name === "Anne-Marie Sanderson")?.learners).toBe(1);
  });
});
