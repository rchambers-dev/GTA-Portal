import { describe, expect, it } from "vitest";
import { buildReviewBoard, lastReviewLabel, latestCompletedOn, stagePresentation, type BoardCard } from "./review-board";

function card(partial: Partial<BoardCard> & Pick<BoardCard, "gtaId" | "name" | "plannedOn">): BoardCard {
  return {
    employer: "Yard",
    tutor: "Alex",
    stage: "waiting",
    stageLabel: "Waiting",
    hold: false,
    concern: false,
    lastOn: null,
    ...partial,
  };
}

describe("review board weeks", () => {
  const today = "2026-11-23";

  it("starts ten Monday weeks at the current London week and sorts by date then name", () => {
    const board = buildReviewBoard(
      [
        card({ gtaId: "b", name: "Bea", plannedOn: "2026-11-26" }),
        card({ gtaId: "a", name: "Ada", plannedOn: "2026-11-24" }),
        card({ gtaId: "c", name: "Cara", plannedOn: "2026-11-24" }),
        card({ gtaId: "late", name: "Late", plannedOn: "2027-02-08" }),
        card({ gtaId: "old", name: "Old", plannedOn: "2026-11-16" }),
        card({ gtaId: "none", name: "None", plannedOn: null }),
      ],
      today,
    );
    expect(board.weekStart).toBe("2026-11-23");
    expect(board.weeks).toHaveLength(10);
    expect(board.weeks[0]).toMatchObject({ label: "w/c 23 Nov", range: "23 Nov – 29 Nov" });
    expect(board.weeks[0]?.cards.map((item) => item.name)).toEqual(["Ada", "Cara", "Bea"]);
    expect(board.weeks[5]?.label).toBe("w/c 28 Dec");
    expect(board.overdue.map((item) => item.name)).toEqual(["Old"]);
    expect(board.laterCount).toBe(1);
    expect(board.undatedCount).toBe(1);
  });

  it("labels the latest completed actual date, not a planned date", () => {
    expect(lastReviewLabel(null)).toBe("Last: none");
    expect(lastReviewLabel("")).toBe("Last: none");
    expect(lastReviewLabel("2026-09-15")).toBe("Last: 15 Sep");
    const latest = latestCompletedOn([
      { gtaId: "a", actualOn: "2026-06-01" },
      { gtaId: "a", actualOn: "2026-09-15" },
      { gtaId: "a", actualOn: null },
      { gtaId: "b", actualOn: "2026-01-02T00:00:00" },
    ]);
    expect(latest.get("a")).toBe("2026-09-15");
    expect(latest.get("b")).toBe("2026-01-02");
    expect(lastReviewLabel(latest.get("a") ?? null)).toBe("Last: 15 Sep");
  });

  it("names the pack stages used on the card edge", () => {
    expect(stagePresentation(null)).toEqual({ stage: "waiting", label: "Waiting" });
    expect(stagePresentation("with_tutor").label).toBe("With tutor");
    expect(stagePresentation("to_book").stage).toBe("to_book");
    expect(stagePresentation("booked").stage).toBe("booked");
  });
});
