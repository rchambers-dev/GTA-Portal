import { describe, expect, it } from "vitest";
import { buildReviewBoard, daysWaiting, earliestBookedOn, lastReviewLabel, latestCompletedOn, planBoardPill, sentLabel, stagePresentation, waitingOnTutors, type BoardCard } from "./review-board";

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

  it("uses the Plan counter, including a verified stop when there is no appointment", () => {
    const today = "2026-11-23";
    const bookedOn = earliestBookedOn(
      [
        { gtaId: "ewan", dateOn: "2026-11-20", verified: true, completed: false },
        { gtaId: "ewan", dateOn: "2026-11-24", verified: true, completed: false },
        { gtaId: "ewan", dateOn: "2026-11-28", verified: true, completed: true },
        { gtaId: "ewan", dateOn: "2026-11-22", verified: false, completed: false },
      ],
      today,
    );
    expect(bookedOn.get("ewan")).toBe("2026-11-24");
    expect(planBoardPill({
      counter: "booked",
      stage: "to_book",
      appointmentOn: null,
      nextBookedOn: bookedOn.get("ewan") ?? null,
      awaitingDate: null,
    })).toEqual({ stage: "booked", label: "Booked 24 Nov" });
    expect(planBoardPill({
      counter: "booked",
      stage: "to_book",
      appointmentOn: "2026-12-01",
      nextBookedOn: "2026-11-24",
      awaitingDate: null,
    })).toEqual({ stage: "booked", label: "Booked 1 Dec" });
    expect(planBoardPill({
      counter: "locked",
      stage: "to_book",
      appointmentOn: null,
      nextBookedOn: null,
      awaitingDate: "2026-11-26",
    })).toEqual({ stage: "locked", label: "Locked 26 Nov" });
    expect(planBoardPill({
      counter: "waiting",
      stage: "with_tutor",
      appointmentOn: null,
      nextBookedOn: null,
      awaitingDate: null,
    })).toEqual({ stage: "with_tutor", label: "With tutor" });
    expect(planBoardPill({
      counter: "to_book",
      stage: "reviewed",
      appointmentOn: null,
      nextBookedOn: null,
      awaitingDate: null,
    }).label).toBe("Reviewed / awaiting return");
    expect(planBoardPill(null)).toEqual({ stage: "waiting", label: "Waiting" });
  });

  it("does not let a hold replace To book", () => {
    const pill = planBoardPill({
      counter: "to_book",
      stage: "to_book",
      appointmentOn: null,
      nextBookedOn: null,
      awaitingDate: null,
    });
    expect(pill).toEqual({ stage: "to_book", label: "To book" });
    const board = buildReviewBoard(
      [card({ gtaId: "h", name: "Held", plannedOn: "2026-11-24", stage: pill.stage, stageLabel: pill.label, hold: true })],
      "2026-11-23",
    );
    expect(board.weeks[0]?.cards[0]).toMatchObject({ stageLabel: "To book", hold: true });
  });

  it("groups packs with the tutor by tutor, oldest sent first", () => {
    const groups = waitingOnTutors(
      [
        { gtaId: "a", name: "Ada", tutor: "Amelia Cole", stage: "with_tutor", sentOn: "2026-11-01" },
        { gtaId: "b", name: "Bea", tutor: "Amelia Cole", stage: "with_tutor", sentOn: "2026-10-01" },
        { gtaId: "c", name: "Cara", tutor: "John Pearson", stage: "with_tutor", sentOn: "2026-11-10" },
        { gtaId: "d", name: "Dan", tutor: "John Pearson", stage: "to_book", sentOn: "2026-09-01" },
        { gtaId: "e", name: "Eve", tutor: "John Pearson", stage: "with_tutor", sentOn: "2026-11-20" },
        { gtaId: "g", name: "Gus", tutor: "John Pearson", stage: "with_tutor", sentOn: "2026-11-12" },
        { gtaId: "f", name: "Finn", tutor: "Priya Shah", stage: "with_tutor", sentOn: null },
      ],
      "2026-11-23",
    );
    expect(groups.map((group) => [group.tutor, group.count])).toEqual([
      ["John Pearson", 3],
      ["Amelia Cole", 2],
      ["Priya Shah", 1],
    ]);
    expect(groups[1]?.apprentices.map((person) => person.name)).toEqual(["Bea", "Ada"]);
    expect(groups[1]?.apprentices[0]).toMatchObject({ sentOn: "2026-10-01", daysWaiting: 53 });
    expect(sentLabel("2026-11-10", daysWaiting("2026-11-10", "2026-11-23"))).toBe("sent 10 Nov · 13d");
    expect(groups[2]?.apprentices[0]?.daysWaiting).toBeNull();
  });

  it("names the pack stages used on the card edge", () => {
    expect(stagePresentation(null)).toEqual({ stage: "waiting", label: "Waiting" });
    expect(stagePresentation("with_tutor").label).toBe("With tutor");
    expect(stagePresentation("to_book").stage).toBe("to_book");
    expect(stagePresentation("booked").stage).toBe("booked");
  });
});
