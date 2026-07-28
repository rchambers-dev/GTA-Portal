import { describe, expect, it } from "vitest";
import {
  calculateBlockProgressionBrag,
  calculateMilestoneStatus,
  learnerBlockRag,
  learnerTaskRag,
  rollUpProgressionBrag,
} from "./progression-status";
import { AUTOCARE_GATEWAYS, gatewayMilestoneDueIso } from "./gateways";
import { cohortDateForProgrammeWeek } from "./rpl-funding-calc";

describe("learner RAG", () => {
  it("marks unlocked not-started tasks red", () => {
    expect(learnerTaskRag("not_started", false)).toBe("red");
    expect(learnerTaskRag("verified", false)).toBe("green");
    expect(learnerTaskRag("in_progress", false)).toBe("amber");
    expect(learnerTaskRag("not_started", true)).toBe("neutral");
  });

  it("colours blocks from completion summary", () => {
    expect(
      learnerBlockRag(
        {
          total: 5,
          verified: 5,
          inFlight: 0,
          notStarted: 0,
          complete: true,
          completedAt: "2026-01-01",
        },
        false,
      ),
    ).toBe("green");
    expect(
      learnerBlockRag(
        {
          total: 5,
          verified: 2,
          inFlight: 1,
          notStarted: 2,
          complete: false,
          completedAt: null,
        },
        false,
      ),
    ).toBe("amber");
    expect(
      learnerBlockRag(
        {
          total: 5,
          verified: 0,
          inFlight: 0,
          notStarted: 5,
          complete: false,
          completedAt: null,
        },
        false,
      ),
    ).toBe("red");
  });
});

describe("progression BRAG", () => {
  it("marks incomplete past end as red", () => {
    expect(
      calculateBlockProgressionBrag({
        windowStartIso: "2024-09-02",
        windowEndIso: "2024-11-04",
        complete: false,
        completedAtIso: null,
        asOfIso: "2024-12-01",
      }),
    ).toBe("red");
  });

  it("does not mark future windows green", () => {
    expect(
      calculateBlockProgressionBrag({
        windowStartIso: "2026-10-01",
        windowEndIso: "2026-12-01",
        complete: false,
        completedAtIso: null,
        asOfIso: "2026-07-28",
      }),
    ).toBeNull();
  });

  it("marks incomplete near end as amber", () => {
    expect(
      calculateBlockProgressionBrag({
        windowStartIso: "2024-09-02",
        windowEndIso: "2024-11-11",
        complete: false,
        completedAtIso: null,
        asOfIso: "2024-11-10",
      }),
    ).toBe("amber");
  });

  it("marks early complete as blue", () => {
    expect(
      calculateBlockProgressionBrag({
        windowStartIso: "2024-09-02",
        windowEndIso: "2024-11-11",
        complete: true,
        completedAtIso: "2024-10-01T12:00:00.000Z",
        asOfIso: "2024-10-15",
      }),
    ).toBe("blue");
  });

  it("rolls up to the worst due block", () => {
    expect(
      rollUpProgressionBrag(
        [
          {
            brag: "green",
            windowEndIso: "2024-10-01",
            complete: false,
          },
          {
            brag: "red",
            windowEndIso: "2024-11-01",
            complete: false,
          },
        ],
        "2024-12-01",
      ),
    ).toBe("red");
  });
});

describe("gateway / EPA milestones", () => {
  it("marks incomplete past due as behind", () => {
    expect(
      calculateMilestoneStatus({
        kind: "epa",
        complete: false,
        dueIso: "2026-01-01",
        asOfIso: "2026-07-28",
      }),
    ).toBe("behind");
  });

  it("marks incomplete before due as on track", () => {
    expect(
      calculateMilestoneStatus({
        kind: "gateway",
        complete: false,
        dueIso: "2027-03-02",
        asOfIso: "2026-07-28",
      }),
    ).toBe("on_track");
  });

  it("never treats gateway/EPA as training green when incomplete without dates", () => {
    expect(
      calculateBlockProgressionBrag({
        windowStartIso: null,
        windowEndIso: null,
        complete: false,
        completedAtIso: null,
      }),
    ).toBeNull();
  });
});

describe("MBB-style gateway schedule", () => {
  it("anchors Gateway 1 to end of Block 5 week window", () => {
    const gw1 = AUTOCARE_GATEWAYS.find((g) => g.gwId === 1)!;
    const due = gatewayMilestoneDueIso({
      milestone: gw1,
      cohortStartIso: "2025-07-08",
    });
    // Block 5 ends week 50
    expect(due).toBe(cohortDateForProgrammeWeek("2025-07-08", 50));
  });

  it("anchors Gateway 2 to end of Block 10 week window", () => {
    const gw2 = AUTOCARE_GATEWAYS.find((g) => g.gwId === 2)!;
    const due = gatewayMilestoneDueIso({
      milestone: gw2,
      cohortStartIso: "2025-07-08",
    });
    expect(due).toBe(cohortDateForProgrammeWeek("2025-07-08", 113));
  });

  it("uses cohort delivery end for EPA when provided", () => {
    const epa = AUTOCARE_GATEWAYS.find((g) => g.gwId === 3)!;
    expect(
      gatewayMilestoneDueIso({
        milestone: epa,
        cohortStartIso: "2025-07-08",
        deliveryEndIso: "2027-08-31",
      }),
    ).toBe("2027-08-31");
  });
});
