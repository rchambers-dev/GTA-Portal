import { describe, expect, it } from "vitest";
import { buildAnalytics, countWeekdays, isLiveApprentice, neededEachDay, type AnalyticsSource } from "./analytics";

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
      { packId: "pk1", gtaId: "A", type: "released", at: "2026-10-20T10:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
      { packId: "pk1", gtaId: "A", type: "submitted", at: "2026-10-25T10:00:00Z", actorName: "John Pearson", actorRole: "Tutor", detail: "" },
      { packId: "pk2", gtaId: "B", type: "completed", at: "2026-11-12T15:00:00Z", actorName: "Reiss", actorRole: "Administrator", detail: "" },
    ],
    activeSignoffs: ["A"],
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
  });

  it("counts the six current steps and splits visits from waiting or archived learners", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.flow.find((step) => step.id === "booking")?.count).toBe(1);
    expect(page.flow.find((step) => step.id === "waiting")?.count).toBe(1);
    expect(page.overall.visits).toBe(1);
    expect(page.overall.calls).toBe(0);
    expect(page.overall.released).toBe(1);
    expect(page.overall.archived).toBe(1);
  });

  it("puts an overdue learner in one risk bucket and on the tutor list", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    const overdue = page.risk.find((item) => item.id === "overdue");
    expect(overdue?.count).toBe(1);
    expect(page.risk.reduce((sum, item) => sum + item.count, 0)).toBe(2);
    expect(page.overdueByTutor[0]).toMatchObject({ name: "John Pearson", count: 1 });
  });

  it("measures release to received from the event dates", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.completion.releaseToReceived).toMatchObject({ median: 5, average: 5, count: 1 });
    expect(page.safeguarding).toMatchObject({ active: 1, without: 1, reversed: 1, live: 2 });
    expect(page.concerns).toEqual({ open: 0, resolved: 1, breaks: 0 });
    expect(page.programmes.map((item) => item.name)).toEqual(["Business", "Motor"]);
  });

  it("drops events outside the selected weeks", () => {
    const page = buildAnalytics(source(), { range: "week", tutorId: "all", programmeId: "all", employerId: "all" });
    expect(page.overall.released).toBe(0);
    expect(page.overall.archived).toBe(1);
    expect(page.reviewsPerWeek.some((week) => week.current)).toBe(true);
  });

  it("limits the page to one tutor", () => {
    const page = buildAnalytics(source(), { range: "all", tutorId: "t2", programmeId: "all", employerId: "all" });
    expect(page.learners).toBe(1);
    expect(page.tutors.find((tutor) => tutor.name === "Anne-Marie Sanderson")?.learners).toBe(1);
  });
});
