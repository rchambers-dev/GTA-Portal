import { describe, expect, it } from "vitest";
import {
  dayUndoLearners,
  dayUndoSummary,
  filterLog,
  isSingleUndoType,
  isUndoableType,
  latestUndoableIds,
  pageOf,
  undoSummary,
  withinUndoWindow,
  type DayUndoPlan,
  type ReviewLogEvent,
} from "./review-log";

const now = new Date("2026-11-14T12:00:00Z");

function event(patch: Partial<ReviewLogEvent> & Pick<ReviewLogEvent, "id">): ReviewLogEvent {
  return {
    id: patch.id,
    gtaId: "A",
    learner: "Alex",
    tutorId: "t1",
    tutor: "John Pearson",
    type: "completed",
    fromStage: "booked",
    toStage: "completed",
    at: "2026-11-13T10:00:00Z",
    actor: "Reiss",
    role: "Management",
    detail: "",
    undoes: null,
    dayOn: null,
    ...patch,
  };
}

const day: DayUndoPlan = {
  date: "2026-11-13",
  completedAt: "2026-11-13T16:00:00Z",
  learners: [
    { gtaId: "A", name: "Alex" },
    { gtaId: "B", name: "Sam" },
  ],
};

describe("review log undo rules", () => {
  it("never offers undo for a signature, a created row, or an undo row", () => {
    expect(isUndoableType(event({ id: "1", type: "signature_recorded", fromStage: "booked", toStage: "booked" }))).toBe(false);
    expect(isUndoableType(event({ id: "2", type: "created", fromStage: null, toStage: "waiting" }))).toBe(false);
    expect(isUndoableType(event({ id: "3", type: "undone", fromStage: "completed", toStage: "booked" }))).toBe(false);
    expect(isUndoableType(event({ id: "4", type: "completed" }))).toBe(true);
    expect(isSingleUndoType(event({ id: "5", type: "released", fromStage: "waiting", toStage: "with_tutor" }))).toBe(true);
    expect(isSingleUndoType(event({ id: "6", type: "submitted", fromStage: "with_tutor", toStage: "to_book" }))).toBe(true);
    expect(isSingleUndoType(event({ id: "7", type: "booked", fromStage: "to_book", toStage: "booked" }))).toBe(true);
    expect(isSingleUndoType(event({ id: "8", type: "completed" }))).toBe(false);
    expect(isSingleUndoType(event({ id: "9", type: "signature_recorded", fromStage: "booked", toStage: "booked" }))).toBe(false);
  });

  it("keeps undo inside seven days of the event time", () => {
    expect(withinUndoWindow("2026-11-07T12:00:00Z", now)).toBe(true);
    expect(withinUndoWindow("2026-11-07T11:59:59Z", now)).toBe(false);
  });

  it("offers single undo only for the latest released, received or booked event", () => {
    const events = [
      event({ id: "old", at: "2026-11-10T10:00:00Z", type: "released", fromStage: "waiting", toStage: "with_tutor" }),
      event({ id: "new", at: "2026-11-13T10:00:00Z", type: "submitted", fromStage: "with_tutor", toStage: "to_book" }),
      event({ id: "signed", at: "2026-11-14T09:00:00Z", type: "signature_recorded", fromStage: null, toStage: null }),
      event({ id: "other", gtaId: "B", learner: "Sam", at: "2026-11-12T10:00:00Z", type: "booked", fromStage: "to_book", toStage: "booked" }),
    ];
    expect([...latestUndoableIds(events, now)].sort()).toEqual(["new", "other"]);
  });

  it("does not offer a single undo once that learner's day has been completed", () => {
    const events = [
      event({ id: "booked", at: "2026-11-12T10:00:00Z", type: "booked", fromStage: "to_book", toStage: "booked" }),
      event({ id: "done", at: "2026-11-13T10:00:00Z", type: "completed", dayOn: "2026-11-13" }),
    ];
    expect(latestUndoableIds(events, now).size).toBe(0);
  });

  it("undoes a completion as the whole day, listing every learner on the plan", () => {
    const events = [
      event({ id: "a", gtaId: "A", learner: "Alex", type: "completed", dayOn: "2026-11-13" }),
      event({ id: "b", gtaId: "B", learner: "Sam", type: "completed", dayOn: "2026-11-13" }),
      event({ id: "signed", gtaId: "A", type: "signature_recorded", fromStage: null, toStage: null, at: "2026-11-13T17:00:00Z" }),
    ];
    expect(dayUndoLearners(events[0], day, events, now)).toEqual(day.learners);
    expect(dayUndoLearners(events[1], day, events, now)).toEqual(day.learners);
    expect(dayUndoLearners(events[2], day, events, now)).toBeNull();
    expect(dayUndoSummary(day.date)).toContain("route accepted");
    expect(dayUndoSummary(day.date)).toContain("Safeguarding sign-offs stay");
    expect(dayUndoLearners(events[0], { ...day, completedAt: "2026-11-01T16:00:00Z" }, events, now)).toBeNull();
    const undone = [...events, event({ id: "undo", type: "undone", fromStage: "completed", toStage: "booked", undoes: "a" })];
    expect(dayUndoLearners(events[0], day, undone, now)).toBeNull();
  });

  it("drops an event once an undo row points at it, and will not undo that undo row", () => {
    const events = [
      event({ id: "done", type: "booked", fromStage: "to_book", toStage: "booked" }),
      event({ id: "undo", type: "undone", fromStage: "booked", toStage: "to_book", at: "2026-11-14T11:00:00Z", undoes: "done" }),
    ];
    expect(latestUndoableIds(events, now).size).toBe(0);
  });

  it("describes the stage change for a single event", () => {
    expect(undoSummary(event({ id: "1", type: "booked", fromStage: "to_book", toStage: "booked" }))).toBe(
      "Undo Booked for Alex. The pack goes back from Review booked to Needs booking. The original event stays in the log.",
    );
  });

  it("filters the log and pages it", () => {
    const events = [
      event({ id: "1", learner: "Alex", detail: "Visit done", at: "2026-11-12T10:00:00Z" }),
      event({ id: "2", gtaId: "B", learner: "Sam", tutorId: "t2", type: "released", fromStage: "waiting", toStage: "with_tutor", at: "2026-11-01T10:00:00Z" }),
      event({ id: "3", type: "created", fromStage: null, toStage: "waiting", at: "2026-11-12T09:00:00Z" }),
    ];
    const filters = { query: "visit", learnerId: "all", tutorId: "all", eventType: "all", range: "all" as const, page: 1 };
    expect(filterLog(events, filters, "2026-11-14").map((row) => row.id)).toEqual(["1"]);
    expect(filterLog(events, { ...filters, query: "", tutorId: "t2" }, "2026-11-14").map((row) => row.id)).toEqual(["2"]);
    const many = Array.from({ length: 25 }, (_, index) => event({ id: `e${index}`, at: `2026-11-01T10:${String(index).padStart(2, "0")}:00Z` }));
    expect(pageOf(many, 2).rows).toHaveLength(5);
    expect(pageOf(many, 9).page).toBe(2);
  });
});
