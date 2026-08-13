import { describe, expect, it } from "vitest";
import { isDeliveryBlockUnlocked } from "./delivery-unlock";
import type { DeliveryBlockView } from "./published-delivery-catalogue";

const block1: DeliveryBlockView = {
  spineItemId: "b1",
  title: "Block 1",
  sequence: 1,
  displayOrdinal: 1,
  plannedOtjHours: 45,
  weekStart: 1,
  weekEnd: 10,
};
const block2: DeliveryBlockView = {
  spineItemId: "b2",
  title: "Block 2",
  sequence: 2,
  displayOrdinal: 2,
  plannedOtjHours: 45,
  weekStart: 11,
  weekEnd: 20,
};

describe("isDeliveryBlockUnlocked (S4)", () => {
  it("always unlocks the first Block", () => {
    expect(
      isDeliveryBlockUnlocked({
        block: block1,
        blocks: [block1, block2],
        programmeWeek: 1,
      }),
    ).toBe(true);
  });

  it("unlocks by calendar / sequence when programme week has reached weekStart", () => {
    expect(
      isDeliveryBlockUnlocked({
        block: block2,
        blocks: [block1, block2],
        programmeWeek: 11,
      }),
    ).toBe(true);
  });

  it("keeps the next Block locked before its weekStart", () => {
    expect(
      isDeliveryBlockUnlocked({
        block: block2,
        blocks: [block1, block2],
        programmeWeek: 3,
      }),
    ).toBe(false);
  });

  it("does not unlock the next Block from a verified reflection argument (removed)", () => {
    expect(
      isDeliveryBlockUnlocked({
        block: block2,
        blocks: [block1, block2],
        programmeWeek: 3,
      }),
    ).toBe(false);
  });

  it("unlocks one learner via authorised override without unlocking another", () => {
    const learnerA = isDeliveryBlockUnlocked({
      block: block2,
      blocks: [block1, block2],
      programmeWeek: 3,
      manuallyUnlockedBlockIds: ["b2"],
    });
    const learnerB = isDeliveryBlockUnlocked({
      block: block2,
      blocks: [block1, block2],
      programmeWeek: 3,
      manuallyUnlockedBlockIds: [],
    });
    expect(learnerA).toBe(true);
    expect(learnerB).toBe(false);
  });
});
