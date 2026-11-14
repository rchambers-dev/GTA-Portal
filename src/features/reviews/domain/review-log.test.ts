import { describe, expect, it } from "vitest";
import {
  filterLog,
  isUndoableType,
  latestUndoableIds,
  pageOf,
  undoSummary,
  withinUndoWindow,
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
    ...patch,
  };
}

describe("review log undo rules", () => {
  it("never offers undo for a signature, a created row, or an undo row", () => {
    expect(isUndoableType(event({ id: "1", type: "signature_recorded", fromStage: "booked", toStage: "booked" }))).toBe(false);
    expect(isUndoableType(event({ id: "2", type: "created", fromStage: null, toStage: "waiting" }))).toBe(false);
    expect(isUndoableType(event({ id: "3", type: "undone", fromStage: "completed", toStage: "booked" }))).toBe(false);
    expect(isUndoableType(event({ id: "4", type: "completed" }))).toBe(true);
  });

  it("keeps undo inside seven days of the event time", () => {
    expect(withinUndoWindow("2026-11-07T12:00:00Z", now)).toBe(true);
    expect(withinUndoWindow("2026-11-07T11:59:59Z", now)).toBe(false);
  });

  it("offers undo only on the latest undoable event for each learner", () => {
    const events = [
      event({ id: "old", at: "2026-11-10T10:00:00Z", type: "submitted", fromStage: "with_tutor", toStage: "to_book" }),
      event({ id: "new", at: "2026-11-13T10:00:00Z", type: "completed" }),
      event({ id: "signed", at: "2026-11-14T09:00:00Z", type: "signature_recorded", fromStage: null, toStage: null }),
      event({ id: "other", gtaId: "B", learner: "Sam", at: "2026-11-12T10:00:00Z", type: "booked", fromStage: "to_book", toStage: "booked" }),
    ];
    expect([...latestUndoableIds(events, now)]).toEqual(["new", "other"]);
  });

  it("drops an event once an undo row points at it, and will not undo that undo row", () => {
    const events = [
      event({ id: "done", type: "completed" }),
      event({ id: "undo", type: "undone", fromStage: "completed", toStage: "booked", at: "2026-11-14T11:00:00Z", undoes: "done" }),
    ];
    expect(latestUndoableIds(events, now).size).toBe(0);
  });

  it("describes the stage change, and the next pack for a completion", () => {
    expect(undoSummary(event({ id: "1", type: "booked", fromStage: "to_book", toStage: "booked" }))).toBe(
      "Undo Booked for Alex. The pack goes back from Review booked to Needs booking. The original event stays in the log.",
    );
    expect(undoSummary(event({ id: "2", type: "completed" }))).toContain("next cycle's waiting pack will be voided");
    expect(undoSummary(event({ id: "2", type: "completed" }))).toContain("refused if that pack has moved on");
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
